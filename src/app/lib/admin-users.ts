import "server-only";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type UserRoleFilter = "ALL" | "CLIENT" | "PROFESSIONAL" | "ADMIN";
export type AccountFilter = "ALL" | "ACTIVE" | "SUSPENDED";
export type UserSort = "newest" | "oldest";

export type AdminUserFilters = {
  q: string;
  role: UserRoleFilter;
  account: AccountFilter;
  sort: UserSort;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;
export const MAX_ADMIN_USER_PAGE = 100_000;
const validRoles: UserRoleFilter[] = ["ALL", "CLIENT", "PROFESSIONAL", "ADMIN"];
const validAccounts: AccountFilter[] = ["ALL", "ACTIVE", "SUSPENDED"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminUserFilters(params: Record<string, string | string[] | undefined>): AdminUserFilters {
  const roleValue = first(params.role)?.toUpperCase() as UserRoleFilter | undefined;
  const accountValue = first(params.account)?.toUpperCase() as AccountFilter | undefined;
  const sortValue = first(params.sort);
  const parsedPage = Number(first(params.page) || 1);
  return {
    q: (first(params.q) || "").trim().slice(0, 100),
    role: roleValue && validRoles.includes(roleValue) ? roleValue : "ALL",
    account: accountValue && validAccounts.includes(accountValue) ? accountValue : "ALL",
    sort: sortValue === "oldest" ? "oldest" : "newest",
    page: Number.isSafeInteger(parsedPage) && parsedPage >= 1 && parsedPage <= MAX_ADMIN_USER_PAGE ? parsedPage : 1,
    pageSize: PAGE_SIZE,
  };
}

export function adminUsersErrorResponse(error: unknown, operation: string) {
  console.error(`[Admin users] ${operation}`, error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      const emailConflict = Array.isArray(target)
        ? target.some((field) => String(field).toLowerCase().includes("email"))
        : String(target ?? "").toLowerCase().includes("email");
      return Response.json(
        { error: emailConflict ? "Cette adresse e-mail est déjà utilisée." : "Une valeur existe déjà." },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }
    if (["P1000", "P1001", "P1002", "P1008", "P1010", "P1017", "P2024"].includes(error.code)) {
      return Response.json({ error: "La base de données est temporairement indisponible. Réessayez." }, { status: 503 });
    }
  }
  if (error instanceof Error && ["PrismaClientInitializationError", "PrismaClientRustPanicError"].includes(error.name)) {
    return Response.json({ error: "La base de données est temporairement indisponible. Réessayez." }, { status: 503 });
  }

  return Response.json({ error: "Une erreur inattendue est survenue. Réessayez." }, { status: 500 });
}

function whereFor(filters: AdminUserFilters) {
  return {
    ...(filters.role !== "ALL" ? { role: filters.role } : {}),
    ...(filters.account === "ACTIVE" ? { isSuspended: false } : {}),
    ...(filters.account === "SUSPENDED" ? { isSuspended: true } : {}),
    ...(filters.q ? {
      OR: [
        { name: { contains: filters.q, mode: "insensitive" as const } },
        { email: { contains: filters.q, mode: "insensitive" as const } },
        { phone: { contains: filters.q, mode: "insensitive" as const } },
      ],
    } : {}),
  };
}

export async function getAdminUserList(filters: AdminUserFilters) {
  if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > MAX_ADMIN_USER_PAGE) {
    throw new RangeError("Invalid admin users page");
  }
  if (filters.pageSize !== PAGE_SIZE) throw new RangeError("Invalid admin users page size");

  const where = whereFor(filters);
  const [total, clients, professionals, suspended, matching] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL" } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where }),
  ]);
  const pageCount = Math.ceil(matching / filters.pageSize);
  const page = Math.min(filters.page, Math.max(pageCount, 1));
  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: filters.sort === "oldest" ? "asc" : "desc" }, { id: "desc" }],
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true,
      isSuspended: true, specialty: true, profilePhotoMime: true, createdAt: true,
    },
  });

  return { users: rows, counts: { total, clients, professionals, suspended }, matching, page, pageSize: filters.pageSize, pageCount };
}

const userDetailSelect = {
  id: true, name: true, email: true, phone: true, address: true, city: true,
  role: true, status: true, isSuspended: true, suspensionReason: true,
  suspensionUpdatedAt: true, profilePhotoMime: true, createdAt: true,
  businessName: true, specialty: true, description: true, experience: true,
  serviceCity: true, coveredAreas: true, priceRange: true,
  verifiedAt: true, verificationReason: true,
} as const;

export async function getAdminUserDetail(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: userDetailSelect });
  if (!user) return null;

  const requestWhere = user.role === "CLIENT"
    ? { clientId: id, kind: { not: "MESSAGE" } }
    : user.role === "PROFESSIONAL"
      ? { professionalId: id, kind: { not: "MESSAGE" } }
      : { id: -1, kind: { not: "MESSAGE" } };
  const bookingWhere = user.role === "PROFESSIONAL"
    ? { professionalId: id }
    : user.role === "CLIENT"
      ? { request: { clientId: id } }
      : { id: -1 };
  const reviewWhere = user.role === "PROFESSIONAL"
    ? { professionalId: id }
    : user.role === "CLIENT"
      ? { clientId: id }
      : { id: -1 };
  const complaintWhere = user.role === "CLIENT"
    ? { clientId: id }
    : user.role === "PROFESSIONAL"
      ? { request: { professionalId: id } }
      : { id: -1 };

  const [requestCount, bookingCount, reviewAggregate, complaintCount, requests, bookings, reviews, complaints] = await Promise.all([
    prisma.serviceRequest.count({ where: requestWhere }),
    prisma.booking.count({ where: bookingWhere }),
    prisma.professionalReview.aggregate({ where: reviewWhere, _avg: { rating: true }, _count: { _all: true } }),
    prisma.complaint.count({ where: complaintWhere }),
    prisma.serviceRequest.findMany({
      where: requestWhere,
      orderBy: { createdAt: "desc" }, take: 6,
      select: {
        id: true, title: true, category: true, status: true, createdAt: true,
        client: { select: { name: true } }, professional: { select: { name: true, businessName: true } },
        booking: { select: { status: true, startsAt: true, endsAt: true } },
      },
    }),
    prisma.booking.findMany({
      where: bookingWhere,
      orderBy: { startsAt: "desc" }, take: 6,
      select: {
        id: true, status: true, startsAt: true, endsAt: true,
        request: { select: { title: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } } } },
      },
    }),
    prisma.professionalReview.findMany({
      where: reviewWhere, orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, rating: true, comment: true, published: true, createdAt: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } } },
    }),
    prisma.complaint.findMany({
      where: complaintWhere, orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, subject: true, status: true, createdAt: true },
    }),
  ]);

  return {
    user,
    history: {
      requestCount, bookingCount, reviewCount: reviewAggregate._count._all,
      averageRating: reviewAggregate._avg.rating, complaintCount,
      requests, bookings, reviews, complaints,
    },
  };
}
