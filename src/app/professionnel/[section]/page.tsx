import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import ProfessionalSection from "@/components/professional/ProfessionalSection";

const sections = ["tableau-de-bord", "demandes", "reservations", "interventions", "messagerie", "profil", "revenus", "avis", "notifications", "parametres"] as const;

export default async function ProfessionalPage({ params }: PageProps<"/professionnel/[section]">) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  const session = await getSession();
  if (!session) notFound();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, phone: true, address: true, city: true, role: true, status: true, businessName: true, specialty: true, description: true, experience: true, serviceCity: true, coveredAreas: true, priceRange: true, createdAt: true },
  });
  if (!user || user.role !== "PROFESSIONAL") notFound();
  const photoState = section === "profil" ? await prisma.$queryRaw<Array<{ hasPhoto: boolean }>>`
    SELECT "profilePhotoMime" IS NOT NULL AS "hasPhoto"
    FROM "User" WHERE "id" = ${session.userId}
  ` : [];
  return <ProfessionalSection section={section} user={user} hasProfilePhoto={photoState[0]?.hasPhoto ?? false} />;
}
