import { adminObject, adminText, AdminActionError } from "./admin-validation";
import { categoryIconNames, normalizeCategoryName } from "./service-categories";

export function validateCategory(value: unknown) {
  const input = adminObject(value, ["name", "description", "icon", "isActive"]);
  const name = adminText(input.name, "Nom", 2, 80).replace(/\s+/g, " ");
  if (typeof input.description !== "string" || input.description.trim().length > 1000) throw new AdminActionError("Description : 1000 caractères maximum.");
  if (!(categoryIconNames as readonly unknown[]).includes(input.icon)) throw new AdminActionError("Icône invalide.");
  if (typeof input.isActive !== "boolean") throw new AdminActionError("Statut invalide.");
  return { name, normalizedName: normalizeCategoryName(name), description: input.description.trim(), icon: input.icon as string, isActive: input.isActive };
}
