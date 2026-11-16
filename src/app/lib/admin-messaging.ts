import "server-only";
import { prisma } from "./prisma";
import { adminConversations, opsFilters } from "./admin-operations";

export const adminConversationSummarySelect = {
  id: true, title: true, updatedAt: true,
  client: { select: { id: true, name: true, profilePhotoMime: true } },
  professional: { select: { id: true, name: true, businessName: true, profilePhotoMime: true } },
} as const;

export async function adminMessagingData(params: Record<string, string | string[] | undefined>, selectedId?: number) {
  const filters = opsFilters(params);
  const data = await adminConversations(filters);
  let selected = selectedId ? data.rows.find(row => row.id === selectedId) : data.rows[0];
  if (selectedId && !selected) {
    selected = await prisma.serviceRequest.findFirst({ where: { id: selectedId, conversationId: null }, select: adminConversationSummarySelect }) ?? undefined;
  }
  return { filters, data, selected: selected ?? null };
}
