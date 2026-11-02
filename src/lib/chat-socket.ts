"use client";
import { io, type Socket } from "socket.io-client";
let socket: Socket | undefined;
export function getChatSocket() {
  if (!socket) socket = io({ autoConnect: false, retries: 3, ackTimeout: 10000 });
  return socket;
}
export async function chatCommand<T = unknown>(event: string, input: unknown): Promise<T> {
  const socket = getChatSocket();
  if (!socket.connected) throw new Error("Connexion interrompue. Patientez jusqu’à la reconnexion.");
  const response = await socket.emitWithAck(event, input);
  if (!response.ok) throw new Error(response.error || "Action impossible.");
  return response.result;
}
