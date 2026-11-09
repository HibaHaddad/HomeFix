import "server-only";
import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";

export type RequestStatusFilter = "ALL" | "SENT" | "QUOTED" | "PRICE_ACCEPTED" | "BOOKED" | "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED" | "CONVERSATION";
export type RequestTypeFilter = "ALL" | "SERVICE" | "MESSAGE";
export type RequestSort = "newest" | "oldest";
export type AdminRequestFilters = {
  q: string;
  status: RequestStatusFilter;
  category: string;
  urgency: string;
  type: RequestTypeFilter;
  sort: RequestSort;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;
const statuses: RequestStatusFilter[] = ["ALL", "SENT", "QUOTED", "PRICE_ACCEPTED", "BOOKED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED", "CONVERSATION"];
const types: RequestTypeFilter[] = ["ALL", "SERVICE", "MESSAGE"];
const urgencies = ["NORMAL", "SOON", "URGENT"] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminRequestFilters(params: Record<string, string | string[] | undefined>): AdminRequestFilters {
  const status = first(params.status)?.toUpperCase() as RequestStatusFilter | undefined;
  const type = first(params.type)?.toUpperCase() as RequestTypeFilter | undefined;
  const urgency = first(params.urgency)?.toUpperCase() ?? "ALL";
  const rawPage = first(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    status: status && statuses.includes(status) ? status : "ALL",
    category: (first(params.category) ?? "").trim().slice(0, 120),
    urgency: (urgencies as readonly string[]).includes(urgency) ? urgency : "ALL",
    type: type && types.includes(type) ? type : "ALL",
    sort: first(params.sort) === "oldest" ? "oldest" : "newest",
    page: Number.isSafeInteger(parsedPage) && parsedPage >= 1 && parsedPage <= MAX_PAGE ? parsedPage : 1,
    pageSize: PAGE_SIZE,
  };
}

function requestWhere(filters: AdminRequestFilters) {
  return {
    ...(filters.type === "MESSAGE" ? { kind: "MESSAGE" } : filters.type === "SERVICE" ? { kind: { not: "MESSAGE" } } : {}),
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.urgency !== "ALL" ? { urgency: filters.urgency } : {}),
    ...(filters.q ? {
      OR: [
        { title: { contains: filters.q, mode: "insensitive" as const } },
        { client: { name: { contains: filters.q, mode: "insensitive" as const } } },
        { client: { email: { contains: filters.q, mode: "insensitive" as const } } },
        { professional: { name: { contains: filters.q, mode: "insensitive" as const } } },
        { professional: { email: { contains: filters.q, mode: "insensitive" as const } } },
      ],
    } : {}),
  };
}

const serviceRequestWhere = { kind: { not: "MESSAGE" } } as const;

export async function getAdminRequestList(filters: AdminRequestFilters) {
  const access = await requireAdmin();
  if ("error" in access) throw new Error("Accès administrateur requis pour consulter les demandes.");
  if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > MAX_PAGE || filters.pageSize !== PAGE_SIZE) {
    throw new RangeError("Invalid admin request pagination");
  }
  const where = requestWhere(filters);
  const [total, pending, inProgress, completed, cancelled, rejected, urgent, matching, categories] = await Promise.all([
    prisma.serviceRequest.count({ where: serviceRequestWhere }),
    prisma.serviceRequest.count({ where: { ...serviceRequestWhere, status: { in: ["SENT", "QUOTED", "PRICE_ACCEPTED"] } } }),
    prisma.serviceRequest.count({ where: { ...serviceRequestWhere, status: { in: ["BOOKED", "EN_ROUTE", "IN_PROGRESS"] } } }),
    prisma.serviceRequest.count({ where: { ...serviceRequestWhere, status: "COMPLETED" } }),
    prisma.serviceRequest.count({ where: { ...serviceRequestWhere, status: "CANCELLED" } }),
    prisma.serviceRequest.count({ where: { ...serviceRequestWhere, status: "REJECTED" } }),
    prisma.serviceRequest.count({ where: { ...serviceRequestWhere, urgency: "URGENT" } }),
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({ where: { kind: { not: "MESSAGE" } }, distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
  ]);
  const pageCount = Math.ceil(matching / PAGE_SIZE);
  const page = Math.min(filters.page, Math.max(1, pageCount));
  const requests = await prisma.serviceRequest.findMany({
    where,
    orderBy: [{ createdAt: filters.sort === "oldest" ? "asc" : "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, title: true, kind: true, category: true, urgency: true, status: true, createdAt: true,
      client: { select: { id: true, name: true, email: true } },
      professional: { select: { id: true, name: true, businessName: true } },
      booking: { select: { status: true, startsAt: true } },
    },
  });

  return {
    requests,
    categories: categories.map(({ category }) => category),
    counts: { total, pending, inProgress, completed, cancelled, rejected, urgent },
    matching, page, pageSize: PAGE_SIZE, pageCount,
  };
}

export async function getAdminRequestDetail(id: number) {
  const access = await requireAdmin();
  if ("error" in access) throw new Error("Accès administrateur requis pour consulter les demandes.");
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    select: {
      id: true, kind: true, title: true, message: true, category: true, urgency: true,
      address: true, preferredDates: true, status: true, clientConfirmedAt: true, createdAt: true, updatedAt: true,
      client: { select: { id: true, name: true, email: true, phone: true } },
      professional: { select: { id: true, name: true, businessName: true, email: true, phone: true } },
      equipment: { select: { id: true, name: true, category: true, brand: true, notes: true } },
      quotes: { orderBy: { createdAt: "desc" }, select: { id: true, amountMillimes: true, details: true, status: true, counterAmountMillimes: true, validUntil: true, createdAt: true } },
      booking: { select: { id: true, status: true, startsAt: true, endsAt: true, holdsSlot: true, reason: true } },
      events: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, actorId: true, status: true, description: true, createdAt: true } },
    },
  });
  if (!request) return null;

  const actorIds = [...new Set(request.events.map((event) => event.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } })
    : [];
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));

  return {
    ...request,
    events: request.events.map((event) => ({ ...event, actor: actorById.get(event.actorId) ?? null })),
  };
}
