import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import ProfessionalInteractions from "@/components/professional/ProfessionalInteractions";
import { requestInclude } from "@/app/lib/client-workspace";
import ProfessionalSection from "@/components/professional/ProfessionalSection";
import NotificationsCenter from "@/components/notifications/NotificationsCenter";
import ProfessionalReviews from "@/components/professional/ProfessionalReviews";
import ProfessionalPayments from "@/components/professional/ProfessionalPayments";
import ProfessionalHelp from "@/components/professional/ProfessionalHelp";

const sections = ["tableau-de-bord", "demandes", "reservations", "interventions", "messagerie", "profil", "revenus", "avis", "notifications", "parametres", "aide"] as const;

export default async function ProfessionalPage({ params, searchParams }: PageProps<"/professionnel/[section]">) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  const session = await getSession();
  if (!session) notFound();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, phone: true, address: true, city: true, role: true, status: true, businessName: true, specialty: true, description: true, experience: true, serviceCity: true, coveredAreas: true, priceRange: true, createdAt: true, isPublic: true, experienceYears: true, priceMin: true, priceMax: true, availability: true },
  });
  if (!user || user.role !== "PROFESSIONAL") notFound();
  if (user.status !== "APPROVED") notFound();
  if (section === "aide") return <ProfessionalHelp name={user.businessName || user.name} email={user.email} />;
  if (section === "avis") return <ProfessionalReviews professionalId={session.userId}/>;
  if (section === "revenus") {
    const period = (await searchParams).periode;
    return <ProfessionalPayments professionalId={session.userId} period={typeof period === "string" ? period : undefined}/>;
  }
  if (section === "notifications") return <><div className="pro-page-heading"><div><div className="pro-eyebrow"><span/>VOTRE ACTIVITÉ</div><h1>Notifications</h1><p>Les nouvelles de vos clients et interventions, au même endroit.</p></div></div><NotificationsCenter/></>;
  if (section === "reservations") return <ProfessionalInteractions section={section} initialRequests={[]} initialSlots={[]}/>;
  if (["tableau-de-bord", "demandes", "messagerie", "reservations", "interventions"].includes(section)) {
    const [requests, slots] = await Promise.all([
      prisma.serviceRequest.findMany({ where: { professionalId: session.userId }, include: { ...requestInclude, client: { select: { id: true, name: true, phone: true, email: true } } }, orderBy: { id: "desc" }, take: 100 }),
      prisma.availabilitySlot.findMany({ where: { professionalId: session.userId, active: true, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 500 }),
    ]);
    const selected = Number((await searchParams).demande);
    if (Number.isSafeInteger(selected) && selected > 0 && !requests.some((r) => r.id === selected)) {
      const record = await prisma.serviceRequest.findFirst({ where: { id: selected, professionalId: session.userId }, include: { ...requestInclude, client: { select: { id: true, name: true, phone: true, email: true } } } });
      if (record) requests.unshift(record);
    }
    // A selected intervention can belong to an older conversation outside this page.
    const parentId = requests.find((r) => r.id === selected)?.conversationId;
    if (parentId && !requests.some((r) => r.id === parentId)) {
      const thread = await prisma.serviceRequest.findFirst({ where: { id: parentId, professionalId: session.userId }, include: { ...requestInclude, client: { select: { id: true, name: true, phone: true, email: true } } } });
      if (thread) requests.unshift(thread);
    }
    return <ProfessionalInteractions section={section} initialRequests={JSON.parse(JSON.stringify(requests))} initialSlots={JSON.parse(JSON.stringify(slots))} selected={Number.isSafeInteger(selected) ? selected : undefined}/>;
  }
  const photoState = section === "profil" ? await prisma.$queryRaw<Array<{ hasPhoto: boolean }>>`
    SELECT "profilePhotoMime" IS NOT NULL AS "hasPhoto"
    FROM "User" WHERE "id" = ${session.userId}
  ` : [];
  return <ProfessionalSection section={section} user={user} hasProfilePhoto={photoState[0]?.hasPhoto ?? false} />;
}
