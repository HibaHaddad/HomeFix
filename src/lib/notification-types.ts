export type WorkspaceNotification = { id: number; title: string; href: string; createdAt: string; type: string };
export type NotificationRecord = WorkspaceNotification & { readAt: string | null };
export type NotificationReadEvent = { unreadCount: number; all: boolean; ids: number[] };
export type InterventionUpdate = { requestId: number; status: string };
