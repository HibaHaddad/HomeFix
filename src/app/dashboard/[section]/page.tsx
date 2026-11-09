import { notFound } from "next/navigation";
import { getClient } from "@/app/lib/client-access";
import { clientWorkspace, requestInclude, type WorkspaceData } from "@/app/lib/client-workspace";
import { prisma } from "@/app/lib/prisma";
import ClientWorkspace from "@/components/client/ClientWorkspace";
import HomeFixHelp from "@/components/support/HomeFixHelp";
import AssistantChat from "@/components/client/AssistantChat";
const allowed = ["demandes", "messagerie", "devis", "reservations", "interventions", "paiements", "avis", "logement", "favoris", "assistant", "notifications", "profil", "reclamations"];
export default async function ClientSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ demande?: string; before?: string }> }) {
  const { section } = await params;
  if (!allowed.includes(section)) notFound();
  const client = await getClient();
  if (!client) return null;
  if (section === "assistant") return <AssistantChat/>;
  const search = await searchParams;
  const selected = Number(search.demande);
  if (section === "reclamations") {
    const [contact, intervention] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: client.id }, select: { email: true } }),
      Number.isSafeInteger(selected) && selected > 0
        ? prisma.serviceRequest.findFirst({ where: { id: selected, clientId: client.id }, select: { title: true } })
        : null,
    ]);
    return <HomeFixHelp name={client.name} email={contact.email} initialIntervention={intervention?.title} />;
  }
  const cursor = Number(search.before);
  const workspace = await clientWorkspace(client.id, Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined, section === "interventions" && Number.isSafeInteger(selected) && selected > 0 ? selected : undefined);
  if (Number.isSafeInteger(selected) && selected > 0 && !workspace.requests.some((r) => r.id === selected)) {
    const record = await prisma.serviceRequest.findFirst({ where: { id: selected, clientId: client.id }, include: requestInclude });
    if (record) { if (record.kind === "MESSAGE") workspace.conversations.unshift(record); else workspace.requests.unshift(record); }
  }
  const parentId = workspace.requests.find((r) => r.id === selected)?.conversationId;
  if (parentId && !workspace.conversations.some((r) => r.id === parentId)) {
    const thread = await prisma.serviceRequest.findFirst({ where: { id: parentId, clientId: client.id }, include: requestInclude });
    if (thread) workspace.conversations.unshift(thread);
  }
  const data = JSON.parse(JSON.stringify(workspace)) as WorkspaceData;
  return <ClientWorkspace section={section} data={data} selected={Number.isSafeInteger(selected) && selected > 0 ? selected : undefined}/>;
}
