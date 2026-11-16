import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/prisma";
import { registerSchema } from "@/app/lib/validation";
import { createSession } from "@/app/lib/session";
import { resolveServiceCategory } from "@/app/lib/service-categories";

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Le formulaire reçu est invalide" }, { status: 400 });
  }

  const body = Object.fromEntries(
    Array.from(formData.entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const {
    firstName, lastName, email, password, role, phone, address, city,
    businessName, specialty, description, experience, serviceCity, coveredAreas,
    priceRange,
  } = parsed.data;

  const uploadedCertification = formData.get("certification");
  let certificationPdf: Uint8Array<ArrayBuffer> | null = null;
  if (uploadedCertification instanceof File && uploadedCertification.size > 0) {
    if (uploadedCertification.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Le PDF ne doit pas dépasser 5 Mo" }, { status: 400 });
    }

    if (!uploadedCertification.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Le justificatif doit être un fichier PDF" }, { status: 400 });
    }

    const fileBytes = new Uint8Array(await uploadedCertification.arrayBuffer());
    const signature = new TextDecoder().decode(fileBytes.slice(0, 5));
    if (signature !== "%PDF-") {
      return NextResponse.json({ error: "Le fichier joint n’est pas un PDF valide" }, { status: 400 });
    }
    certificationPdf = fileBytes;
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Cet email est deja utilise" },
      { status: 409 },
    );
  }

  const isProfessional = role === "PROFESSIONAL";
  const category = isProfessional ? await resolveServiceCategory(specialty ?? "") : null;
  if (isProfessional && !category?.isActive) return NextResponse.json({ error: "Choisissez une catégorie active. Actualisez le formulaire si nécessaire." }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async tx => {
    // Hold a shared lock until the new profile is linked; deletion/deactivation waits.
    const current = category ? (await tx.$queryRaw<{ id: number; name: string }[]>`SELECT id, name FROM "ServiceCategory" WHERE id = ${category.id} AND "isActive" = true FOR SHARE`)[0] : null;
    if (isProfessional && !current) return null;
    return tx.user.create({
    data: {
      name: `${firstName} ${lastName}`,
      email,
      password: hash,
      role,
      status: isProfessional ? "PENDING_VERIFICATION" : "ACTIVE",
      phone,
      address: role === "CLIENT" ? address || null : null,
      city: role === "CLIENT" ? city || null : null,
      businessName: isProfessional ? businessName : null,
      specialty: current?.name ?? null,
      categoryId: current?.id ?? null,
      description: isProfessional ? description || null : null,
      experience: isProfessional ? experience : null,
      serviceCity: isProfessional ? serviceCity : null,
      coveredAreas: isProfessional ? coveredAreas : null,
      priceRange: isProfessional ? priceRange || null : null,
      certificationPdf: isProfessional ? certificationPdf : null,
      termsAccepted: true,
    },
  });
  });
  if (!user) return NextResponse.json({ error: "Cette catégorie n’est plus disponible. Actualisez le formulaire." }, { status: 400 });

  if (!isProfessional) {
    await createSession(user.id);
  }

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      message: isProfessional
        ? "Votre inscription est enregistrée. Votre profil restera en attente de vérification."
        : "Votre compte a été créé.",
    },
    { status: 201 },
  );
}
