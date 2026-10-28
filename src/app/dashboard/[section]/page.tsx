import { notFound } from "next/navigation";
import { getClient } from "@/app/lib/client-access";
import { clientWorkspace, requestInclude, type WorkspaceData } from "@/app/lib/client-workspace";
import { prisma } from "@/app/lib/prisma";
import ClientWorkspace from "@/components/client/ClientWorkspace";
const allowed = ["demandes", "messagerie", "devis", "reservations", "interventions", "paiements", "avis", "logement", "favoris", "assistant", "notifications", "profil", "reclamations"];
export default async function ClientSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ demande?: string; before?: string }> }) {
  const { section } = await params;
  if (!allowed.includes(section)) notFound();
  const client = await getClient();
  if (!client) return null;
  const search = await searchParams;
  const selected = Number(search.demande);
  const cursor = Number(search.before);
  const workspace = await clientWorkspace(client.id, Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined);
  if (Number.isSafeInteger(selected) && selected > 0 && !workspace.requests.some((r) => r.id === selected)) {
    const record = await prisma.serviceRequest.findFirst({ where: { id: selected, clientId: client.id }, include: requestInclude });
    if (record) workspace.requests.unshift(record);
  }
  const data = JSON.parse(JSON.stringify(workspace)) as WorkspaceData;
  return <ClientWorkspace section={section} data={data} selected={Number.isSafeInteger(selected) && selected > 0 ? selected : undefined}/>;
}
