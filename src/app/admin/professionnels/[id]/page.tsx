import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import ProfessionalReviewActions from "@/components/admin/ProfessionalReviewActions";
import AdminIcon from "@/components/admin/AdminIcon";

export default async function ProfessionalReviewDetail({ params }: PageProps<"/admin/professionnels/[id]">) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const professional = await prisma.user.findFirst({
    where: { id, role: "PROFESSIONAL" },
    select: { id: true, name: true, email: true, phone: true, businessName: true, specialty: true, description: true, experience: true, serviceCity: true, coveredAreas: true, priceRange: true, createdAt: true, status: true, verificationReason: true, verifiedAt: true, certificationPdf: true },
  });
  if (!professional) notFound();
  const dossier = [
    ["Nom du professionnel", professional.name], ["Nom commercial", professional.businessName],
    ["Adresse e-mail", professional.email], ["Téléphone", professional.phone],
    ["Spécialité", professional.specialty], ["Expérience", professional.experience],
    ["Ville d’intervention", professional.serviceCity], ["Zones couvertes", professional.coveredAreas],
    ["Fourchette de prix", professional.priceRange], ["Présentation", professional.description],
    ["Inscription reçue le", professional.createdAt.toLocaleDateString("fr-FR", { dateStyle: "long" })],
  ] as const;
  const statusLabel = professional.status === "APPROVED" ? "Approuvé" : professional.status === "REJECTED" ? "Refusé" : "En attente";

  return <div className="admin-content">
    <Link href="/admin/professionnels" className="admin-back-link"><AdminIcon name="back" size={15}/>Retour aux dossiers</Link>
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>EXAMEN DU DOSSIER</div><h1>{professional.businessName || professional.name}</h1><p>Vérifiez les informations et les justificatifs transmis.</p></div><span className={`admin-status status-${professional.status.toLowerCase()}`}>{statusLabel}</span></div>
    <section className="admin-card admin-dossier-card"><div className="admin-card-heading"><div><span>INFORMATIONS DÉCLARÉES</span><h2>Dossier professionnel</h2></div></div><dl className="admin-dossier-grid">{dossier.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Non renseigné"}</dd></div>)}</dl>
      <div className="admin-documents"><div><span>JUSTIFICATIF</span><h3>Document de vérification</h3><p>{professional.certificationPdf ? "Un document PDF a été transmis avec cette inscription." : "Aucun document justificatif n’a été transmis."}</p></div>{professional.certificationPdf && <a className="admin-button admin-button-light" href={`/api/admin/professionnels/${professional.id}/document`} target="_blank" rel="noreferrer">Voir le document ↗</a>}</div>
      {professional.status === "REJECTED" && professional.verificationReason && <div className="admin-rejection-reason"><strong>Motif du refus enregistré</strong><p>{professional.verificationReason}</p></div>}
    </section>
    {professional.status === "PENDING_VERIFICATION" && <ProfessionalReviewActions professionalId={professional.id} professionalName={professional.businessName || professional.name} />}
    {professional.status !== "PENDING_VERIFICATION" && professional.verifiedAt && <p className="admin-reviewed-at">Décision enregistrée le {professional.verifiedAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}.</p>}
  </div>;
}
