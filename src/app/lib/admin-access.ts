import "server-only";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { adminUsersErrorResponse } from "@/app/lib/admin-users";

export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: "Connexion requise." }, { status: 401 }) } as const;
  }

  let admin;
  try {
    admin = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, role: true },
    });
  } catch (error) {
    return { error: adminUsersErrorResponse(error, "checking administrator access") } as const;
  }
  if (!admin || admin.role !== "ADMIN") {
    return { error: Response.json({ error: "Accès réservé aux administrateurs." }, { status: 403 }) } as const;
  }
  return { admin } as const;
}
