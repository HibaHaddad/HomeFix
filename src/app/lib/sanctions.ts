import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { audit } from "./admin-audit";
import { AdminActionError } from "@/lib/admin-validation";
import { sanctionLabels, sanctionPenalty } from "@/lib/sanctions";
import { chatServer, userRoom } from "./chat-events";

export async function detectSanctions(requestId?: number) {
  const rules = await prisma.sanctionRule.findMany({ where: { enabled: true } });
  if (!rules.length) return 0;
  const now = new Date(); let cursor = 0, detected = 0;
  for (;;) {
    const requests = await prisma.serviceRequest.findMany({
      where: { kind: { not: "MESSAGE" }, id: requestId ?? { gt: cursor }, booking: { startsAt: { lt: now } } },
      orderBy: { id: "asc" }, take: 200,
      select: { id: true, professionalId: true, status: true, booking: { select: { status: true, startsAt: true, endsAt: true, reason: true } }, events: { where: { status: { in: ["BOOKED","EN_ROUTE","IN_PROGRESS","COMPLETED","CANCELLED","REJECTED"] } }, orderBy: { createdAt: "asc" }, select: { actorId: true, status: true, createdAt: true, description: true } }, complaints: { select: { id: true, subject: true, message: true, status: true, createdAt: true } } },
    });
    for (const r of requests) {
      const booking = r.booking!;
      const started = r.events.find(event => event.actorId === r.professionalId && event.status === "IN_PROGRESS");
      const committed = booking.status === "CONFIRMED" || r.events.some(event => event.status === "BOOKED");
      const completed = r.events.some(event => event.actorId === r.professionalId && event.status === "COMPLETED");
      const cancelledBefore = r.events.some(event => ["CANCELLED","REJECTED"].includes(event.status) && +event.createdAt <= +booking.startsAt);
      const evidence = { booking: { status: booking.status, startsAt: booking.startsAt.toISOString(), endsAt: booking.endsAt.toISOString(), reason: booking.reason }, requestStatus: r.status, actualStart: started?.createdAt.toISOString() ?? null, delayMinutes: started ? Math.floor((+started.createdAt - +booking.startsAt) / 60000) : null, events: r.events.map(event => ({ status: event.status, date: event.createdAt.toISOString(), description: event.description })), complaints: r.complaints.map(c => ({ id: c.id, subject: c.subject, message: c.message, status: c.status, date: c.createdAt.toISOString() })), caveat: "Le début enregistré est un signal de suivi, pas une preuve d’arrivée géolocalisée. Les déclarations des réclamations doivent être vérifiées." };
      // Refresh proof on undecided dossiers, including subsequent starts,
      // explanations and complaints; decided records retain their snapshot.
      await prisma.professionalSanction.updateMany({ where: { requestId: r.id, status: "PENDING" }, data: { evidence } });
      for (const rule of rules) {
        let reason: string | null = null;
        if (rule.id === "LATE" && started && +started.createdAt - +booking.startsAt > rule.thresholdMinutes * 60000) reason = `Début d’intervention enregistré avec ${evidence.delayMinutes} minutes de retard. Vérifier l’heure d’arrivée et les justificatifs.`;
        const elapsed = +now > +booking.endsAt + rule.thresholdMinutes * 60000;
        const allegation = r.complaints.some(c => /non.r[eé]alis|pas.*r[eé]alis|pas.*effectu|travail.*inachev|annul.*sans|intervention.*non.*faite/i.test(`${c.subject} ${c.message}`));
        if (rule.id === "UNPERFORMED" && elapsed && committed && !cancelledBefore && (allegation || ["CANCELLED","REJECTED"].includes(r.status) && !booking.reason)) reason = "Intervention potentiellement non réalisée ou contestée. Vérifier les motifs d’annulation et les preuves avant toute décision.";
        // One execution incident per request: do not charge both absence and non-performance.
        if (rule.id === "NO_SHOW" && elapsed && !cancelledBefore && !started && !completed && r.status !== "COMPLETED" && !["CANCELLED","REJECTED"].includes(r.status) && !allegation && booking.status === "CONFIRMED") reason = "Rendez-vous terminé sans début ni fin d’intervention enregistrés. Absence possible à confirmer avec les parties.";
        if (!reason) continue;
        const created = await prisma.professionalSanction.createMany({ data: [{ requestId: r.id, professionalId: r.professionalId, ruleId: rule.id, family: rule.id === "LATE" ? "LATENESS" : "EXECUTION", reason, evidence, incidentAt: started && rule.id === "LATE" ? started.createdAt : booking.endsAt, amountMillimes: rule.amountMillimes, ratingHundredths: rule.ratingHundredths }], skipDuplicates: true });
        detected += created.count;
      }
    }
    if (requestId || requests.length < 200) break;
    cursor = requests[requests.length - 1].id;
  }
  return detected;
}

export async function decideSanction(id: string, action: string, reason: string, actor: { id: number; name: string }, reviewed: boolean) {
  const notification = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ProfessionalSanction" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.professionalSanction.findUnique({ where: { id }, include: { rule: true, request: { select: { title: true } } } });
    if (!row) throw new AdminActionError("Dossier introuvable.", 404);
    let data: Prisma.ProfessionalSanctionUpdateInput;
    if (action === "APPLY" || action === "REJECT") {
      if (row.status !== "PENDING") throw new AdminActionError("Ce dossier a déjà été traité.", 409);
      if (action === "APPLY" && (!row.rule.enabled || !reviewed)) throw new AdminActionError("Vérifiez les preuves et activez la règle avant de valider.", 409);
      data = { status: action === "APPLY" ? "APPLIED" : "REJECTED", decidedAt: new Date(), decidedById: actor.id, decisionReason: reason, ...(action === "APPLY" ? { appliedAt: new Date() } : {}) };
    } else if (action === "REVOKE" || action === "ACCEPT_APPEAL") {
      if (row.status !== "APPLIED" || action === "ACCEPT_APPEAL" && row.appealStatus !== "OPEN") throw new AdminActionError("Cette sanction ne peut pas être annulée.", 409);
      data = { status: "REVOKED", revokedAt: new Date(), decisionReason: reason, ...(row.appealStatus === "OPEN" ? { appealStatus: "ACCEPTED", appealResolution: reason } : {}) };
    } else if (action === "UPHOLD_APPEAL") {
      if (row.status !== "APPLIED" || row.appealStatus !== "OPEN") throw new AdminActionError("Aucune contestation à examiner.", 409);
      data = { appealStatus: "UPHELD", appealResolution: reason };
    } else throw new AdminActionError("Action invalide.");
    await tx.professionalSanction.update({ where: { id }, data });
    await tx.sanctionHistory.create({ data: { sanctionId: id, actorId: actor.id, actorName: actor.name, action, reason } });
    await audit(tx, actor, `SANCTION_${action}`, `sanction:${id}`, reason, { requestId: row.requestId, amountMillimes: row.amountMillimes, ratingHundredths: row.ratingHundredths });
    if (action === "REJECT") return null;
    const title = `${action === "APPLY" ? "Sanction appliquée" : action === "UPHOLD_APPEAL" ? "Sanction maintenue après contestation" : "Sanction annulée"} · ${sanctionLabels[row.ruleId]} · ${sanctionPenalty(row)} · ${row.request.title} · ${new Intl.DateTimeFormat("fr-TN", { dateStyle: "short", timeZone: "Africa/Tunis" }).format(new Date())} · ${reason}`;
    return tx.clientNotification.create({ data: { userId: row.professionalId, title, type: "SANCTION", href: `/professionnel/${row.amountMillimes ? "revenus" : "avis"}?sanction=${id}` } });
  });
  if (notification) chatServer()?.to(userRoom(notification.userId)).emit("notification:new", { ...notification, createdAt: notification.createdAt.toISOString() });
  return { ok: true };
}

export async function appealSanction(id: string, professionalId: number, reason: string) {
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ProfessionalSanction" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.professionalSanction.findFirst({ where: { id, professionalId } });
    if (!row) throw new AdminActionError("Sanction introuvable.", 404);
    if (row.status !== "APPLIED" || row.appealStatus !== "NONE") throw new AdminActionError("Cette sanction a déjà été contestée ou annulée.", 409);
    const actor = await tx.user.findUniqueOrThrow({ where: { id: professionalId }, select: { name: true } });
    await tx.professionalSanction.update({ where: { id }, data: { appealStatus: "OPEN", appealText: reason, appealAt: new Date() } });
    await tx.sanctionHistory.create({ data: { sanctionId: id, actorId: professionalId, actorName: actor.name, action: "APPEAL", reason } });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", isSuspended: false, notificationEnabled: true }, select: { id: true } });
    return admins.length ? tx.clientNotification.createManyAndReturn({ data: admins.map(admin => ({ userId: admin.id, title: `Contestation de sanction · ${actor.name}`, type: "SANCTION", href: "/admin/sanctions?tab=appeals" })) }) : [];
  });
  for (const n of result) chatServer()?.to(userRoom(n.userId)).emit("notification:new", { ...n, createdAt: n.createdAt.toISOString() });
  return { ok: true };
}

export async function ratingPenalty(professionalId: number, db: Pick<Prisma.TransactionClient, "professionalSanction"> = prisma) {
  const sum = await db.professionalSanction.aggregate({ where: { professionalId, status: "APPLIED" }, _sum: { ratingHundredths: true } });
  return sum._sum.ratingHundredths ?? 0;
}
