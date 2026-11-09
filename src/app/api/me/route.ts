import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Non authentifie" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      isSuspended: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Introuvable" },
      { status: 404 },
    );
  }

  if (user.isSuspended) return NextResponse.json({ error: "Ce compte est suspendu." }, { status: 403 });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
}
