import { getClient } from "@/app/lib/client-access";
import { clientWorkspace, type WorkspaceData } from "@/app/lib/client-workspace";
import ClientWorkspace from "@/components/client/ClientWorkspace";
export const metadata = { title: "Mon espace client | HomeFix TN" };
export default async function DashboardPage() {
  const client = await getClient();
  if (!client) return null;
  const data = JSON.parse(JSON.stringify(await clientWorkspace(client.id))) as WorkspaceData;
  return <ClientWorkspace data={data}/>;
}
