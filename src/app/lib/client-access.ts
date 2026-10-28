import { getSession } from "./session";
import { prisma } from "./prisma";

export async function getClient() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findFirst({
    where: { id: session.userId, role: "CLIENT", status: "ACTIVE" },
    select: { id: true, name: true },
  });
}
