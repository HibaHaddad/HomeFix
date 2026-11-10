import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import ProfessionalReviewActions from "@/components/admin/ProfessionalReviewActions";
import AdminIcon from "@/components/admin/AdminIcon";
import "../professionals.css";
import { requireAdminPage } from "@/app/lib/admin-access";

export default async function ProfessionalReviewDetail({ params }: PageProps<"/admin/professionnels/[id]">) {
  await requireAdminPage();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const professional = await prisma.user.findFirst({
    where: { id, role: "PROFESSIONAL" },
    select: { id: true, name: true, email: true, phone: true, address: true, city: true, businessName: true, specialty: true, description: true, experience: true, serviceCity: true, coveredAreas: true, priceRange: true, createdAt: true, status: true, isSuspended: true, termsAccepted: true, verificationReason: true, verifiedAt: true, verifiedById: true },
  });
  if (!professional) notFound();
  const [verifier, certification] = await Promise.all([
    professional.verifiedById
      ? prisma.user.findFirst({ where: { id: professional.verifiedById, role: "ADMIN" }, select: { name: true } })
      : Promise.resolve(null),
    prisma.user.findFirst({ where: { id, role: "PROFESSIONAL", certificationPdf: { not: null } }, select: { id: true } }),
  ]);
  const hasCertification = certification !== null;
  const approvalRequirements = [
    ["Nom commercial", professional.businessName],
    ["Spécialité", professional.specialty],
    ["Expérience", professional.experience],
    ["Ville d’intervention", professional.serviceCity],
    ["Zones couvertes", professional.coveredAreas],
  ] as const;
  const missingRequirements: string[] = approvalRequirements.filter(([, value]) => !value?.trim() || value.trim().length < 2).map(([label]) => label);
  if (!professional.termsAccepted) missingRequirements.push("Acceptation des conditions");
  const approvalReady = missingRequirements.length === 0;
  const dossier = [
    ["Nom du professionnel", professional.name], ["Nom commercial", professional.businessName],
    ["Adresse e-mail", professional.email], ["Téléphone", professional.phone],
    ["Adresse", professional.address], ["Ville", professional.city],
    ["Spécialité", professional.specialty], ["Expérience", professional.experience],
    ["Ville d’intervention", professional.serviceCity], ["Zones couvertes", professional.coveredAreas],
    ["Fourchette de prix", professional.priceRange], ["Présentation", professional.description],
    ["Inscription reçue le", professional.createdAt.toLocaleDateString("fr-FR", { dateStyle: "long" })],
  ] as const;
  const statusLabel = professional.status === "APPROVED" ? "Approuvé" : professional.status === "REJECTED" ? "Refusé" : "En attente";

  return <div className="admin-content">
    <Link href="/admin/professionnels" className="admin-back-link"><AdminIcon name="back" size={15}/>Retour aux dossiers</Link>
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>EXAMEN DU DOSSIER</div><h1>{professional.businessName || professional.name}</h1><p>Vérifiez les informations et les justificatifs transmis.</p></div><div className="admin-professional-detail-badges"><span className={`admin-status status-${professional.status.toLowerCase()}`}>{statusLabel}</span><span className={`admin-professional-account ${professional.isSuspended ? "is-suspended" : "is-active"}`}>{professional.isSuspended ? "Compte suspendu" : "Compte actif"}</span></div></div>
    <section className="admin-card admin-dossier-card"><div className="admin-card-heading"><div><span>INFORMATIONS DÉCLARÉES</span><h2>Dossier professionnel</h2></div></div><dl className="admin-dossier-grid">{dossier.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Non renseigné"}</dd></div>)}</dl>
      <div className="admin-documents"><div><span>JUSTIFICATIF</span><h3>Document de vérification</h3><p>{hasCertification ? "Un document PDF a été transmis avec cette inscription." : "Aucun document justificatif n’a été transmis."}</p></div>{hasCertification && <a className="admin-button admin-button-light" href={`/api/admin/professionnels/${professional.id}/document`} target="_blank" rel="noreferrer">Voir le document ↗</a>}</div>
      {professional.status === "REJECTED" && professional.verificationReason && <div className="admin-rejection-reason"><strong>Motif du refus enregistré</strong><p>{professional.verificationReason}</p></div>}
    </section>
    {professional.status === "PENDING_VERIFICATION" && <ProfessionalReviewActions professionalId={professional.id} professionalName={professional.businessName || professional.name} approvalReady={approvalReady} missingRequirements={missingRequirements} />}
    {professional.status !== "PENDING_VERIFICATION" && <section className="admin-professional-decision-meta" aria-label="Décision de vérification"><span>Conditions acceptées : {professional.termsAccepted ? "Oui" : "Non"}</span><span>Date de vérification : {professional.verifiedAt ? professional.verifiedAt.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" }) : "Non renseignée"}</span><span>Décision prise par : {verifier?.name || "Non disponible"}</span></section>}
  </div>;
}
