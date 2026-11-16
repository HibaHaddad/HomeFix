import { requireAdminPage } from "@/app/lib/admin-access";
import { adminMessagingData } from "@/app/lib/admin-messaging";
import AdminMessagingPage from "@/components/admin/AdminMessagingPage";
import "../../dashboard/realtime-chat.css";
import "./messaging.css";

export default async function ConversationsPage({ searchParams }: PageProps<"/admin/messagerie">) {
  await requireAdminPage();
  return <AdminMessagingPage model={await adminMessagingData(await searchParams)}/>;
}
