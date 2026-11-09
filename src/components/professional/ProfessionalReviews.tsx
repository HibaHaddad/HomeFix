import { prisma } from "@/app/lib/prisma";
import ProfessionalReviewsList from "./ProfessionalReviewsList";

export default async function ProfessionalReviews({ professionalId }: { professionalId: number }) {
  const reviews = await prisma.professionalReview.findMany({
    where: { professionalId, published: true },
    select: {
      id: true, rating: true, comment: true, createdAt: true,
      client: { select: { name: true } }, request: { select: { id: true, title: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return <>
    <div className="pro-page-heading"><div><div className="pro-eyebrow"><span />LA CONFIANCE DE VOS CLIENTS</div><h1>Avis clients</h1><p>Les retours de vos interventions, au même endroit.</p></div></div>
    <ProfessionalReviewsList reviews={reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString() }))} />
  </>;
}
