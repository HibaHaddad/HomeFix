// Requires a running HomeFix server. Uses existing accounts; temporary chat is deleted.
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.ASSISTANT_TEST_URL || "http://localhost:3100";
after(() => prisma.$disconnect());
async function headersFor(userId) {
  const token = await new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return { Cookie: `session=${token}`, "Content-Type": "application/json" };
}
test("assistant endpoints require an active client and reject foreign origins", async (t) => {
  assert.equal((await fetch(`${base}/api/client/assistant`)).status, 401);
  assert.equal((await fetch(`${base}/api/client/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
  const client = await prisma.user.findFirst({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true } });
  if (!client) { t.skip("No existing active client"); return; }
  const headers = await headersFor(client.id);
  assert.equal((await fetch(`${base}/api/client/assistant`, { method: "POST", headers: { ...headers, Origin: "https://foreign.example" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/api/client/assistant`, { method: "POST", headers, body: "{}" })).status, 400);
  assert.equal((await fetch(`${base}/api/client/assistant`, { method: "POST", headers, body: JSON.stringify({ message: "x".repeat(17000) }) })).status, 413);
  const otherRole = await prisma.user.findFirst({ where: { role: { not: "CLIENT" } }, select: { id: true } });
  if (otherRole) assert.equal((await fetch(`${base}/api/client/assistant`, { headers: await headersFor(otherRole.id) })).status, 401);
  const page = await fetch(`${base}/dashboard/assistant`, { headers });
  assert.equal(page.status, 200); assert.match(await page.text(), /Votre allié maison/);
});
test("safety works without an AI call, history is persisted, ownership enforced and reset deletes it", async (t) => {
  const clients = await prisma.user.findMany({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true }, take: 2 });
  if (!clients.length) { t.skip("No existing active client"); return; }
  const headers = await headersFor(clients[0].id); let id;
  const post = (data, customHeaders = headers) => fetch(`${base}/api/client/assistant`, { method: "POST", headers: customHeaders, body: JSON.stringify(data) });
  try {
    const response = await post({ message: "Je constate une odeur de gaz dans la cuisine." });
    assert.equal(response.status, 200, await response.clone().text());
    const thread = await response.json(); id = thread.id;
    assert.equal(thread.messages.length, 2); assert.equal(thread.messages[1].analysis.urgency, "URGENT");
    assert.deepEqual(thread.messages[1].professionals, []); assert.match(thread.messages[1].text, /secours/);
    const read = await fetch(`${base}/api/client/assistant`, { headers });
    assert.match(read.headers.get("cache-control"), /no-store/);
    assert.equal((await read.json()).id, id);
    if (clients[1]) {
      const foreign = await headersFor(clients[1].id);
      assert.equal((await post({ conversationId: id, message: "Je sens toujours une odeur de gaz." }, foreign)).status, 404);
      const deletion = await fetch(`${base}/api/client/assistant`, { method: "DELETE", headers: foreign, body: JSON.stringify({ conversationId: id }) });
      assert.equal(deletion.status, 404);
      assert.ok(await prisma.assistantConversation.findUnique({ where: { id } }));
    }
    const followup = await post({ conversationId: id, message: "L’odeur de gaz est encore présente." });
    assert.equal(followup.status, 200); assert.equal((await followup.json()).messages.length, 4);
    const deletion = await fetch(`${base}/api/client/assistant`, { method: "DELETE", headers, body: JSON.stringify({ conversationId: id }) });
    assert.equal(deletion.status, 200); assert.equal(await prisma.assistantConversation.findUnique({ where: { id } }), null);
  } finally { if (id) await prisma.assistantConversation.deleteMany({ where: { id, clientId: clients[0].id } }); }
});
test("multiple conversations keep independent histories, titles and ownership", async (t) => {
  const clients = await prisma.user.findMany({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true }, take: 2 });
  if (!clients.length) { t.skip("No existing active client"); return; }
  const headers = await headersFor(clients[0].id);
  const ids = [];
  const mutate = (method, data, customHeaders = headers) => fetch(`${base}/api/client/assistant`, { method, headers: customHeaders, body: JSON.stringify(data) });
  try {
    const before = await prisma.assistantConversation.count({ where: { clientId: clients[0].id } });
    for (let i = 0; i < 2; i++) {
      const response = await mutate("POST", { action: "create" });
      assert.equal(response.status, 200);
      const data = await response.json(); assert.equal(data.id, null);
      assert.equal(data.title, "Nouvelle conversation"); assert.deepEqual(data.messages, []);
    }
    assert.equal(await prisma.assistantConversation.count({ where: { clientId: clients[0].id } }), before);
    const first = await mutate("POST", { message: "Une odeur de gaz est présente dans la cuisine." });
    assert.equal(first.status, 200); const conversation = await first.json();
    ids.push(conversation.id);
    assert.equal(conversation.messages.length, 2); assert.match(conversation.title, /odeur de gaz/);
    const second = await mutate("POST", { message: "Je constate des étincelles dans le tableau électrique." });
    assert.equal(second.status, 200); ids.push((await second.json()).id);
    const rename = await mutate("PATCH", { conversationId: ids[0], title: "Sécurité cuisine" });
    assert.equal(rename.status, 200); assert.equal((await rename.json()).title, "Sécurité cuisine");
    assert.equal((await mutate("PATCH", { conversationId: ids[0], title: "  " })).status, 400);
    const one = await fetch(`${base}/api/client/assistant?conversationId=${ids[0]}`, { headers });
    const saved = await one.json(); assert.equal(saved.title, "Sécurité cuisine"); assert.equal(saved.messages.length, 2);
    const two = await fetch(`${base}/api/client/assistant?conversationId=${ids[1]}`, { headers });
    assert.equal((await two.json()).messages.length, 2);
    const list = await fetch(`${base}/api/client/assistant?list=1`, { headers });
    const summaries = await list.json();
    for (const id of ids) assert.ok(summaries.conversations.some((item) => item.id === id));
    assert.ok(summaries.conversations.every((item) => !("messages" in item)));
    if (clients[1]) {
      const foreign = await headersFor(clients[1].id);
      assert.equal((await fetch(`${base}/api/client/assistant?conversationId=${ids[0]}`, { headers: foreign })).status, 404);
      assert.equal((await mutate("PATCH", { conversationId: ids[0], title: "Forbidden" }, foreign)).status, 404);
      assert.equal((await mutate("DELETE", { conversationId: ids[0] }, foreign)).status, 404);
    }
    const removal = await mutate("DELETE", { conversationId: ids[0] });
    assert.equal(removal.status, 200);
    const remaining = await removal.json();
    assert.ok(!remaining.conversations.some((item) => item.id === ids[0]));
    assert.ok(remaining.conversations.some((item) => item.id === ids[1]));
    assert.ok(await prisma.assistantConversation.findUnique({ where: { id: ids[1] } }));
  } finally { await prisma.assistantConversation.deleteMany({ where: { id: { in: ids }, clientId: clients[0].id } }); }
});
test("legacy empty conversations are hidden from history and default selection", async (t) => {
  const client = await prisma.user.findFirst({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true } });
  if (!client) { t.skip("No existing active client"); return; }
  const headers = await headersFor(client.id);
  const legacy = await prisma.assistantConversation.create({ data: { clientId: client.id } });
  try {
    const read = await fetch(`${base}/api/client/assistant`, { headers });
    assert.equal(read.status, 200);
    const data = await read.json();
    assert.notEqual(data.id, legacy.id);
    assert.ok(!data.conversations.some((item) => item.id === legacy.id));
    assert.equal((await fetch(`${base}/api/client/assistant?conversationId=${legacy.id}`, { headers })).status, 404);
  } finally { await prisma.assistantConversation.deleteMany({ where: { id: legacy.id, clientId: client.id } }); }
});
