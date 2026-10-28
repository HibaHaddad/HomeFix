import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { visibleProfessional } from "@/app/lib/professional-directory";
import { getClient } from "@/app/lib/client-access";
import { ProfessionalAvatar } from "@/components/client/ProfessionalCard";
import ProfessionalClientActions from "@/components/client/ProfessionalClientActions";
import ProfessionalContact from "@/components/client/ProfessionalContact";
import Icon from "@/components/professional/ProfessionalIcon";
import { availabilityLabels } from "@/lib/directory-filters";

export const metadata = { title: "Profil professionnel | HomeFix" };
export default async function ProfessionalProfilePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ action?: string; retour?: string }>;
}) {
  const client = await getClient();
  if (!client) return null;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const p = await prisma.user.findFirst({ where: { ...visibleProfessional, id }, select: {
    id: true, name: true, businessName: true, specialty: true, description: true, experience: true,
    experienceYears: true, serviceCity: true, coveredAreas: true, priceRange: true, priceMin: true,
    priceMax: true, availability: true, verifiedAt: true, profilePhotoMime: true, phone: true,
  } });
  if (!p) notFound();
  const [reviews, summary] = await Promise.all([
    prisma.professionalReview.findMany({ where: { professionalId: id, published: true }, select: { id: true, rating: true, comment: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 }),
    prisma.professionalReview.aggregate({ where: { professionalId: id, published: true }, _avg: { rating: true }, _count: true }),
  ]);
  const [favorite, unassigned] = await Promise.all([
    prisma.favorite.findUnique({ where: { clientId_professionalId: { clientId: client.id, professionalId: id } }, select: { professionalId: true } }),
    prisma.serviceRequest.findMany({ where: { clientId: client.id, professionalId: null, status: "SENT" }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const search = await searchParams;
  const back = typeof search.retour === "string" && /^\/dashboard\/professionnels(?:\?|$)/.test(search.retour) ? search.retour : "/dashboard/professionnels";
  const price = p.priceMin !== null ? p.priceMax !== null && p.priceMax !== p.priceMin ? `${p.priceMin}–${p.priceMax} TND` : `Dès ${p.priceMin} TND` : p.priceRange || "Sur devis";
  return <>
    <Link className="client-back" href={back}><Icon name="chevron-left" size={17}/> Retour aux professionnels</Link>
    <section className="client-profile-hero"><ProfessionalAvatar id={p.id} name={p.name} hasPhoto={!!p.profilePhotoMime}/><div><span className="eyebrow">{p.specialty || "SERVICES À DOMICILE"}</span><h1>{p.businessName || p.name}</h1><p>{p.businessName && `${p.name} · `}{p.serviceCity || "Zone non renseignée"}</p><div className="client-profile-badges">{p.verifiedAt && <span><Icon name="shield" size={15}/> Profil vérifié par HomeFix</span>}<span><Icon name="star" size={15}/>{summary._avg.rating !== null ? `${summary._avg.rating.toFixed(1)} / 5 · ${summary._count} avis` : "Pas encore d’avis"}</span></div></div><a className="button button-dark" href="#contact">Demander un devis <Icon name="arrow" size={16}/></a></section>
    <div className="client-profile-layout"><div className="client-profile-sections">
      <section className="client-panel"><span className="eyebrow">FAISONS CONNAISSANCE</span><h2>À propos</h2><p className="client-pre-wrap">{p.description || "Ce professionnel n’a pas encore ajouté de présentation. Contactez-le pour discuter de votre projet."}</p></section>
      <section className="client-panel"><h2>Services & savoir-faire</h2><span className="directory-specialty">{p.specialty || "Services non renseignés"}</span><dl className="client-profile-facts"><div><dt>Expérience</dt><dd>{p.experienceYears !== null ? `${p.experienceYears} ans` : p.experience || "Non renseignée"}</dd></div><div><dt>Zone principale</dt><dd>{p.serviceCity || "Non renseignée"}</dd></div><div><dt>Zones d’intervention</dt><dd>{p.coveredAreas || "À confirmer avec le professionnel"}</dd></div><div><dt>Disponibilité annoncée</dt><dd>{p.availability ? availabilityLabels[p.availability] : "À confirmer"}</dd></div></dl></section>
      <section className="client-panel"><h2>Avis clients <small>({summary._count})</small></h2>{reviews.length ? <><p>Les {reviews.length} derniers avis publiés.</p>{reviews.map((r) => <article className="client-review" key={r.id}><div><strong>Client HomeFix</strong><time>{r.createdAt.toLocaleDateString("fr-TN")}</time></div><span className="client-review-rating">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} · {r.rating}/5</span><p>{r.comment}</p></article>)}</> : <div className="client-reviews-empty"><Icon name="star" size={25}/><p>Ce professionnel n’a pas encore reçu d’avis publié.</p></div>}</section>
      <ProfessionalClientActions professionalId={p.id} favorite={!!favorite} unassigned={unassigned}/>
      <ProfessionalContact professionalId={p.id} initialKind={search.action === "message" ? "MESSAGE" : "QUOTE"}/>
    </div><aside className="client-profile-aside"><section className="client-panel"><span className="eyebrow">VOTRE PROJET COMMENCE ICI</span><h2>{price}</h2><p>Tarif indicatif. Le montant final et la disponibilité sont à confirmer ensemble.</p><a className="button button-dark" href="#contact">Demander un devis</a>{p.phone && /^\+?[\d\s]{8,20}$/.test(p.phone) && <a className="button button-outline" href={`tel:${p.phone.replace(/\s/g, "")}`}>Appeler le professionnel</a>}<a className="client-contact-link" href="#contact">Envoyer un message <Icon name="message" size={15}/></a></section><div className="directory-trust"><Icon name="shield" size={24}/><strong>Un accord clair, avant tout.</strong><p>Discutez des détails et du tarif avant de confirmer votre intervention.</p></div></aside></div>
  </>;
}
