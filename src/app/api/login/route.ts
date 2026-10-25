import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/prisma";
import { loginSchema } from "@/app/lib/validation";
import { createSession } from "@/app/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
  });

  const isValid =
    user ? await bcrypt.compare(password, user.password) : false;

  if (!isValid || !user) {
    return NextResponse.json(
      { error: "Identifiants invalides" },
      { status: 401 },
    );
  }

  if (user.role === "PROFESSIONAL" && user.status !== "APPROVED") {
    return NextResponse.json(
      { error: user.status === "REJECTED"
        ? `Votre dossier professionnel a été refusé.${user.verificationReason ? ` Motif : ${user.verificationReason}` : " Contactez HomeFix pour plus d’informations."}`
        : "Votre profil professionnel est en attente de vérification. Vous pourrez vous connecter dès qu’il sera validé." },
      { status: 403 },
    );
  }

  await createSession(user.id);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}
