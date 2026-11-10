import "server-only";
import { prisma } from "./prisma";
import { adminPage } from "@/lib/admin-validation";
import type { Prisma } from "@/generated/prisma/client";
export type OpsParams = Record<string, string | string[] | undefined>;
export function opsFilters(params: OpsParams, allowed: string[] = []) {
  const one = (key: string) => { const v = params[key]; return Array.isArray(v) ? v[0] ?? "" : v ?? ""; };
  return { q: one("q").trim().slice(0, 100), status: allowed.includes(one("status")) ? one("status") : "ALL", page: adminPage(params.page) };
}
async function paging(total: number, requested: number) {
  const page = Math.min(requested, Math.max(1, Math.ceil(total / 20)));
  return { total, page, skip: (page - 1) * 20, take: 20 };
}
export const reviewStatuses = ["PUBLISHED", "HIDDEN", "REPORTED", "UNPUBLISHED"];
export async function adminReviews(filters: ReturnType<typeof opsFilters>) {
  const where: Prisma.ProfessionalReviewWhereInput = {
    ...(filters.status === "PUBLISHED" ? { published: true } : filters.status === "HIDDEN" ? { moderationStatus: "HIDDEN" } : filters.status === "REPORTED" ? { reports: { some: { status: "OPEN" } } } : filters.status === "UNPUBLISHED" ? { published: false, moderationStatus: { not: "HIDDEN" } } : {}),
    ...(filters.q ? { OR: [{ comment: { contains: filters.q, mode: "insensitive" } }, { client: { name: { contains: filters.q, mode: "insensitive" } } }, { professional: { name: { contains: filters.q, mode: "insensitive" } } }] } : {}),
  };
  const [total, published, reported, hidden] = await Promise.all([prisma.professionalReview.count({ where }), prisma.professionalReview.count({ where: { published: true } }), prisma.reviewReport.count({ where: { status: "OPEN" } }), prisma.professionalReview.count({ where: { moderationStatus: "HIDDEN" } })]);
  const p = await paging(total, filters.page);
  const rows = await prisma.professionalReview.findMany({ where, skip: p.skip, take: p.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, rating: true, comment: true, published: true, moderationStatus: true, moderationReason: true, createdAt: true, requestId: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } }, reports: { where: { status: "OPEN" }, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, reason: true, createdAt: true } }, _count: { select: { reports: { where: { status: "OPEN" } } } } } });
  return { ...p, rows, published, reported, hidden };
}
export const bookingStatuses = ["PROPOSED", "COUNTER_PROPOSED", "CONFIRMED", "CANCELLED", "REJECTED", "COMPLETED"];
export async function adminBookings(filters: ReturnType<typeof opsFilters>) {
  const where: Prisma.BookingWhereInput = { ...(filters.status !== "ALL" ? { status: filters.status } : {}), ...(filters.q ? { request: { OR: [{ title: { contains: filters.q, mode: "insensitive" } }, { client: { name: { contains: filters.q, mode: "insensitive" } } }, { professional: { name: { contains: filters.q, mode: "insensitive" } } }] } } : {}) };
  const total = await prisma.booking.count({ where });
  const p = await paging(total, filters.page);
  const rows = await prisma.booking.findMany({ where, skip: p.skip, take: p.take, orderBy: [{ startsAt: "desc" }, { id: "desc" }], select: { id: true, status: true, startsAt: true, endsAt: true, reason: true, request: { select: { id: true, title: true, status: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } } } } } });
  return { ...p, rows };
}
export async function adminConversations(filters: ReturnType<typeof opsFilters>) {
  const where: Prisma.ServiceRequestWhereInput = { conversationId: null, ...(filters.q ? { OR: [{ title: { contains: filters.q, mode: "insensitive" } }, { client: { name: { contains: filters.q, mode: "insensitive" } } }, { professional: { name: { contains: filters.q, mode: "insensitive" } } }] } : {}), AND: [{ OR: [{ kind: "MESSAGE" }, { messages: { some: {} } }, { interventions: { some: { messages: { some: {} } } } }] }] };
  const total = await prisma.serviceRequest.count({ where });
  const p = await paging(total, filters.page);
  const rows = await prisma.serviceRequest.findMany({ where, skip: p.skip, take: p.take, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { id: true, title: true, updatedAt: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } } } });
  return { ...p, rows };
}
export async function adminAudit(filters: ReturnType<typeof opsFilters>) {
  const where: Prisma.AdminAuditLogWhereInput = { ...(filters.status !== "ALL" ? { action: filters.status } : {}), ...(filters.q ? { OR: [{ actorName: { contains: filters.q, mode: "insensitive" } }, { target: { contains: filters.q, mode: "insensitive" } }, { reason: { contains: filters.q, mode: "insensitive" } }] } : {}) };
  const total = await prisma.adminAuditLog.count({ where });
  const p = await paging(total, filters.page);
  const rows = await prisma.adminAuditLog.findMany({ where, skip: p.skip, take: p.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return { ...p, rows };
}
export const paymentStatuses = ["SUCCEEDED", "REFUNDED", "OPEN", "PENDING", "PROCESSING", "FAILED", "EXPIRED", "CREATING"];
export async function adminPayments(filters: ReturnType<typeof opsFilters>) {
  const where: Prisma.CheckoutPaymentWhereInput = { livemode: false, ...(filters.status !== "ALL" ? { status: filters.status } : {}), ...(filters.q ? { OR: [{ id: { contains: filters.q } }, { paymentIntentId: { contains: filters.q } }, { invoice: { quote: { request: { client: { name: { contains: filters.q, mode: "insensitive" } } } } } }] } : {}) };
  const [total, gross, refunds, pendingRefunds, currencyGroups] = await Promise.all([
    prisma.checkoutPayment.count({ where }),
    prisma.checkoutPayment.aggregate({ where: { livemode: false, status: { in: ["SUCCEEDED", "REFUNDED"] } }, _sum: { amountMillimes: true } }),
    prisma.adminRefund.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountMillimes: true } }),
    prisma.adminRefund.count({ where: { status: "PENDING" } }),
    prisma.checkoutPayment.groupBy({ by: ["currency"], where: { livemode: false, status: { in: ["SUCCEEDED", "REFUNDED"] } }, _sum: { stripeAmount: true } }),
  ]);
  const p = await paging(total, filters.page);
  const rows = await prisma.checkoutPayment.findMany({
    where, skip: p.skip, take: p.take,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, status: true, amountMillimes: true, stripeAmount: true, currency: true, createdAt: true, paymentIntentId: true,
      refund: { select: { status: true, stripeRefundId: true } },
      invoice: { select: { id: true, quote: { select: { request: { select: {
        id: true, title: true, client: { select: { name: true } },
        professional: { select: { name: true, businessName: true } },
      } } } } } },
    },
  });
  return { ...p, rows, gross: gross._sum.amountMillimes ?? 0, refunded: refunds._sum.amountMillimes ?? 0, pendingRefunds, currencyGroups };
}
