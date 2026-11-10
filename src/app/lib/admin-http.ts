import "server-only";
import { requireAdmin } from "./admin-access";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { AdminActionError } from "@/lib/admin-validation";
import { Prisma } from "@/generated/prisma/client";

export async function adminMutation(request: Request, run: (admin: { id: number; name: string }) => Promise<Response>) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  try { return await run(access.admin); }
  catch (error) {
    if (error instanceof AdminActionError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return Response.json({ error: "Cette action a déjà été traitée ou les données ont changé. Actualisez la page." }, { status: 409 });
    console.error("[Admin action]", error);
    return Response.json({ error: "Action indisponible. Réessayez dans un instant." }, { status: 503 });
  }
}
