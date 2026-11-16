import type { ChatMessage } from "./chat-types";

export type AdminConversationSummary = {
  id: number; title: string; updatedAt: string;
  client: { id: number; name: string; profilePhotoMime: string | null };
  professional: { id: number; name: string; businessName: string | null; profilePhotoMime: string | null };
};
export type AdminConversationAccess = {
  accessId: number; title: string; initialMessage: string | null; nextBefore: number | null;
  messages: (Omit<ChatMessage, "clientNonce"> & { sender: string })[];
  interventions: {
    id: number; title: string; category: string; status: string;
    booking: { status: string; startsAt: string; endsAt: string } | null;
    quotes: { id: number; amountMillimes: number; status: string; details: string }[];
  }[];
};
