import { getAdminCategoryInventory } from "@/app/lib/admin-categories";
import AdminCategories from "@/components/admin/AdminCategories";
import "./categories.css";

export default async function AdminCategoriesPage() {
  const inventory = await getAdminCategoryInventory();
  return <AdminCategories inventory={inventory} />;
}
