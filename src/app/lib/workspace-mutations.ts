import "server-only";
import { reviewContent, REVIEW_EDIT_MS } from "@/lib/payment-rules";
import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import { amount, bookingDates, categories, coordinates, deposit, id, money, nextProfessionalStatus, text } from "@/lib/client-domain";
import { visibleProfessional } from "./professional-directory";
import { availableSlot, occupiedBookingStatuses } from "./booking-flow";
import { publishMessage, publishMessageUpdate } from "./chat-service";
import { availabilityHours, HOUR_MS, splitHours } from "@/lib/availability";
import { bookingRangeLabel } from "@/lib/booking-message";
import { chatServer, userRoom } from "./chat-events";
import { interventionStatusMessages } from "@/lib/intervention-status-message";

export type Actor = { id: number; role: string };
export class WorkflowError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function mutateWorkspace(actor: Actor, body: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    try { return await mutateOnce(actor, body); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!["conversation.open", "availability.save"].includes(String(body.action)) || attempt >= 2 || !["P2034", "P2002"].includes(code)) throw error;
    }
  }
}
async function mutateOnce(actor: Actor, body: Record<string, unknown>) {
  const action = text(body.action, "Action", 1, 50);
  const messagesToPublish: number[] = [];
  const messagesToRefresh = new Set<number>();
  const notificationsToPublish: { id: number; userId: number; title: string; href: string; createdAt: Date; type: string }[] = [];
  const interventionUpdates: { requestId: number; clientId: number; professionalId: number; status: string }[] = [];
  // Serialize decisions, bookings and financial records together to avoid stale-state writes.
  const result = await prisma.$transaction(async (tx) => {
    async function notify(userId: number, title: string, requestId: number, href?: string, type = "MESSAGE") {
      const recipient = await tx.user.findUnique({ where: { id: userId }, select: { notificationEnabled: true, role: true } });
      if (recipient?.notificationEnabled) {
        const notification = await tx.clientNotification.create({ data: { userId, title, type, href: href ?? `${recipient.role === "CLIENT" ? "/dashboard" : "/professionnel"}/messagerie?demande=${requestId}` } });
        if (href) notificationsToPublish.push(notification);
      }
    }
    const clientOnly = () => { if (actor.role !== "CLIENT") throw new WorkflowError("Action réservée au client.", 403); };
    const professionalOnly = () => { if (actor.role !== "PROFESSIONAL") throw new WorkflowError("Action réservée au professionnel.", 403); };
    async function ownedRequest() {
      const r = await tx.serviceRequest.findFirst({ where: { id: id(body.requestId), ...(actor.role === "CLIENT" ? { clientId: actor.id } : { professionalId: actor.id }) }, include: { quotes: true, booking: true } });
      if (!r) throw new WorkflowError("Demande introuvable.", 404);
      return r;
    }
    async function event(requestId: number, status: string, description: string, notifyId?: number, quoteId?: number, channel: "chat" | "notification" | "both" = "chat") {
      await tx.requestEvent.create({ data: { requestId, actorId: actor.id, status, description } });
      const related = await tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId }, select: { conversationId: true, clientId: true, professionalId: true, title: true } });
      if (channel !== "chat") {
        interventionUpdates.push({ requestId, clientId: related.clientId, professionalId: related.professionalId, status });
        if (notifyId) {
          const base = notifyId === related.clientId ? "/dashboard" : "/professionnel";
          const types: Record<string, string> = { EN_ROUTE: "PRO_ON_THE_WAY", IN_PROGRESS: "INTERVENTION_STARTED", COMPLETED: actor.role === "CLIENT" ? "INTERVENTION_VALIDATED" : "INTERVENTION_COMPLETED" };
          await notify(notifyId, `${description} · ${related.title}`, requestId, `${base}/interventions?demande=${requestId}#intervention-${requestId}`, types[status] || "INFO");
        }
        if (channel === "notification") return;
      }
      const message = await tx.chatMessage.create({ data: { requestId: related.conversationId ?? requestId, senderId: actor.id, text: description, quoteId } });
      messagesToPublish.push(message.id);
      const offers = await tx.chatMessage.findMany({ where: { quote: { requestId } }, select: { id: true } });
      for (const offer of offers) if (offer.id !== message.id) messagesToRefresh.add(offer.id);
      await tx.serviceRequest.update({ where: { id: related.conversationId ?? requestId }, data: { updatedAt: new Date() } });
      if (notifyId && channel === "chat") {
        const types: Record<string, string> = { SENT: "REQUEST_SENT", QUOTED: "PRICE_PROPOSED", PRICE_ACCEPTED: "PRICE_ACCEPTED", BOOKED: "BOOKING_CONFIRMED", CANCELLED: "BOOKING_CANCELLED", REJECTED: "BOOKING_REJECTED" };
        await notify(notifyId, description, related.conversationId ?? requestId, undefined, types[status] || "INFO");
      }
    }
    async function freeSlot(professionalId: number, value: unknown, excludeRequestId?: number) {
      const slotId = id(value);
      try { return await availableSlot(tx, professionalId, slotId, excludeRequestId); }
      catch (e) { if (e instanceof Error && e.constructor === Error) throw new WorkflowError(e.message, 409); throw e; }
    }
    async function conversation(professionalId: number) {
      return tx.serviceRequest.upsert({ where: { conversationKey: `${actor.id}:${professionalId}` }, update: {}, create: { conversationKey: `${actor.id}:${professionalId}`, clientId: actor.id, professionalId, kind: "MESSAGE", status: "CONVERSATION", title: "Conversation", message: "" } });
    }
    if (action === "conversation.open") {
      clientOnly(); const professionalId = id(body.professionalId);
      if (!await tx.user.findFirst({ where: { ...visibleProfessional, id: professionalId }, select: { id: true } })) throw new WorkflowError("Professionnel indisponible.", 404);
      const thread = await conversation(professionalId);
      if (body.text) {
        const message = await tx.chatMessage.create({ data: { requestId: thread.id, senderId: actor.id, text: text(body.text, "Message", 1, 3000) } });
        messagesToPublish.push(message.id);
        await notify(professionalId, "Nouveau message client", thread.id);
      }
      return { id: thread.id };
    }
    if (action === "availability.create") {
      professionalOnly(); const dates = bookingDates(body.startsAt, body.endsAt);
      const overlap = await tx.availabilitySlot.findFirst({ where: { professionalId: actor.id, active: true, startsAt: { lt: dates.endsAt }, endsAt: { gt: dates.startsAt } } });
      if (overlap) throw new WorkflowError("Cette disponibilité chevauche un créneau déjà publié.", 409);
      if ((+dates.endsAt - +dates.startsAt) % HOUR_MS !== 0) throw new WorkflowError("Choisissez une plage contenant des heures complètes.");
      const slots = await tx.availabilitySlot.createManyAndReturn({ data: splitHours(dates.startsAt, dates.endsAt).map((hour) => ({ professionalId: actor.id, ...hour })) });
      return { id: slots[0].id, count: slots.length };
    }
    if (action === "availability.save") {
      professionalOnly();
      const dates = availabilityHours(body.day, body.start, body.end);
      // Soft retirement keeps all existing booking foreign keys and snapshots.
      await tx.availabilitySlot.updateMany({ where: { professionalId: actor.id, active: true, startsAt: { gte: dates.from, lt: dates.until } }, data: { active: false } });
      await tx.availabilitySlot.createMany({ data: splitHours(dates.startsAt, dates.endsAt).map((hour) => ({ professionalId: actor.id, ...hour })) });
      return { ok: true };
    }
    if (action === "availability.remove") {
      professionalOnly(); const slot = await tx.availabilitySlot.findFirst({ where: { id: id(body.slotId), professionalId: actor.id, active: true } });
      if (!slot) throw new WorkflowError("Disponibilité introuvable.", 404);
      if (await tx.booking.findFirst({ where: { slotId: slot.id, status: { in: ["PROPOSED", "COUNTER_PROPOSED", ...occupiedBookingStatuses] } } })) throw new WorkflowError("Traitez ou annulez les demandes liées à ce créneau avant de le retirer.", 409);
      await tx.availabilitySlot.update({ where: { id: slot.id }, data: { active: false } });
      return { ok: true };
    }
    if (action === "request.create") {
      clientOnly();
      if (!["PROFILE", "CHAT"].includes(String(body.source))) throw new WorkflowError("Créez une intervention depuis un profil ou une conversation.");
      const professionalId = id(body.professionalId);
      const professional = await tx.user.findFirst({ where: { ...visibleProfessional, id: professionalId }, select: { id: true, specialty: true } });
      if (!professional) throw new WorkflowError("Professionnel indisponible.", 404);
      let thread;
      if (body.source === "CHAT") {
        thread = await tx.serviceRequest.findFirst({ where: { id: id(body.conversationId), clientId: actor.id, professionalId, kind: "MESSAGE", status: "CONVERSATION" } });
        if (!thread) throw new WorkflowError("Conversation introuvable.", 404);
      } else thread = await conversation(professionalId);
      const slot = await freeSlot(professionalId, body.slotId);
      const recent = await tx.serviceRequest.count({ where: { clientId: actor.id, kind: "INTERVENTION", createdAt: { gte: new Date(Date.now() - 60000) } } });
      if (recent >= 5) throw new WorkflowError("Veuillez patienter avant une nouvelle demande.", 429);
      if (await tx.booking.findFirst({ where: { slotId: slot.id, request: { clientId: actor.id }, status: { in: ["PROPOSED", "COUNTER_PROPOSED", ...occupiedBookingStatuses] } } })) throw new WorkflowError("Vous avez déjà une demande pour ce créneau.", 409);
      const message = text(body.message, "Problème", 10, 3000);
      const category = (categories as readonly string[]).includes(professional.specialty || "") ? professional.specialty! : "Autres";
      const r = await tx.serviceRequest.create({ data: { clientId: actor.id, professionalId, conversationId: thread.id, kind: "INTERVENTION", title: message.slice(0, 100), message, category, urgency: "NORMAL", address: text(body.address, "Adresse", 5, 500), booking: { create: { professionalId, slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, status: "PROPOSED" } } } });
      await event(r.id, "SENT", "Demande d’intervention envoyée. Créneau et devis à valider.", professionalId);
      return { id: r.id, conversationId: thread.id };
    }
    if (action === "request.assign") throw new WorkflowError("Les demandes doivent être créées directement avec un professionnel.", 400);
    if (action === "request.cancel") {
      clientOnly(); const r = await ownedRequest();
      if (!["SENT", "QUOTED"].includes(r.status)) throw new WorkflowError("La demande ne peut plus être annulée ici.", 409);
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
      await tx.booking.updateMany({ where: { requestId: r.id }, data: { status: "CANCELLED" } });
      await event(r.id, "CANCELLED", "Demande annulée par le client", r.professionalId ?? undefined);
    } else if (action === "message.send") {
      const r = await ownedRequest();
      if (!r.professionalId || r.status === "CANCELLED") throw new WorkflowError("Conversation indisponible.", 409);
      const threadId = r.conversationId ?? r.id;
      const gps = body.latitude !== undefined ? coordinates(body.latitude, body.longitude) : {};
      const message = await tx.chatMessage.create({ data: { requestId: threadId, senderId: actor.id, text: text(body.text, "Message", 1, 3000), ...gps } });
      messagesToPublish.push(message.id);
      await tx.serviceRequest.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      await notify(actor.role === "CLIENT" ? r.professionalId : r.clientId, "Nouveau message dans votre conversation", threadId);
      return { id: message.id };
    } else if (action === "booking.confirm" && body.amount !== undefined) {
      professionalOnly(); const r = await ownedRequest();
      if (r.kind === "MESSAGE" || !["SENT", "QUOTED"].includes(r.status) || !r.booking || !["PROPOSED", "ACCEPTED"].includes(r.booking.status) || r.quotes.some((q) => q.status === "ACCEPTED")) throw new WorkflowError("Cette réservation ne peut plus recevoir de prix.", 409);
      const amountMillimes = amount(body.amount);
      const slot = await freeSlot(r.professionalId, r.booking.slotId, r.id);
      await tx.quote.updateMany({ where: { requestId: r.id, status: { in: ["PENDING", "NEGOTIATING"] } }, data: { status: "SUPERSEDED" } });
      const quote = await tx.quote.create({ data: { requestId: r.id, amountMillimes, details: "Prix proposé pour l’intervention", validUntil: slot.startsAt } });
      await tx.booking.update({ where: { requestId: r.id }, data: { status: "ACCEPTED", holdsSlot: true } });
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "QUOTED" } });
      await event(r.id, "QUOTED", `Votre créneau est accepté : ${bookingRangeLabel(slot.startsAt, slot.endsAt)}. Prix proposé : ${money(amountMillimes)}.`, r.clientId, quote.id);
      return { ok: true, bookingStatus: "ACCEPTED", quoteId: quote.id };
    } else if (action === "quote.propose") {
      professionalOnly(); const r = await ownedRequest();
      if (r.kind === "MESSAGE" || !["SENT", "QUOTED"].includes(r.status)) throw new WorkflowError("Le prix de cette demande est déjà fixé.", 409);
      const validUntil = new Date(text(body.validUntil, "Validité", 10, 40));
      if (!Number.isFinite(+validUntil) || +validUntil <= Date.now()) throw new WorkflowError("La validité doit être future.");
      await tx.quote.updateMany({ where: { requestId: r.id, status: { in: ["PENDING", "NEGOTIATING"] } }, data: { status: "SUPERSEDED" } });
      const quote = await tx.quote.create({ data: { requestId: r.id, amountMillimes: amount(body.amount), details: text(body.details, "Détail du prix", 5), validUntil } });
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "QUOTED" } });
      await event(r.id, "QUOTED", `Prix proposé pour l’intervention : ${money(quote.amountMillimes)}.`, r.clientId, quote.id);
    } else if (["quote.accept", "quote.reject", "quote.counter"].includes(action)) {
      clientOnly(); const r = await ownedRequest();
      const q = r.quotes.find((quote) => quote.id === id(body.quoteId));
      if (!q || q.status !== "PENDING" || +q.validUntil <= Date.now() || r.status !== "QUOTED") throw new WorkflowError("Ce devis n’est plus disponible.", 409);
      const status = action === "quote.accept" ? "ACCEPTED" : action === "quote.reject" ? "REJECTED" : "NEGOTIATING";
      await tx.quote.update({ where: { id: q.id }, data: { status, ...(action === "quote.counter" ? { counterAmountMillimes: amount(body.amount) } : {}) } });
      if (status === "ACCEPTED") {
        const bookingAccepted = r.booking?.status === "ACCEPTED";
        if (bookingAccepted) {
          await freeSlot(r.professionalId, r.booking!.slotId, r.id);
          await tx.booking.update({ where: { requestId: r.id }, data: { status: "CONFIRMED" } });
        }
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: bookingAccepted ? "BOOKED" : "PRICE_ACCEPTED" } });
        await tx.clientInvoice.create({ data: { quoteId: q.id, totalMillimes: q.amountMillimes, depositMillimes: deposit(q.amountMillimes) } });
      }
      await event(r.id, status === "ACCEPTED" ? r.booking?.status === "ACCEPTED" ? "BOOKED" : "PRICE_ACCEPTED" : r.status, status === "ACCEPTED" ? `Prix confirmé par le client : ${money(q.amountMillimes)}.${r.booking?.status === "ACCEPTED" ? " L’intervention est confirmée." : ""}` : status === "REJECTED" ? "Prix refusé par le client" : "Contre-proposition envoyée par le client", r.professionalId ?? undefined);
    } else if (["booking.propose", "booking.cancel", "booking.confirm", "booking.counter", "booking.accept", "booking.reject"].includes(action)) {
      const r = await ownedRequest();
      if (r.kind === "MESSAGE" || ["CANCELLED", "REJECTED", "COMPLETED", "EN_ROUTE", "IN_PROGRESS"].includes(r.status)) throw new WorkflowError("Cette demande ne peut plus être modifiée.", 409);
      if (r.booking && +r.booking.startsAt <= Date.now() && !["CANCELLED", "REJECTED"].includes(r.booking.status)) throw new WorkflowError("Le créneau a commencé. Contactez l’assistance.", 409);
      const priceAccepted = r.quotes.some((q) => q.status === "ACCEPTED");
      if (action === "booking.reject") {
        professionalOnly();
        if (!r.booking || !["PROPOSED", "COUNTER_PROPOSED", "ACCEPTED"].includes(r.booking.status)) throw new WorkflowError("Cette demande ne peut plus être refusée.", 409);
        const reason = text(body.reason, "Motif du refus", 5, 500);
        await tx.booking.update({ where: { requestId: r.id }, data: { status: "REJECTED", reason } });
        await tx.quote.updateMany({ where: { requestId: r.id, status: { in: ["PENDING", "NEGOTIATING"] } }, data: { status: "SUPERSEDED" } });
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: "REJECTED" } });
        await event(r.id, "REJECTED", `Demande refus?e : ${reason}`, r.clientId);
      } else if (action === "booking.cancel") {
        clientOnly();
        if (!r.booking || ["CANCELLED", "REJECTED"].includes(r.booking.status)) throw new WorkflowError("Aucun rendez-vous à annuler.", 409);
        await tx.booking.update({ where: { requestId: r.id }, data: { status: "CANCELLED", reason: text(body.reason, "Motif", 5, 500) } });
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: priceAccepted ? "PRICE_ACCEPTED" : "SENT" } });
        await event(r.id, priceAccepted ? "PRICE_ACCEPTED" : "SENT", "Créneau annulé par le client", r.professionalId);
      } else {
        const confirmation = action === "booking.confirm" || action === "booking.accept";
        if (["booking.confirm", "booking.counter"].includes(action)) professionalOnly(); else clientOnly();
        if (action === "booking.confirm" && r.booking?.status !== "PROPOSED") throw new WorkflowError("Aucune proposition client à accepter.", 409);
        if (action === "booking.accept" && r.booking?.status !== "COUNTER_PROPOSED") throw new WorkflowError("Aucune contre-proposition à accepter.", 409);
        const slot = await freeSlot(r.professionalId, confirmation ? r.booking?.slotId : body.slotId, r.id);
        const status = confirmation ? priceAccepted ? "CONFIRMED" : "ACCEPTED" : action === "booking.counter" ? "COUNTER_PROPOSED" : "PROPOSED";
        await tx.booking.upsert({ where: { requestId: r.id }, create: { requestId: r.id, professionalId: r.professionalId, slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, status }, update: { slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, status, reason: null, holdsSlot: true } });
        const requestStatus = status === "CONFIRMED" ? "BOOKED" : priceAccepted ? "PRICE_ACCEPTED" : r.status === "BOOKED" ? "SENT" : r.status;
        await tx.serviceRequest.update({ where: { id: r.id }, data: { status: requestStatus } });
        const when = bookingRangeLabel(slot.startsAt, slot.endsAt);
        const description = status === "CONFIRMED" ? `Votre rendez-vous est confirmé : ${when}. Le créneau et le devis sont acceptés.` : status === "ACCEPTED" ? `Votre créneau est accepté : ${when}.` : status === "COUNTER_PROPOSED" ? "Autre créneau proposé par le professionnel" : "Nouveau créneau proposé par le client";
        await event(r.id, requestStatus, description, actor.role === "CLIENT" ? r.professionalId : r.clientId);
        return { ok: true, bookingStatus: status };
      }
    } else if (action === "intervention.status") {
      professionalOnly(); const r = await ownedRequest();
      const status = nextProfessionalStatus(r.status, text(body.status, "Statut", 1, 30));
      await tx.serviceRequest.update({ where: { id: r.id }, data: { status } });
      const description = interventionStatusMessages[status] || "Votre intervention a été mise à jour";
      await event(r.id, status, description, r.clientId, undefined, "both");
    } else if (action === "intervention.confirm") {
      clientOnly(); const r = await ownedRequest();
      if (r.status !== "COMPLETED" || r.clientConfirmedAt) throw new WorkflowError("La fin ne peut pas être confirmée.", 409);
      await tx.serviceRequest.update({ where: { id: r.id }, data: { clientConfirmedAt: new Date() } });
      await event(r.id, "COMPLETED", "Fin d’intervention validée par le client", r.professionalId ?? undefined, undefined, "notification");
    } else if (action === "review.create" || action === "review.update") {
      clientOnly(); const r = await ownedRequest();
      if (r.status !== "COMPLETED" || !r.clientConfirmedAt || !await tx.clientInvoice.findFirst({ where: { quote: { requestId: r.id, status: "ACCEPTED" }, status: "PAID", payments: { some: { status: "SUCCEEDED" } } } })) throw new WorkflowError("Un paiement confirmé est nécessaire avant de laisser un avis.", 409);
      const content = reviewContent(body);
      const existing = await tx.professionalReview.findUnique({ where: { requestId: r.id } });
      if (action === "review.update") {
        if (!existing || existing.clientId !== actor.id) throw new WorkflowError("Avis introuvable.", 404);
        if (+existing.createdAt + REVIEW_EDIT_MS < Date.now()) throw new WorkflowError("Les avis sont modifiables pendant 7 jours après leur publication.", 409);
        await tx.professionalReview.update({ where: { id: existing.id }, data: { ...content, published: true } });
      } else {
        if (existing) throw new WorkflowError("Un avis existe déjà pour cette intervention.", 409);
        await tx.professionalReview.create({ data: { requestId: r.id, clientId: actor.id, professionalId: r.professionalId, ...content, published: true } });
        await notify(r.professionalId, "Un client a publié un avis sur votre intervention", r.id, "/professionnel/avis", "REVIEW_RECEIVED");
      }
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
  await Promise.all(messagesToPublish.map(publishMessage));
  await Promise.all([...messagesToRefresh].map(publishMessageUpdate));
  for (const update of interventionUpdates) chatServer()?.to([userRoom(update.clientId), userRoom(update.professionalId)]).emit("intervention:updated", { requestId: update.requestId, status: update.status });
  for (const notification of notificationsToPublish) chatServer()?.to(userRoom(notification.userId)).emit("notification:new", { id: notification.id, title: notification.title, href: notification.href, type: notification.type, createdAt: notification.createdAt.toISOString() });
  return result;
}
