import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(120),
  businessName: z.string().trim().min(2, "Le nom professionnel doit contenir au moins 2 caractères").max(120),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254),
  phone: z.string().trim().refine((value) => !value || /^\+216\s?\d{8}$/.test(value), "Saisissez un numéro tunisien valide (+216 suivi de 8 chiffres)"),
  specialty: z.string().trim().min(2, "Indiquez votre spécialité").max(120),
  experience: z.string().trim().min(1, "Indiquez votre expérience").max(120),
  serviceCity: z.string().trim().min(2, "Indiquez votre ville d’intervention").max(120),
  coveredAreas: z.string().trim().min(2, "Indiquez vos zones d’intervention").max(1000),
  priceRange: z.string().trim().max(160),
  description: z.string().trim().max(2000),
  currentPassword: z.string().max(200).optional(),
  isPublic: z.boolean().optional(),
  experienceYears: z.number().int().min(0).max(80).nullable().optional(),
  priceMin: z.number().int().min(0).max(100000).nullable().optional(),
  priceMax: z.number().int().min(0).max(100000).nullable().optional(),
  availability: z.enum(["AVAILABLE", "THIS_WEEK", "BUSY"]).nullable().optional(),
}).strict().refine((data) => data.priceMax == null || (data.priceMin != null && data.priceMax >= data.priceMin), { message: "Renseignez un tarif minimum inférieur ou égal au tarif maximum." });

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Origine invalide." }, { status: 403 }); }
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, password: true, role: true, status: true } });
  if (!user || user.role !== "PROFESSIONAL" || user.status !== "APPROVED") return NextResponse.json({ error: "Cette action est réservée aux professionnels approuvés." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Vérifiez les informations saisies." }, { status: 400 });
  const { currentPassword, ...profile } = parsed.data;

  if (profile.email !== user.email) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
      return NextResponse.json({ error: "Saisissez votre mot de passe actuel pour modifier l’adresse e-mail." }, { status: 403 });
    }
    const existing = await prisma.user.findFirst({ where: { email: profile.email, id: { not: user.id } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée." }, { status: 409 });
  }

  const result = await prisma.user.updateMany({
    where: { id: user.id, role: "PROFESSIONAL", status: "APPROVED" },
    data: { ...profile, phone: profile.phone || null, priceRange: profile.priceRange || null, description: profile.description || null },
  });
  if (result.count !== 1) return NextResponse.json({ error: "Votre compte ne peut plus être modifié." }, { status: 409 });
  return NextResponse.json({ message: "Votre profil professionnel a été mis à jour." });
}
