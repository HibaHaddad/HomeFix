import { adminMutation } from "@/app/lib/admin-http";
import { adminObject, adminText } from "@/lib/admin-validation";
import { decideSanction } from "@/app/lib/sanctions";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const input = adminObject(await request.json().catch(() => null), ["action","reason","reviewed"]);
    return Response.json(await decideSanction(adminText((await params).id, "Dossier", 1, 40), adminText(input.action, "Action", 1, 30), adminText(input.reason, "Motif de décision", 10, 2000), admin, input.reviewed === "YES"));
  });
}
