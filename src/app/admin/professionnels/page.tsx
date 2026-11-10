import { getAdminProfessionalList, parseAdminProfessionalFilters } from "@/app/lib/admin-professionals";
import ProfessionalReviewList, { type ReviewRow } from "@/components/admin/ProfessionalReviewList";
import "./professionals.css";
import { requireAdminPage } from "@/app/lib/admin-access";

export default async function ProfessionalReviewPage({ searchParams }: PageProps<"/admin/professionnels">) {
  await requireAdminPage();
  const filters = parseAdminProfessionalFilters(await searchParams);
  const result = await getAdminProfessionalList(filters);
  const professionals: ReviewRow[] = result.professionals.map((user) => ({
    ...user,
    businessName: user.businessName || "",
    specialty: user.specialty || "",
    serviceCity: user.serviceCity || "",
    createdAt: user.createdAt.toISOString(),
  }));
  return <ProfessionalReviewList filters={{ ...filters, page: result.page }} result={{ ...result, professionals }} />;
}
