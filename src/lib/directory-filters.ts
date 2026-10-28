export const tunisianGovernorates = [
  "Ariana", "Béja", "Ben Arous", "Bizerte", "Gabès", "Gafsa",
  "Jendouba", "Kairouan", "Kasserine", "Kébili", "Le Kef", "Mahdia",
  "La Manouba", "Médenine", "Monastir", "Nabeul", "Sfax", "Sidi Bouzid",
  "Siliana", "Sousse", "Tataouine", "Tozeur", "Tunis", "Zaghouan",
] as const;

export const availabilityLabels: Record<string, string> = {
  AVAILABLE: "Disponible", THIS_WEEK: "Cette semaine", BUSY: "Indisponible actuellement",
};
export const sortLabels: Record<string, string> = {
  recent: "Plus récents", rating: "Mieux notés", experience: "Plus expérimentés",
  price_asc: "Prix croissant", price_desc: "Prix décroissant",
};
export function normalizeSearchTerm(value: string) {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ({ plombier: "plomberie", plombiers: "plomberie", electricien: "electricite", electriciens: "electricite", climatiseur: "climatisation", frigoriste: "climatisation", peintre: "peinture", serrurier: "serrurerie" } as Record<string, string>)[normalized] || normalized;
}
export type DirectoryFilters = {
  q: string; specialty: string; location: string; minExperience: number | null;
  maxExperience: number | null; minRating: number | null; minPrice: number | null;
  maxPrice: number | null; availability: string; verified: boolean; sort: string; page: number;
};
export function parseDirectoryFilters(params: URLSearchParams): DirectoryFilters {
  function number(key: string, max: number, integer = true) {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`Le filtre ${key} est invalide.`);
    }
    return value;
  }
  const filters = {
    q: (params.get("q") || "").trim().slice(0, 120),
    specialty: (params.get("specialty") || "").trim().slice(0, 120),
    location: (params.get("location") || "").trim().slice(0, 120),
    minExperience: number("minExperience", 80), maxExperience: number("maxExperience", 80),
    minRating: number("minRating", 5, false), minPrice: number("minPrice", 100000), maxPrice: number("maxPrice", 100000),
    availability: params.get("availability") || "", verified: params.get("verified") === "true",
    sort: params.get("sort") || "recent", page: number("page", 100000) ?? 1,
  };
  if (!Object.hasOwn(sortLabels, filters.sort)) throw new Error("Tri invalide.");
  if (filters.location && !tunisianGovernorates.some((governorate) => governorate === filters.location)) throw new Error("Choisissez un gouvernorat tunisien dans la liste.");
  if (filters.availability && !Object.hasOwn(availabilityLabels, filters.availability)) throw new Error("Disponibilité invalide.");
  if (filters.page < 1) throw new Error("Page invalide.");
  if (filters.minExperience !== null && filters.maxExperience !== null && filters.minExperience > filters.maxExperience) throw new Error("L’expérience minimale dépasse le maximum.");
  if (filters.minPrice !== null && filters.maxPrice !== null && filters.minPrice > filters.maxPrice) throw new Error("Le prix minimum dépasse le maximum.");
  return filters;
}
