export const categoryIconNames = ["wrench", "droplets", "zap", "snowflake", "flame", "key", "hammer", "paintbrush", "sparkles", "plug", "leaf", "shapes"] as const;
export type CategoryIconName = (typeof categoryIconNames)[number];
export type PublicServiceCategory = { id: number; name: string; description: string; icon: string };
export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
