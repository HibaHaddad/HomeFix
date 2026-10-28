import "server-only";
import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import { amount, bookingDates, categories, coordinates, deposit, id, nextProfessionalStatus, text } from "@/lib/client-domain";
import { visibleProfessional } from "./professional-directory";

export type Actor = { id: number; role: string };
export class WorkflowError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function mutateWorkspace(actor: Actor, body: Record<string, unknown>) {
  const action = text(body.action, "Action", 1, 50);
  // Serialize decisions, bookings and financial records together to avoid stale-state writes.
  return prisma.$transaction(async (tx) => {
    async function notify(userId: number, title: string, requestId: number) {
      const recipient = await tx.user.findUnique({ where: { id: userId }, select: { notificationEnabled: true, role: true } });
      if (recipient?.notificationEnabled) await tx.clientNotification.create({ data: { userId, title, href: `${recipient.role === "CLIENT" ? "/dashboard" : "/professionnel"}/messagerie?demande=${requestId}` } });
    }
    const clientOnly = () => { if (actor.role !== "CLIENT") throw new WorkflowError("Action réservée au client.", 403); };
    const professionalOnly = () => { if (actor.role !== "PROFESSIONAL") throw new WorkflowError("Action réservée au professionnel.", 403); };
    async function ownedRequest() {
      const r = await tx.serviceRequest.findFirst({ where: { id: id(body.requestId), ...(actor.role === "CLIENT" ? { clientId: actor.id } : { professionalId: actor.id }) }, include: { quotes: true, booking: true } });
      if (!r) throw new WorkflowError("Demande introuvable.", 404);
      return r;
    }
    async function event(requestId: number, status: string, description: string, notifyId?: number) {
      await tx.requestEvent.create({ data: { requestId, actorId: actor.id, status, description } });
      if (notifyId) await notify(notifyId, description, requestId);
    }
    if (action === "request.create") {
      clientOnly();
      const category = text(body.category, "Catégorie", 1, 80);
      if (!(categories as readonly string[]).includes(category)) throw new WorkflowError("Catégorie invalide.");
      const urgency = text(body.urgency, "Urgence", 1, 20);
      if (!["NORMAL", "SOON", "URGENT"].includes(urgency)) throw new WorkflowError("Urgence invalide.");
      const professionalId = body.professionalId ? id(body.professionalId) : null;
      if (professionalId && !await tx.user.findFirst({ where: { ...visibleProfessional, id: professionalId }, select: { id: true } })) throw new WorkflowError("Professionnel indisponible.", 404);
      const equipmentId = body.equipmentId ? id(body.equipmentId) : null;
      if (equipmentId && !await tx.equipment.findFirst({ where: { id: equipmentId, clientId: actor.id } })) throw new WorkflowError("Équipement introuvable.", 404);
      const recent = await tx.serviceRequest.count({ where: { clientId: actor.id, createdAt: { gte: new Date(Date.now() - 60000) } } });
      if (recent >= 5) throw new WorkflowError("Veuillez patienter avant de créer une nouvelle demande.", 429);
      const r = await tx.serviceRequest.create({ data: { clientId: actor.id, professionalId, kind: "QUOTE", title: text(body.title, "Titre", 5, 120), message: text(body.message, "Description", 20, 3000), category, urgency, address: text(body.address, "Adresse", 5, 500), preferredDates: typeof body.preferredDates === "string" ? text(body.preferredDates || "À convenir", "Disponibilités", 1, 500) : null, equipmentId } });
      await event(r.id, "SENT", "Demande créée", professionalId ?? undefined);
      return { id: r.id };
    }
    if (action === "request.assign") {
      clientOnly(); const r = await ownedRequest();
      if (r.professionalId || r.status !== "SENT") throw new WorkflowError("Cette demande est déjà attribuée.", 409);
      const professionalId = id(body.professionalId);
      if (!await tx.user.findFirst({ where: { ...visibleProfessional, id: professionalId }, select: { id: true } })) throw new WorkflowError("Professionnel indisponible.", 404);
      await tx.serviceRequest.update({ where: { id: r.id }, data: { professionalId } });
      await event(r.id, r.status, "Demande transmise au professionnel", professionalId);
    } else if (action === "request.cancel") {
      clientOnly(); const r = await ownedRequest();
      if (!["SENT", "QUOTED"].includes(r.status)) throw new WorkflowError("La demande ne peut plus être annulée ici.", 409);
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
      await event(r.id, "CANCELLED", "Demande annulée par le client", r.professionalId ?? undefined);
    } else if (action === "message.send") {
      const r = await ownedRequest();
      if (!r.professionalId || r.status === "CANCELLED") throw new WorkflowError("Conversation indisponible.", 409);
      const gps = body.latitude !== undefined ? coordinates(body.latitude, body.longitude) : {};
      const message = await tx.chatMessage.create({ data: { requestId: r.id, senderId: actor.id, text: text(body.text, "Message", 1, 3000), ...gps } });
      await notify(actor.role === "CLIENT" ? r.professionalId : r.clientId, "Nouveau message dans votre conversation", r.id);
      return { id: message.id };
    } else if (action === "quote.propose") {
      professionalOnly(); const r = await ownedRequest();
      if (!["SENT", "QUOTED"].includes(r.status)) throw new WorkflowError("Le prix de cette demande est déjà fixé.", 409);
      const validUntil = new Date(text(body.validUntil, "Validité", 10, 40));
      if (!Number.isFinite(+validUntil) || +validUntil <= Date.now()) throw new WorkflowError("La validité doit être future.");
      await tx.quote.updateMany({ where: { requestId: r.id, status: { in: ["PENDING", "NEGOTIATING"] } }, data: { status: "SUPERSEDED" } });
      await tx.quote.create({ data: { requestId: r.id, amountMillimes: amount(body.amount), details: text(body.details, "Détail du prix", 5), validUntil } });
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "QUOTED" } });
      await event(r.id, "QUOTED", "Nouveau devis proposé", r.clientId);
    } else if (["quote.accept", "quote.reject", "quote.counter"].includes(action)) {
      clientOnly(); const r = await ownedRequest();
      const q = r.quotes.find((quote) => quote.id === id(body.quoteId));
      if (!q || q.status !== "PENDING" || +q.validUntil <= Date.now() || r.status !== "QUOTED") throw new WorkflowError("Ce devis n’est plus disponible.", 409);
      const status = action === "quote.accept" ? "ACCEPTED" : action === "quote.reject" ? "REJECTED" : "NEGOTIATING";
      await tx.quote.update({ where: { id: q.id }, data: { status, ...(action === "quote.counter" ? { counterAmountMillimes: amount(body.amount) } : {}) } });
      if (status === "ACCEPTED") {
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "PRICE_ACCEPTED" } });
        await tx.clientInvoice.create({ data: { quoteId: q.id, totalMillimes: q.amountMillimes, depositMillimes: deposit(q.amountMillimes) } });
      }
      await event(r.id, status === "ACCEPTED" ? "PRICE_ACCEPTED" : r.status, status === "ACCEPTED" ? "Prix accepté par le client" : status === "REJECTED" ? "Devis refusé par le client" : "Contre-proposition envoyée par le client", r.professionalId ?? undefined);
    } else if (["booking.propose", "booking.cancel", "booking.confirm"].includes(action)) {
      const r = await ownedRequest();
      if (!["PRICE_ACCEPTED", "BOOKED"].includes(r.status) || !r.professionalId) throw new WorkflowError("Acceptez d’abord un devis.", 409);
      if (r.booking && +r.booking.startsAt <= Date.now() && r.booking.status !== "CANCELLED") throw new WorkflowError("Le créneau a commencé. Contactez l’assistance pour toute modification.", 409);
      if (action === "booking.cancel") {
        clientOnly();
        if (!r.booking || r.booking.status === "CANCELLED") throw new WorkflowError("Aucun rendez-vous à annuler.", 409);
        await tx.booking.update({ where: { id: r.booking.id }, data: { status: "CANCELLED", reason: text(body.reason, "Motif", 5, 500) } });
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "PRICE_ACCEPTED" } });
        await event(r.id, "PRICE_ACCEPTED", "Rendez-vous annulé par le client", r.professionalId);
      } else {
        if (action === "booking.confirm") professionalOnly(); else clientOnly();
        const dates = action === "booking.confirm" && r.booking?.status === "PROPOSED" ? { startsAt: r.booking.startsAt, endsAt: r.booking.endsAt } : action === "booking.propose" ? bookingDates(body.startsAt, body.endsAt) : null;
        if (!dates || +dates.startsAt <= Date.now()) throw new WorkflowError("Aucun créneau futur à confirmer.", 409);
        const conflict = await tx.booking.findFirst({ where: { professionalId: r.professionalId, requestId: { not: r.id }, status: { in: ["PROPOSED", "CONFIRMED"] }, startsAt: { lt: dates.endsAt }, endsAt: { gt: dates.startsAt } } });
        if (conflict) throw new WorkflowError("Ce professionnel a déjà un rendez-vous sur ce créneau.", 409);
        const status = action === "booking.confirm" ? "CONFIRMED" : "PROPOSED";
        await tx.booking.upsert({ where: { requestId: r.id }, create: { requestId: r.id, professionalId: r.professionalId, ...dates, status }, update: { ...dates, status, reason: null } });
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: status === "CONFIRMED" ? "BOOKED" : "PRICE_ACCEPTED" } });
        await event(r.id, status === "CONFIRMED" ? "BOOKED" : "PRICE_ACCEPTED", status === "CONFIRMED" ? "Rendez-vous confirmé par le professionnel" : "Nouveau créneau proposé, en attente de confirmation", actor.role === "CLIENT" ? r.professionalId : r.clientId);
      }
    } else if (action === "intervention.status") {
      professionalOnly(); const r = await ownedRequest();
      const status = nextProfessionalStatus(r.status, text(body.status, "Statut", 1, 30));
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status } });
      await event(r.id, status, `Statut de l’intervention : ${status}`, r.clientId);
    } else if (action === "intervention.confirm") {
      clientOnly(); const r = await ownedRequest();
      if (r.status !== "COMPLETED" || r.clientConfirmedAt) throw new WorkflowError("La fin ne peut pas être confirmée.", 409);
      await tx.serviceRequest.update({ where: { id: r.id }, data: { clientConfirmedAt: new Date() } });
      await event(r.id, "COMPLETED", "Fin d’intervention validée par le client", r.professionalId ?? undefined);
    } else if (action === "review.create") {
      clientOnly(); const r = await ownedRequest();
      if (r.status !== "COMPLETED" || !r.clientConfirmedAt || !r.professionalId) throw new WorkflowError("Confirmez la fin de l’intervention avant de l’évaluer.", 409);
      const scores = [body.quality, body.punctuality, body.communication, body.priceRespect].map(Number);
      if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) throw new WorkflowError("Les notes doivent être comprises entre 1 et 5.");
      await tx.professionalReview.create({ data: { requestId: r.id, clientId: actor.id, professionalId: r.professionalId, rating: Math.round(scores.reduce((a, b) => a + b, 0) / 4), quality: scores[0], punctuality: scores[1], communication: scores[2], priceRespect: scores[3], comment: typeof body.comment === "string" && body.comment.length <= 3000 ? body.comment.trim() : "", published: false } });
    } else if (action === "favorite.add" || action === "favorite.remove") {
      clientOnly(); const professionalId = id(body.professionalId);
      if (action === "favorite.add") {
        if (!await tx.user.findFirst({ where: { ...visibleProfessional, id: professionalId } })) throw new WorkflowError("Professionnel indisponible.", 404);
        await tx.favorite.upsert({ where: { clientId_professionalId: { clientId: actor.id, professionalId } }, create: { clientId: actor.id, professionalId }, update: {} });
      } else await tx.favorite.deleteMany({ where: { clientId: actor.id, professionalId } });
    } else if (action === "equipment.create") {
      clientOnly();
      await tx.equipment.create({ data: { clientId: actor.id, name: text(body.name, "Nom", 2, 120), category: text(body.category, "Catégorie", 1, 80), brand: typeof body.brand === "string" ? body.brand.slice(0, 120) : null, notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null } });
    } else if (action === "reminder.create") {
      clientOnly(); const equipmentId = id(body.equipmentId);
      if (!await tx.equipment.findFirst({ where: { id: equipmentId, clientId: actor.id } })) throw new WorkflowError("Équipement introuvable.", 404);
      const dueAt = new Date(text(body.dueAt, "Échéance", 10, 40));
      const intervalMonths = body.intervalMonths ? Number(body.intervalMonths) : null;
      if (!Number.isFinite(+dueAt) || (intervalMonths !== null && (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 120))) throw new WorkflowError("Date ou périodicité invalide.");
      await tx.maintenanceReminder.create({ data: { equipmentId, title: text(body.title, "Entretien", 3, 120), dueAt, intervalMonths } });
    } else if (action === "reminder.complete") {
      clientOnly(); const reminder = await tx.maintenanceReminder.findFirst({ where: { id: id(body.reminderId), equipment: { clientId: actor.id }, completedAt: null } });
      if (!reminder) throw new WorkflowError("Rappel introuvable.", 404);
      await tx.maintenanceReminder.update({ where: { id: reminder.id }, data: { completedAt: new Date() } });
      if (reminder.intervalMonths) {
        const next = new Date(Math.max(+reminder.dueAt, Date.now()));
        const day = next.getUTCDate(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + reminder.intervalMonths);
        const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(); next.setUTCDate(Math.min(day, lastDay));
        await tx.maintenanceReminder.create({ data: { equipmentId: reminder.equipmentId, title: reminder.title, dueAt: next, intervalMonths: reminder.intervalMonths } });
      }
    } else if (action === "profile.update") {
      clientOnly();
      await tx.user.update({ where: { id: actor.id }, data: { name: text(body.name, "Nom", 2, 120), phone: body.phone ? text(body.phone, "Téléphone", 3, 30) : null, address: body.address ? text(body.address, "Adresse", 3, 500) : null, city: body.city ? text(body.city, "Ville", 2, 100) : null, notificationEnabled: body.notificationEnabled === true } });
    } else if (action === "notification.read") {
      clientOnly(); await tx.clientNotification.updateMany({ where: { userId: actor.id, ...(body.notificationId ? { id: id(body.notificationId) } : {}), readAt: null }, data: { readAt: new Date() } });
    } else if (action === "complaint.create") {
      clientOnly();
      let requestId: number | null = null;
      if (body.requestId) { const r = await ownedRequest(); requestId = r.id; }
      await tx.complaint.create({ data: { clientId: actor.id, requestId, subject: text(body.subject, "Objet", 5, 150), message: text(body.message, "Réclamation", 20, 3000) } });
    } else throw new WorkflowError("Action inconnue.");
    return { ok: true };
  }, { isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel, timeout: 15000 });
}
