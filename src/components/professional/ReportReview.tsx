"use client";
import AdminAction from "@/components/admin/AdminAction";
export default function ReportReview({ id }: { id: number }) {
  return <AdminAction label="Signaler cet avis" endpoint={`/api/reviews/${id}/report`} description="Expliquez le problème. L’équipe HomeFix examinera votre signalement ; aucune sanction ne sera appliquée automatiquement." fields={[{ name: "reason", label: "Motif du signalement", type: "textarea", min: 10 }]}/>;
}
