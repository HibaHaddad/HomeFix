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
    select: { name: true, email: true, phone: true, address: true, city: true, role: true, status: true, businessName: true, specialty: true, description: true, experience: true, serviceCity: true, coveredAreas: true, priceRange: true, createdAt: true, isPublic: true, experienceYears: true, priceMin: true, priceMax: true, availability: true },
  });
  if (!user || user.role !== "PROFESSIONAL") notFound();
  if (user.status !== "APPROVED") notFound();
  if (section === "demandes" || section === "messagerie") {
    const requests = await prisma.serviceRequest.findMany({
      where: { professionalId: session.userId, ...(section === "messagerie" ? { kind: "MESSAGE" } : {}) },
      select: { id: true, kind: true, message: true, createdAt: true, client: { select: { name: true, email: true, phone: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    });
    return <><div className="pro-page-heading"><div><div className="pro-eyebrow">VOTRE ACTIVITÉ</div><h1>{section === "messagerie" ? "Messages clients" : "Demandes de service"}</h1><p>Les 100 dernières demandes reçues. Répondez directement au client par e-mail ou téléphone.</p></div></div><div className="pro-incoming-requests">{requests.length ? requests.map((r) => <article className="pro-panel pro-incoming-request" key={r.id}><span>{r.kind === "QUOTE" ? "DEMANDE DE DEVIS" : "PRISE DE CONTACT"} · #{r.id}</span><h2>{r.client.name}</h2><time>{r.createdAt.toLocaleString("fr-TN", { timeZone: "Africa/Tunis" })}</time><p>{r.message}</p><div><a href={`mailto:${r.client.email}?subject=${encodeURIComponent(`HomeFix — Réponse à votre demande #${r.id}`)}`}>Répondre par e-mail ↗</a>{r.client.phone && /^\+?[\d\s]{8,20}$/.test(r.client.phone) && <a href={`tel:${r.client.phone.replace(/\s/g, "")}`}>Appeler le client ↗</a>}</div></article>) : <section className="pro-panel"><div className="pro-empty"><h3>Aucune demande pour le moment</h3><p>Les prises de contact et demandes de devis des clients apparaîtront ici.</p></div></section>}</div></>;
  }
  const photoState = section === "profil" ? await prisma.$queryRaw<Array<{ hasPhoto: boolean }>>`
    SELECT "profilePhotoMime" IS NOT NULL AS "hasPhoto"
    FROM "User" WHERE "id" = ${session.userId}
  ` : [];
  return <ProfessionalSection section={section} user={user} hasProfilePhoto={photoState[0]?.hasPhoto ?? false} />;
}
