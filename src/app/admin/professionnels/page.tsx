import { prisma } from "@/app/lib/prisma";
import ProfessionalReviewList, { type ReviewRow } from "@/components/admin/ProfessionalReviewList";

export default async function ProfessionalReviewPage() {
  const rows = await prisma.user.findMany({
    where: { role: "PROFESSIONAL" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, businessName: true, specialty: true, serviceCity: true, createdAt: true, status: true },
  });
  const professionals: ReviewRow[] = rows.map((user) => ({
    ...user,
    businessName: user.businessName || "",
    specialty: user.specialty || "",
    serviceCity: user.serviceCity || "",
    createdAt: user.createdAt.toISOString(),
  }));
  return <ProfessionalReviewList professionals={professionals} />;
}
