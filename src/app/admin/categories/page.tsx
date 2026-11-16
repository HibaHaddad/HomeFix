import { getAdminCategoryInventory } from "@/app/lib/admin-categories";
import AdminCategories from "@/components/admin/AdminCategories";
import "./categories.css";
import { requireAdminPage } from "@/app/lib/admin-access";

export default async function AdminCategoriesPage() {
  await requireAdminPage();
  const inventory = await getAdminCategoryInventory();
  return <AdminCategories inventory={inventory} />;
}
