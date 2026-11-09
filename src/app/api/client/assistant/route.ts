import { Prisma } from "@/generated/prisma/client";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { hydrateProfessionals } from "@/app/lib/assistant-directory";
import { runAssistant } from "@/app/lib/gemini-assistant";
import { AssistantError, boundedText, object, safetyAdvice, describeAssistantMatch, type AssistantMessage } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const retention = () => new Date(Date.now() - 30 * 86400000);
function failure(error: unknown) {
  if (error instanceof Error && error.name === "PrismaClientValidationError" && /Unknown (argument|field)[\s\S]*title/.test(error.message)) {
    return Response.json({ error: "Redémarrez le serveur HomeFix pour charger la mise à jour des conversations." }, { status: 503, headers });
  }
  const known = error instanceof AssistantError;
  return Response.json({ error: known ? error.message : "L’assistant est momentanément indisponible. Votre message reste disponible pour réessayer." },
    { status: known ? error.status : 503, headers: { ...headers, ...(known && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
}
async function actor(request: Request) {
  if (!hasAllowedRequestOrigin(request)) throw new AssistantError("Origine non autorisée.", 403);
  const client = await getClient();
  if (!client) throw new AssistantError("Connexion client requise.", 401);
  return client;
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AssistantError("Format JSON requis.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AssistantError("Message manquant.", 400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 16000) { await reader.cancel(); throw new AssistantError("Message trop volumineux.", 413); }
    chunks.push(value);
  }
  try { return object(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
  catch { throw new AssistantError("Requête invalide.", 400); }
}
function conversationId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/.test(value)) throw new AssistantError("Conversation invalide.", 400);
  return value;
}
async function consumeQuota(clientId: number) {
  const now = Date.now();
  const buckets = [
    { scope: `client:${clientId}:minute`, duration: 60000, limit: 6 },
    { scope: `client:${clientId}:day`, duration: 86400000, limit: 60 },
    // App cap, not Google's quota. At most four calls including one overload retry.
    { scope: "global:day", duration: 86400000, limit: 150 },
  ];
  await prisma.$transaction(async (tx) => {
    for (const b of buckets) {
      const window = Math.floor(now / b.duration);
      const expiresAt = new Date((window + 1) * b.duration);
      const key = `${b.scope}:${window}`;
      const usage = await tx.assistantUsage.upsert({ where: { key }, create: { key, expiresAt }, update: { count: { increment: 1 } } });
      if (usage.count > b.limit) throw new AssistantError("Limite de messages atteinte. Réessayez après le délai indiqué.", 429, Math.ceil((+expiresAt - now) / 1000));
    }
    await tx.assistantUsage.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  });
}
async function present(id: string, messages: AssistantMessage[]) {
  const ids = [...new Set(messages.flatMap((m) => m.professionalIds ?? []))];
  const people = await hydrateProfessionals(ids);
  return { id, enabled: Boolean(process.env.GEMINI_API_KEY), messages: messages.map((m) => ({ ...m,
    ...(m.professionalIds ? { professionals: m.professionalIds.flatMap((id) => { const p = people.find((p) => p.id === id); return p ? [m.searchCriteria ? describeAssistantMatch(p, m.searchCriteria) : p] : []; }) } : {}),
  })) };
}
const summarySelect = { id: true, title: true, createdAt: true, updatedAt: true } as const;
const nonEmptyConversation: Prisma.AssistantConversationWhereInput = { NOT: { messages: { equals: [] } } };
async function conversationList(clientId: number, cursor?: string) {
  if (cursor && !await prisma.assistantConversation.findFirst({ where: { ...nonEmptyConversation, id: cursor, clientId, updatedAt: { gte: retention() } }, select: { id: true } })) throw new AssistantError("Conversation introuvable.", 404);
  const records = await prisma.assistantConversation.findMany({ where: { ...nonEmptyConversation, clientId, updatedAt: { gte: retention() } }, select: summarySelect,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 41, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return { conversations: records.slice(0, 40), nextCursor: records.length > 40 ? records[39].id : null };
}
export async function GET(request: Request) {
  try {
    const client = await actor(request);
    const query = new URL(request.url).searchParams;
    if (query.get("list") === "1") return Response.json(await conversationList(client.id, query.has("cursor") ? conversationId(query.get("cursor")) : undefined), { headers });
    const id = query.has("conversationId") ? conversationId(query.get("conversationId")) : null;
    const thread = await prisma.assistantConversation.findFirst({ where: { ...nonEmptyConversation, clientId: client.id, updatedAt: { gte: retention() }, ...(id ? { id } : {}) }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    if (id && !thread) throw new AssistantError("Conversation introuvable.", 404);
    return Response.json({ ...(thread ? { ...await present(thread.id, thread.messages as AssistantMessage[]), title: thread.title } : { id: null, messages: [], enabled: Boolean(process.env.GEMINI_API_KEY) }), ...await conversationList(client.id) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  let lease: { id: string; until: Date } | undefined;
  try {
    const client = await actor(request);
    const input = await body(request);
    if (input.action === "create") {
      return Response.json({ id: null, title: "Nouvelle conversation", messages: [], enabled: Boolean(process.env.GEMINI_API_KEY), ...await conversationList(client.id) }, { headers });
    }
    const message = boundedText(input.message, 3000);
    const id = input.conversationId == null ? null : conversationId(input.conversationId);
    const safety = safetyAdvice(message);
    if (!process.env.GEMINI_API_KEY && !safety) throw new AssistantError("L’assistant n’est pas encore configuré. Consultez l’annuaire en attendant.", 503);
    await consumeQuota(client.id);
    await prisma.assistantConversation.deleteMany({ where: { clientId: client.id, updatedAt: { lt: retention() } } });
    const thread = id ? await prisma.assistantConversation.findFirst({ where: { id, clientId: client.id } }) : null;
    if (id && !thread) throw new AssistantError("Conversation introuvable.", 404);
    const until = new Date(Date.now() + 65000);
    if (thread) {
      const locked = await prisma.assistantConversation.updateMany({ where: { id: thread.id, clientId: client.id, OR: [{ busyUntil: null }, { busyUntil: { lt: new Date() } }] }, data: { busyUntil: until } });
      if (!locked.count) throw new AssistantError("Une réponse est déjà en cours. Patientez quelques instants.", 409);
      lease = { id: thread.id, until };
    }
    // New chats are persisted only after a successful first reply.
    const current = thread ? await prisma.assistantConversation.findUniqueOrThrow({ where: { id: thread.id } }) : { messages: [], title: "Nouvelle conversation" };
    const previous = current.messages as AssistantMessage[];
    if (previous.length >= 60) throw new AssistantError("Cette conversation est complète. Démarrez une nouvelle conversation.", 409);
    const result = safety ? { text: safety, searched: false, professionals: [], searchCriteria: undefined, analysis: { category: /gaz|monoxyde/i.test(message) ? "Chauffage" : "Électricité", urgency: "URGENT" as const, description: message } }
      : await runAssistant(previous, message, undefined, { city: client.city });
    const now = new Date().toISOString();
    const messages: AssistantMessage[] = [...previous, { role: "user", text: message, createdAt: now },
      { role: "assistant", text: result.text, createdAt: now, analysis: result.analysis, searched: result.searched, professionalIds: result.professionals.map((p) => p.id), ...(result.searchCriteria ? { searchCriteria: result.searchCriteria } : {}) }];
    const title = previous.length === 0 && current.title === "Nouvelle conversation" ? message.replace(/\s+/g, " ").slice(0, 70) : current.title;
    let savedId: string;
    if (thread) {
      const saved = await prisma.assistantConversation.updateMany({ where: { id: thread.id, clientId: client.id, busyUntil: until }, data: { title, messages: messages as unknown as Prisma.InputJsonValue, busyUntil: null } });
      if (!saved.count) throw new AssistantError("La conversation a été réinitialisée. Rechargez la page.", 409);
      savedId = thread.id;
    } else {
      const created = await prisma.assistantConversation.create({ data: { clientId: client.id, title, messages: messages as unknown as Prisma.InputJsonValue } });
      savedId = created.id;
    }
    return Response.json({ ...await present(savedId, messages), title, ...await conversationList(client.id) }, { headers });
  } catch (error) { return failure(error); }
  finally {
    if (lease) await prisma.assistantConversation.updateMany({ where: { id: lease.id, busyUntil: lease.until }, data: { busyUntil: null } }).catch(() => {});
  }
}
export async function DELETE(request: Request) {
  try {
    const client = await actor(request);
    const input = await body(request);
    const id = conversationId(input.conversationId);
    const thread = await prisma.assistantConversation.findFirst({ where: { id, clientId: client.id }, select: { id: true } });
    if (!thread) throw new AssistantError("Conversation introuvable.", 404);
    const deleted = await prisma.assistantConversation.deleteMany({ where: { id, clientId: client.id, OR: [{ busyUntil: null }, { busyUntil: { lt: new Date() } }] } });
    if (!deleted.count) throw new AssistantError("Attendez la fin de la réponse avant de supprimer cette conversation.", 409);
    return Response.json({ deletedId: id, ...await conversationList(client.id) }, { headers });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const client = await actor(request);
    const input = await body(request);
    const id = conversationId(input.conversationId);
    const title = boundedText(input.title, 100);
    if (!await prisma.assistantConversation.findFirst({ where: { id, clientId: client.id }, select: { id: true } })) throw new AssistantError("Conversation introuvable.", 404);
    const updated = await prisma.assistantConversation.updateMany({ where: { id, clientId: client.id, OR: [{ busyUntil: null }, { busyUntil: { lt: new Date() } }] }, data: { title } });
    if (!updated.count) throw new AssistantError("Attendez la fin de la réponse avant de renommer cette conversation.", 409);
    return Response.json({ id, title, ...await conversationList(client.id) }, { headers });
  } catch (error) { return failure(error); }
}
