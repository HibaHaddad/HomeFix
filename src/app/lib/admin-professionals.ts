import "server-only";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type ProfessionalStatusFilter = "ALL" | "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
export type ProfessionalAccountFilter = "ALL" | "ACTIVE" | "SUSPENDED";
export type ProfessionalSort = "newest" | "oldest";

export type AdminProfessionalFilters = {
  q: string;
  specialty: string;
  status: ProfessionalStatusFilter;
  account: ProfessionalAccountFilter;
  sort: ProfessionalSort;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;
const statuses: ProfessionalStatusFilter[] = ["ALL", "PENDING_VERIFICATION", "APPROVED", "REJECTED"];
const accountStates: ProfessionalAccountFilter[] = ["ALL", "ACTIVE", "SUSPENDED"];

export function professionalAdminErrorResponse(error: unknown, operation: string) {
  console.error(`[Admin professionals] ${operation}`, error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ error: "Une valeur existe déjà." }, { status: 409 });
    if (error.code === "P2025") return Response.json({ error: "Dossier professionnel introuvable." }, { status: 404 });
    if (error.code === "P2034") return Response.json({ error: "Le dossier a changé pendant la décision. Actualisez puis réessayez." }, { status: 409 });
    if (["P1000", "P1001", "P1002", "P1008", "P1010", "P1017", "P2024"].includes(error.code)) {
      return Response.json({ error: "La base de données est temporairement indisponible. Réessayez." }, { status: 503 });
    }
  }
  if (error instanceof Error && ["PrismaClientInitializationError", "PrismaClientRustPanicError"].includes(error.name)) {
    return Response.json({ error: "La base de données est temporairement indisponible. Réessayez." }, { status: 503 });
  }
  return Response.json({ error: "Une erreur inattendue est survenue. Réessayez." }, { status: 500 });
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminProfessionalFilters(params: Record<string, string | string[] | undefined>): AdminProfessionalFilters {
  const status = first(params.status)?.toUpperCase() as ProfessionalStatusFilter | undefined;
  const account = first(params.account)?.toUpperCase() as ProfessionalAccountFilter | undefined;
  const rawPage = first(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    specialty: (first(params.specialty) ?? "").trim().slice(0, 120),
    status: status && statuses.includes(status) ? status : "ALL",
    account: account && accountStates.includes(account) ? account : "ALL",
    sort: first(params.sort) === "oldest" ? "oldest" : "newest",
    page: Number.isSafeInteger(parsedPage) && parsedPage >= 1 && parsedPage <= MAX_PAGE ? parsedPage : 1,
    pageSize: PAGE_SIZE,
  };
}

function whereFor(filters: AdminProfessionalFilters) {
  return {
    role: "PROFESSIONAL",
    ...(filters.specialty ? { specialty: filters.specialty } : {}),
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.account === "ACTIVE" ? { isSuspended: false } : {}),
    ...(filters.account === "SUSPENDED" ? { isSuspended: true } : {}),
    ...(filters.q ? {
      OR: [
        { name: { contains: filters.q, mode: "insensitive" as const } },
        { email: { contains: filters.q, mode: "insensitive" as const } },
        { specialty: { contains: filters.q, mode: "insensitive" as const } },
        { businessName: { contains: filters.q, mode: "insensitive" as const } },
      ],
    } : {}),
  };
}

export async function getAdminProfessionalList(filters: AdminProfessionalFilters) {
  if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > MAX_PAGE || filters.pageSize !== PAGE_SIZE) {
    throw new RangeError("Invalid admin professional pagination");
  }

  const where = whereFor(filters);
  const [total, pending, approved, rejected, suspended, matching, specialties] = await Promise.all([
    prisma.user.count({ where: { role: "PROFESSIONAL" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "PENDING_VERIFICATION" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "APPROVED", isSuspended: false } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "REJECTED" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", isSuspended: true } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where: { role: "PROFESSIONAL", specialty: { not: null } },
      distinct: ["specialty"],
      orderBy: { specialty: "asc" },
      select: { specialty: true },
    }),
  ]);

  const pageCount = Math.ceil(matching / PAGE_SIZE);
  const page = Math.min(filters.page, Math.max(1, pageCount));
  const professionals = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: filters.sort === "oldest" ? "asc" : "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, name: true, email: true, businessName: true, specialty: true,
      serviceCity: true, createdAt: true, status: true, isSuspended: true,
    },
  });

  return { professionals, specialties: specialties.flatMap((item) => item.specialty ? [item.specialty] : []), counts: { total, pending, approved, rejected, suspended }, matching, page, pageSize: PAGE_SIZE, pageCount };
}
