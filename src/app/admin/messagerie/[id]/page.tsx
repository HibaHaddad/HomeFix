import { notFound } from "next/navigation";
import { requireAdminPage } from "@/app/lib/admin-access";
import { adminMessagingData } from "@/app/lib/admin-messaging";
import AdminMessagingPage from "@/components/admin/AdminMessagingPage";
import "../../../dashboard/realtime-chat.css";
import "../messaging.css";

export default async function ConversationPage({ params, searchParams }: PageProps<"/admin/messagerie/[id]">) {
  await requireAdminPage();
  const raw = (await params).id;
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) notFound();
  const model = await adminMessagingData(await searchParams, id);
  if (!model.selected) notFound();
  return <AdminMessagingPage model={model} openThread/>;
}
