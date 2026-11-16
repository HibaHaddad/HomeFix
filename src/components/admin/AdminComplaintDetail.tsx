import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { getAdminComplaintDetail } from "@/app/lib/admin-complaints";
import AdminComplaintCase, { type ComplaintCase } from "./AdminComplaintCase";

export default function AdminComplaintDetail({ complaint }: { complaint: NonNullable<Awaited<ReturnType<typeof getAdminComplaintDetail>>> }) {
  const serialized = JSON.parse(JSON.stringify(complaint)) as ComplaintCase;
  return <div className="admin-content admin-complaint-detail-page">
    <Link href="/admin/reclamations" className="admin-back-link"><ArrowLeft size={14}/>Retour aux réclamations</Link>
    <header className="admin-page-heading"><div><div className="admin-eyebrow"><span/>RÉCLAMATION · REC-{String(complaint.id).padStart(4, "0")}</div><h1>{complaint.subject}</h1></div></header>
    <div className="admin-card cc-detail-card"><AdminComplaintCase complaint={serialized}/></div>
  </div>;
}
