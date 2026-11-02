import { loadEnvConfig } from "@next/env";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { prisma } from "./src/app/lib/prisma";
import { setChatServer, userRoom } from "./src/app/lib/chat-events";
import { chatParticipant, receipt, sendChatMessage } from "./src/app/lib/chat-service";

async function main() {
  const dev = !process.argv.includes("--production");
  Object.assign(process.env, { NODE_ENV: dev ? "development" : "production" });
  loadEnvConfig(process.cwd(), dev);
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const hostname = process.env.HOSTNAME || "0.0.0.0";
  const port = Number(process.env.PORT || 3000);
  const http = createServer();
  const app = next({ dev, hostname, port, httpServer: http });
  await app.prepare();
  http.on("request", app.getRequestHandler());
  const io = new Server(http, {
    maxHttpBufferSize: 32 * 1024,
    allowRequest(req, callback) {
      try {
        const origin = req.headers.origin;
        callback(null, !origin || (process.env.APP_ORIGIN ? origin === process.env.APP_ORIGIN : new URL(origin).host === req.headers.host));
      } catch { callback(null, false); }
    },
  });
  setChatServer(io);
  io.use(async (socket, done) => {
    try {
      const token = socket.request.headers.cookie?.split(";").map((v) => v.trim()).find((v) => v.startsWith("session="))?.slice(8);
      if (!token) throw new Error();
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      if (!Number.isSafeInteger(payload.userId)) throw new Error();
      const actor = await prisma.user.findFirst({ where: { id: payload.userId as number, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true } });
      if (!actor) throw new Error();
      socket.data.userId = actor.id; socket.data.expires = Number(payload.exp) * 1000;
      done();
    } catch { done(new Error("Connexion requise.")); }
  });
  io.on("connection", (socket) => {
    const userId: number = socket.data.userId;
    void socket.join(userRoom(userId));
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expires - Date.now()));
    let budget = 0; let resetAt = Date.now();
    socket.use((_, nextPacket) => {
      if (Date.now() > resetAt + 10000) { budget = 0; resetAt = Date.now(); }
      if (++budget > 100 || Date.now() >= socket.data.expires) return nextPacket(new Error("Veuillez patienter ou vous reconnecter."));
      nextPacket();
    });
    const online = (id: number) => (io.sockets.adapter.rooms.get(userRoom(id))?.size || 0) > 0;
    const presence = () => { for (const peer of io.sockets.sockets.values()) if (peer.data.peerId === userId) peer.emit("chat:presence", { userId, online: online(userId) }); };
    presence();
    type Input = { requestId: number; ids: number[]; nonce: string; text: string; latitude?: number; longitude?: number; typing?: boolean };
    function handle(event: string, action: (input: Input) => Promise<unknown>) {
      socket.on(event, async (input, ack) => {
        try { const result = await action(input); if (typeof ack === "function") ack({ ok: true, result }); }
        catch (e) { if (typeof ack === "function") ack({ ok: false, error: e instanceof Error ? e.message : "Action impossible." }); }
      });
    }
    handle("chat:open", async ({ requestId }) => {
      const generation = socket.data.generation = (socket.data.generation || 0) + 1;
      const { peerId } = await chatParticipant(userId, requestId);
      if (socket.data.generation !== generation) throw new Error("Conversation changée.");
      socket.data.activeId = requestId; socket.data.peerId = peerId;
      return { online: online(peerId), peerId, actorId: userId };
    });
    handle("chat:close", async () => { socket.data.generation = (socket.data.generation || 0) + 1; socket.data.activeId = null; socket.data.peerId = null; });
    handle("chat:pending", async () => {
      const actor = await prisma.user.findFirst({ where: { id: userId, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true } });
      if (!actor) throw new Error("Connexion requise.");
      return prisma.chatMessage.findMany({ where: { senderId: { not: userId }, deliveredAt: null, request: { OR: [{ clientId: userId }, { professionalId: userId }] } }, select: { id: true, requestId: true }, orderBy: { id: "asc" }, take: 200 });
    });
    handle("chat:send", (input) => sendChatMessage(userId, input));
    handle("chat:delivered", ({ requestId, ids }) => receipt(userId, requestId, ids, false));
    handle("chat:read", async ({ requestId, ids }) => {
      if (socket.data.activeId !== requestId) throw new Error("Ouvrez la conversation.");
      await receipt(userId, requestId, ids, true);
    });
    handle("chat:typing", async ({ requestId, typing }) => {
      const { peerId } = await chatParticipant(userId, requestId);
      io.to(userRoom(peerId)).emit("chat:typing", { requestId, userId, typing: Boolean(typing) });
    });
    socket.on("disconnect", () => { clearTimeout(expiry); presence(); });
  });
  http.listen(port, hostname, () => console.log(`HomeFix: http://localhost:${port}`));
  const stop = () => { io.close(); http.close(); void prisma.$disconnect().finally(() => process.exit(0)); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
main().catch((error) => { console.error(error); process.exit(1); });
