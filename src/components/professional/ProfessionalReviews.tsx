import { prisma } from "@/app/lib/prisma";
import { Star } from "lucide-react";
export default async function ProfessionalReviews({ professionalId }: { professionalId: number }) {
  const [reviews, summary] = await Promise.all([
    prisma.professionalReview.findMany({ where: { professionalId, published: true }, include: { client: { select: { name: true } }, request: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.professionalReview.aggregate({ where: { professionalId, published: true }, _avg: { rating: true }, _count: true }),
  ]);
  return <><div className="pro-page-heading"><div><div className="pro-eyebrow"><span/>LA CONFIANCE DE VOS CLIENTS</div><h1>Avis clients</h1><p>Les retours de vos interventions, au même endroit.</p></div></div><section className="cx-panel"><div className="hf-pro-review-header"><strong>{summary._avg.rating?.toFixed(1) || "—"}</strong><div><div className="hf-review-stars"><Star size={22} fill="currentColor"/><span>sur 5</span></div><p>{summary._count} avis publié{summary._count > 1 ? "s" : ""}</p></div></div>{reviews.length ? reviews.map((r) => <article key={r.id} className="hf-pro-review"><header><div><strong>{r.client.name}</strong>{r.request && <p>{r.request.title}</p>}</div><time>{r.createdAt.toLocaleDateString("fr-TN", { timeZone: "Africa/Tunis" })}</time></header><div className="hf-review-stars">{r.rating !== null ? <>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} fill={n <= r.rating! ? "currentColor" : "none"}/>)}<span>{r.rating}/5</span></> : <span>Avis écrit</span>}</div>{r.comment && <p>{r.comment}</p>}</article>) : <p>Les avis apparaîtront après le paiement confirmé des interventions.</p>}</section></>;
}
