import { prisma } from "@/app/lib/prisma";

export const dashboardPeriods = ["today", "7d", "30d", "12m"] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

const timeZone = "Africa/Tunis";
const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDateParts(date: Date) {
  const parts = Object.fromEntries(
    datePartsFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function localMidnightUtc(year: number, month: number, day: number) {
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value]),
    );
    const representedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const correction = target - representedAsUtc;
    guess += correction;
    if (correction === 0) break;
  }

  return new Date(guess);
}

function keyForDay(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDashboardDateRange(period: DashboardPeriod, now = new Date()) {
  const today = localDateParts(now);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  let startParts = today;
  let endParts = { ...today, day: today.day + 1 };
  let bucket: "day" | "month" = "day";

  if (period === "7d" || period === "30d") {
    const daysBack = period === "7d" ? 6 : 29;
    const first = new Date(todayUtc - daysBack * 86_400_000);
    startParts = { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: first.getUTCDate() };
  } else if (period === "12m") {
    const firstMonth = new Date(Date.UTC(today.year, today.month - 12, 1));
    startParts = { year: firstMonth.getUTCFullYear(), month: firstMonth.getUTCMonth() + 1, day: 1 };
    endParts = { year: today.year, month: today.month + 1, day: 1 };
    bucket = "month";
  }

  const start = localMidnightUtc(startParts.year, startParts.month, startParts.day);
  const end = localMidnightUtc(endParts.year, endParts.month, endParts.day);
  const keys: string[] = [];

  if (bucket === "month") {
    for (let index = 0; index < 12; index += 1) {
      const month = new Date(Date.UTC(startParts.year, startParts.month - 1 + index, 1));
      keys.push(`${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`);
    }
  } else {
    for (let day = Date.UTC(startParts.year, startParts.month - 1, startParts.day), endDay = Date.UTC(endParts.year, endParts.month - 1, endParts.day); day < endDay; day += 86_400_000) {
      const current = new Date(day);
      keys.push(keyForDay(current.getUTCFullYear(), current.getUTCMonth() + 1, current.getUTCDate()));
    }
  }

  return { start, end, bucket, keys, timeZone };
}

type BucketCount = { period: string; count: number };

export async function getAdminDashboardData(period: DashboardPeriod) {
  const range = getDashboardDateRange(period);
  const requestWhere = { kind: { not: "MESSAGE" }, createdAt: { gte: range.start, lt: range.end } };
  const [
    totalUsers,
    totalClients,
    totalProfessionals,
    pendingProfessionals,
    approvedProfessionals,
    totalRequests,
    completedRequests,
    openComplaints,
    totalReviews,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "PENDING_VERIFICATION" } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "APPROVED" } }),
    prisma.serviceRequest.count({ where: { kind: { not: "MESSAGE" } } }),
    prisma.serviceRequest.count({ where: { kind: { not: "MESSAGE" }, status: "COMPLETED" } }),
    prisma.complaint.count({ where: { status: "OPEN" } }),
    prisma.professionalReview.count(),
  ]);

  const [
    signupBuckets,
    completedBuckets,
    categories,
    requestStatuses,
    latestUsers,
    latestProfessionals,
    latestRequests,
    latestComplaints,
  ] = await Promise.all([
    prisma.$queryRaw<BucketCount[]>`
      SELECT TO_CHAR(DATE_TRUNC(${range.bucket}, "createdAt" AT TIME ZONE ${range.timeZone}), ${range.bucket === "day" ? "YYYY-MM-DD" : "YYYY-MM"}) AS period,
             COUNT(*)::int AS count
      FROM "User"
      WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.end}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<BucketCount[]>`
      WITH completed_interventions AS (
        SELECT DISTINCT ON (event."requestId") event."requestId", event."createdAt"
        FROM "RequestEvent" AS event
        INNER JOIN "ServiceRequest" AS request ON request.id = event."requestId"
        WHERE event.status = 'COMPLETED' AND request.kind <> 'MESSAGE' AND request.status = 'COMPLETED'
        ORDER BY event."requestId", event."createdAt" ASC
      )
      SELECT TO_CHAR(DATE_TRUNC(${range.bucket}, "createdAt" AT TIME ZONE ${range.timeZone}), ${range.bucket === "day" ? "YYYY-MM-DD" : "YYYY-MM"}) AS period,
             COUNT(*)::int AS count
      FROM completed_interventions
      WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.end}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.serviceRequest.groupBy({ by: ["category"], where: requestWhere, _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
    prisma.serviceRequest.groupBy({ by: ["status"], where: requestWhere, _count: { _all: true }, orderBy: { _count: { status: "desc" } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    prisma.user.findMany({ where: { role: "PROFESSIONAL" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, specialty: true, status: true, createdAt: true } }),
    prisma.serviceRequest.findMany({ where: { kind: { not: "MESSAGE" } }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, title: true, category: true, status: true, createdAt: true, client: { select: { name: true } } } }),
    prisma.complaint.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, subject: true, status: true, createdAt: true, client: { select: { name: true } } } }),
  ]);

  const series = (rows: BucketCount[]) => {
    const counts = new Map(rows.map((row) => [row.period, row.count]));
    return range.keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
  };

  return {
    period,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    kpis: {
      totalUsers, totalClients, totalProfessionals, pendingProfessionals,
      approvedProfessionals, totalRequests, completedRequests, openComplaints, totalReviews,
    },
    signups: series(signupBuckets),
    completed: series(completedBuckets),
    categories: categories.map(({ category, _count }) => ({ category, count: _count._all })),
    requestStatuses: requestStatuses.map(({ status, _count }) => ({ status, count: _count._all })),
    latestUsers,
    latestProfessionals,
    latestRequests,
    latestComplaints,
  };
}
