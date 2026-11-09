import Link from "next/link";
import { ArrowLeft, ClipboardList, MessageSquare, UserRound } from "lucide-react";
import type { getAdminComplaintDetail } from "@/app/lib/admin-complaints";
import AdminComplaintResponseForm from "@/components/admin/AdminComplaintResponseForm";

type ComplaintDetail = NonNullable<Awaited<ReturnType<typeof getAdminComplaintDetail>>>;
const labels: Record<string, string> = { OPEN: "Ouverte", RESOLVED: "Résolue" };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" });

function label(status: string) {
  if (!status.trim()) return "Statut vide";
  return labels[status] ?? status.replaceAll("_", " ");
}

function Info({ title, value }: { title: string; value: string | number | null | undefined }) {
  return <div className="admin-complaint-info"><dt>{title}</dt><dd>{value === null || value === undefined || value === "" ? "Non renseigné" : value}</dd></div>;
}

export default function AdminComplaintDetail({ complaint }: { complaint: ComplaintDetail }) {
  return <div className="admin-content admin-complaint-detail-page">
    <Link href="/admin/reclamations" className="admin-back-link"><ArrowLeft size={14}/>Retour aux réclamations</Link>
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>RÉCLAMATION · #{complaint.id}</div><h1>{complaint.subject}</h1><p>Créée le {dateFormat.format(complaint.createdAt)}</p></div><span className="admin-status"><i/>{label(complaint.status)}</span></div>

    <div className="admin-complaint-detail-grid">
      <article className="admin-card admin-complaint-detail-card">
        <header className="admin-request-section-title"><span><MessageSquare size={17}/></span><div><h2>Message du client</h2><p>Contenu de la réclamation telle qu’enregistrée</p></div></header>
        <p className="admin-complaint-full-message">{complaint.message}</p>
        {complaint.response !== null && complaint.response !== "" ? <section className="admin-complaint-response"><strong>Réponse définitive enregistrée</strong><p>{complaint.response}</p></section> : <><p className="admin-complaint-no-response">Aucune réponse n’est enregistrée. Une réponse envoyée sera définitive.</p><AdminComplaintResponseForm complaintId={complaint.id}/></>}
      </article>

      <article className="admin-card admin-complaint-detail-card">
        <header className="admin-request-section-title"><span><UserRound size={17}/></span><div><h2>Client</h2><p>Informations de contact nécessaires au suivi</p></div></header>
        <dl className="admin-complaint-info-grid"><Info title="Nom" value={complaint.client.name}/><Info title="E-mail" value={complaint.client.email}/><Info title="Statut" value={label(complaint.status)}/><Info title="Création" value={dateTimeFormat.format(complaint.createdAt)}/></dl>
      </article>

      <article className="admin-card admin-complaint-detail-card">
        <header className="admin-request-section-title"><span><ClipboardList size={17}/></span><div><h2>Demande associée</h2><p>Demande liée, si elle a été indiquée par le client</p></div></header>
        {complaint.request ? <dl className="admin-complaint-info-grid"><Info title="Référence" value={`#${complaint.request.id}`}/><Info title="Sujet" value={complaint.request.title}/><Info title="Catégorie" value={complaint.request.category}/><Info title="Statut de la demande" value={complaint.request.status}/><Info title="Création de la demande" value={dateTimeFormat.format(complaint.request.createdAt)}/></dl> : <p className="admin-complaint-no-response">Cette réclamation concerne une question générale, sans demande associée.</p>}
      </article>
    </div>
    <p className="admin-complaint-readonly-note">Le statut n’est pas modifiable ici. Toute réponse envoyée au client est définitive.</p>
  </div>;
}
