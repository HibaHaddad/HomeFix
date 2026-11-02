import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { SignJWT } from "jose";
import { io } from "socket.io-client";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("notification counters, typed records, pagination, private reads and both account roles", { timeout: 120000 }, async () => {
  const ids = [], sockets = [];
  async function user(role) {
    const u = await prisma.user.create({ data: { name: "Notification UI fixture", email: `notif-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } }); ids.push(u.id);
    const token = await new SignJWT({ userId: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...u, headers: { Cookie: `session=${token}`, Origin: base } };
  }
  async function connect(user) { const socket = io(base, { autoConnect: false, reconnection: false, transports: ["websocket"], extraHeaders: user.headers }); sockets.push(socket); const ready = once(socket, "connect"); socket.connect(); await ready; return socket; }
  async function read(user, values, status = 200, extra = {}) {
    const r = await fetch(`${base}/api/notifications`, { method: "POST", headers: { ...user.headers, "Content-Type": "application/json", ...extra }, body: JSON.stringify(values) }); const data = await r.json(); assert.equal(r.status, status); return data;
  }
  try {
    const client = await user("CLIENT"), pro = await user("PROFESSIONAL"), stranger = await user("CLIENT");
    const types = ["MESSAGE", "ATTACHMENT", "REQUEST_SENT", "PRICE_PROPOSED", "PRICE_ACCEPTED", "BOOKING_CONFIRMED", "PRO_ON_THE_WAY", "INTERVENTION_STARTED", "INTERVENTION_COMPLETED", "INTERVENTION_VALIDATED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "INFO"];
    await prisma.clientNotification.createMany({ data: Array.from({ length: 45 }, (_, i) => ({ userId: client.id, title: `Notification privée ${i}`, type: types[i % types.length], href: "/dashboard/interventions", readAt: i % 3 === 0 ? new Date() : null })) });
    await prisma.clientNotification.createMany({ data: [{ userId: pro.id, title: "Nouveau message client", type: "MESSAGE", href: "/professionnel/messagerie" }, { userId: pro.id, title: "Fin validée", type: "INTERVENTION_VALIDATED", href: "/professionnel/interventions" }] });
    assert.equal((await fetch(`${base}/api/notifications`)).status, 401);
    const list = async (actor, query = "") => { const response = await fetch(`${base}/api/notifications${query}`, { headers: actor.headers }); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/); return response.json(); };
    const first = await list(client); assert.equal(first.unreadCount, 30); assert.equal(first.notifications.length, 40); assert.ok(first.nextCursor); assert.ok(first.notifications.every((n) => types.includes(n.type)));
    assert.equal((await list(client, "?countOnly=1")).unreadCount, 30);
    const older = await list(client, `?before=${first.nextCursor}`); assert.equal(older.notifications.length, 5); assert.equal(new Set([...first.notifications, ...older.notifications].map((n) => n.id)).size, 45);
    const unread = await list(client, "?unread=1"); assert.equal(unread.notifications.length, 30); assert.ok(unread.notifications.every((n) => n.readAt === null));
    const professional = await list(pro); assert.equal(professional.unreadCount, 2); assert.equal(professional.notifications.length, 2); assert.ok(!professional.notifications.some((n) => n.id === first.notifications[0].id));
    const receiver = await connect(client), otherTab = await connect(client), outsider = await connect(stranger); let foreignReads = 0; outsider.on("notifications:read", () => foreignReads++);
    const changed = once(otherTab, "notifications:read");
    const one = first.notifications.find((n) => n.readAt === null); const after = await read(client, { id: one.id }); assert.equal(after.unreadCount, 29); assert.equal((await changed)[0].unreadCount, 29);
    const saved = await prisma.clientNotification.findUniqueOrThrow({ where: { id: one.id } }); assert.ok(saved.readAt);
    assert.equal((await read(client, { id: one.id })).unreadCount, 29, "reading twice is idempotent");
    assert.equal(+(await prisma.clientNotification.findUniqueOrThrow({ where: { id: one.id } })).readAt, +saved.readAt);
    await read(stranger, { id: one.id }, 404); await read(client, {}, 400); await read(client, { all: true }, 403, { Origin: "https://foreign.example" });
    const allEvent = once(receiver, "notifications:read"); assert.equal((await read(client, { all: true, userId: pro.id })).unreadCount, 0); assert.equal((await allEvent)[0].all, true);
    assert.equal((await list(client, "?unread=1")).notifications.length, 0); assert.equal((await list(pro)).unreadCount, 2); assert.equal(foreignReads, 0);
    assert.equal((await read(pro, { id: professional.notifications[0].id })).unreadCount, 1); assert.equal((await read(pro, { all: true })).unreadCount, 0);
    const clientHtml = await (await fetch(`${base}/dashboard`, { headers: client.headers })).text(); assert.ok(!clientHtml.includes('class="nx-bell-count"'));
    const proHtml = await (await fetch(`${base}/professionnel/notifications`, { headers: pro.headers })).text(); assert.match(proHtml, /Gardons le fil/);
  } finally { sockets.forEach((socket) => socket.disconnect()); await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); }
});
