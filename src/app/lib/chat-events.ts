import type { Server } from "socket.io";
const hub = globalThis as typeof globalThis & { homefixIO?: Server };
export function setChatServer(io: Server) { hub.homefixIO = io; }
export function chatServer() { return hub.homefixIO; }
export const userRoom = (id: number) => `user:${id}`;
