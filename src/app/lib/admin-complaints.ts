import "server-only";
import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { chatServer, userRoom } from "@/app/lib/chat-events";
import { audit } from "./admin-audit";

const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;

export class AdminComplaintError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type AdminComplaintFilters = { q: string; status: string; sort: "newest" | "oldest"; page: number };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminComplaintFilters(params: Record<string, string | string[] | undefined>): AdminComplaintFilters {
  const rawPage = first(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    q: (first(params.q) ?? "").trim().slice(0, 120),
    status: (first(params.status) ?? "ALL").trim().slice(0, 80),
    sort: first(params.sort) === "oldest" ? "oldest" : "newest",
    page: Number.isSafeInteger(parsedPage) && parsedPage >= 1 && parsedPage <= MAX_PAGE ? parsedPage : 1,
  };
}

function complaintWhere(filters: AdminComplaintFilters, status: string) {
  return {
    ...(status !== "ALL" ? { status } : {}),
    ...(filters.q ? {
      OR: [
        { subject: { contains: filters.q, mode: "insensitive" as const } },
        { message: { contains: filters.q, mode: "insensitive" as const } },
        { client: { name: { contains: filters.q, mode: "insensitive" as const } } },
        { client: { email: { contains: filters.q, mode: "insensitive" as const } } },
      ],
    } : {}),
  };
}

export async function getAdminComplaintList(filters: AdminComplaintFilters) {
  const access = await requireAdmin();
  if ("error" in access) throw new Error("Accès administrateur requis pour consulter les réclamations.");
  if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > MAX_PAGE) {
    throw new RangeError("Invalid admin complaint pagination");
  }

  const [statusGroups, total, open, withResponse, withoutResponse] = await Promise.all([
    prisma.complaint.groupBy({ by: ["status"], orderBy: { status: "asc" } }),
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.complaint.count({ where: { AND: [{ response: { not: null } }, { response: { not: "" } }] } }),
    prisma.complaint.count({ where: { OR: [{ response: null }, { response: "" }] } }),
  ]);
  const statuses = statusGroups.map(({ status }) => status);
  const status = filters.status === "ALL" || statuses.includes(filters.status) ? filters.status : "ALL";
  const effectiveFilters = { ...filters, status };
  const where = complaintWhere(effectiveFilters, status);
  const matching = await prisma.complaint.count({ where });
  const pageCount = Math.ceil(matching / PAGE_SIZE);
  const page = Math.min(filters.page, Math.max(1, pageCount));
  const complaints = await prisma.complaint.findMany({
    where,
    orderBy: [{ createdAt: filters.sort === "oldest" ? "asc" : "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      subject: true,
      status: true,
      response: true,
      createdAt: true,
      client: { select: { name: true, email: true } },
      request: { select: { id: true, title: true } },
    },
  });

  return {
    complaints,
    statuses,
    filters: effectiveFilters,
    stats: { total, open, withResponse, withoutResponse },
    matching,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

export async function getAdminComplaintDetail(id: number) {
  const access = await requireAdmin();
  if ("error" in access) throw new Error("Accès administrateur requis pour consulter les réclamations.");
  if (!Number.isSafeInteger(id) || id < 1) return null;

  return prisma.complaint.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      message: true,
      status: true,
      response: true,
      createdAt: true,
      client: { select: { name: true, email: true } },
      request: { select: { id: true, title: true, category: true, status: true, createdAt: true } },
    },
  });
}

export function validateAdminComplaintResponse(value: unknown) {
  if (typeof value !== "string") {
    throw new AdminComplaintError("La réponse doit être un texte.", 400);
  }
  const response = value.trim();
  if (response.length < 10 || response.length > 3000) {
    throw new AdminComplaintError("La réponse doit contenir entre 10 et 3 000 caractères.", 400);
  }
  return response;
}

export async function sendAdminComplaintResponse(id: number, rawResponse: unknown) {
  const access = await requireAdmin();
  if ("error" in access) return { error: access.error } as const;
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) {
    throw new AdminComplaintError("Identifiant de réclamation invalide.", 400);
  }
  const response = validateAdminComplaintResponse(rawResponse);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.complaint.updateMany({
      where: { id, OR: [{ response: null }, { response: "" }] },
      data: { response },
    });
    if (updated.count !== 1) {
      const existing = await tx.complaint.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new AdminComplaintError("Réclamation introuvable.", 404);
      throw new AdminComplaintError("Une réponse a déjà été envoyée pour cette réclamation.", 409);
    }

    const complaint = await tx.complaint.findUniqueOrThrow({
      where: { id },
      select: { id: true, subject: true, clientId: true, client: { select: { notificationEnabled: true } } },
    });
    await audit(tx, access.admin, "COMPLAINT_RESPONSE", `complaint:${id}`, undefined, { responseLength: response.length });
    const notification = complaint.client.notificationEnabled
      ? await tx.clientNotification.create({
        data: {
          userId: complaint.clientId,
          title: `Une réponse à votre réclamation « ${complaint.subject} » est disponible.`,
          type: "INFO",
          href: "/dashboard/reclamations",
        },
        select: { id: true, userId: true, title: true, href: true, type: true, createdAt: true },
      })
      : null;
    return { complaintId: complaint.id, notification };
  });

  if (result.notification) {
    chatServer()?.to(userRoom(result.notification.userId)).emit("notification:new", {
      ...result.notification,
      createdAt: result.notification.createdAt.toISOString(),
    });
  }

  return { ok: true, complaintId: result.complaintId } as const;
}

export function adminComplaintActionErrorResponse(error: unknown) {
  if (error instanceof AdminComplaintError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("[Admin complaints] sending response", error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") {
      return Response.json({ error: "La réclamation vient d’être traitée. Actualisez la page." }, { status: 409 });
    }
    if (["P1000", "P1001", "P1002", "P1008", "P1010", "P1017", "P2024"].includes(error.code)) {
      return Response.json({ error: "La base de données est temporairement indisponible. Réessayez." }, { status: 503 });
    }
  }
  if (error instanceof Error && ["PrismaClientInitializationError", "PrismaClientRustPanicError"].includes(error.name)) {
    return Response.json({ error: "La base de données est temporairement indisponible. Réessayez." }, { status: 503 });
  }
  return Response.json({ error: "La réponse n’a pas pu être enregistrée. Réessayez." }, { status: 500 });
}
