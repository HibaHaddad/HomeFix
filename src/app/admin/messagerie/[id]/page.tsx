import { notFound } from "next/navigation";
import { requireAdminPage } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { AdminSection } from "@/components/admin/AdminWorkspace";
import AdminConversationReader from "@/components/admin/AdminConversationReader";
export default async function ConversationPage({ params }: PageProps<"/admin/messagerie/[id]">) {
  await requireAdminPage();
  const raw = (await params).id;
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) notFound();
  const conversation = await prisma.serviceRequest.findFirst({ where: { id, conversationId: null }, select: { title: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } } } });
  if (!conversation) notFound();
  return <AdminSection title={`Conversation #${id}`} description={`${conversation.client.name} · ${conversation.professional.businessName || conversation.professional.name} · ${conversation.title}`}><AdminConversationReader id={id}/></AdminSection>;
}
