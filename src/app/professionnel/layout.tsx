import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import ProfessionalWorkspace from "@/components/professional/ProfessionalWorkspace";
import ChatNotifications from "@/components/ChatNotifications";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import "../dashboard/notifications.css";
import "../dashboard/realtime-chat.css";
import "./professional.css";
import "../dashboard/workspace.css";
import "../dashboard/client-theme.css";
import "../dashboard/intervention-flow.css";
import "./agenda.css";
import "../dashboard/payments.css";

export default async function ProfessionalLayout({ children }: LayoutProps<"/professionnel">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, role: true, status: true, isSuspended: true, businessName: true, specialty: true } });
  if (!user) redirect("/login");
  if (user.role !== "PROFESSIONAL") redirect("/dashboard");
  if (user.status !== "APPROVED" || user.isSuspended) redirect("/login");

  const photoState = await prisma.$queryRaw<Array<{ hasPhoto: boolean }>>`
    SELECT "profilePhotoMime" IS NOT NULL AS "hasPhoto"
    FROM "User" WHERE "id" = ${user.id}
  `;

  const unreadCount = await prisma.clientNotification.count({ where: { userId: user.id, readAt: null } });
  return <NotificationProvider key={user.id} initialUnread={unreadCount}><ProfessionalWorkspace user={{ ...user, hasProfilePhoto: photoState[0]?.hasPhoto ?? false }}><ChatNotifications userId={user.id} professional/>{children}</ProfessionalWorkspace></NotificationProvider>;
}
