export type ChatMessage = {
  id: number; requestId: number; senderId: number; clientNonce: string | null;
  text: string; latitude: number | null; longitude: number | null;
  deliveredAt: string | null; readAt: string | null; createdAt: string;
  attachments: { id: number; name: string; mime: string; size: number }[];
  quote: { id: number; requestId: number; amountMillimes: number; status: string; validUntil: string; request: { status: string; booking: { status: string; startsAt: string; endsAt: string } | null } } | null;
};
