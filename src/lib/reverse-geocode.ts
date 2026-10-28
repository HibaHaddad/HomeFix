// ISO 3166-2 identifiers returned by the API, mapped to the form's labels.
// These labels do not determine the user's location.
const governorates: Record<string, string> = {
  "TN-11": "Tunis", "TN-12": "Ariana", "TN-13": "Ben Arous", "TN-14": "La Manouba",
  "TN-21": "Nabeul", "TN-22": "Zaghouan", "TN-23": "Bizerte",
  "TN-31": "Béja", "TN-32": "Jendouba", "TN-33": "Le Kef", "TN-34": "Siliana",
  "TN-41": "Kairouan", "TN-42": "Kasserine", "TN-43": "Sidi Bouzid",
  "TN-51": "Sousse", "TN-52": "Monastir", "TN-53": "Mahdia", "TN-61": "Sfax",
  "TN-71": "Gafsa", "TN-72": "Tozeur", "TN-73": "Kébili",
  "TN-81": "Gabès", "TN-82": "Médenine", "TN-83": "Tataouine",
};

export async function reverseGeocodeGovernorate(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "fr",
  });
  // The free endpoint requires a direct browser request with live, consented coordinates.
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("Le service de localisation est indisponible. Choisissez votre gouvernorat dans la liste.");

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("countryCode" in data) || typeof data.countryCode !== "string") {
    throw new Error("La localisation n’a pas pu être identifiée. Choisissez votre gouvernorat dans la liste.");
  }
  if (data.countryCode !== "TN") {
    throw new Error("Votre position se trouve hors de Tunisie. Choisissez votre gouvernorat dans la liste.");
  }
  const code = "principalSubdivisionCode" in data ? data.principalSubdivisionCode : undefined;
  const governorate = typeof code === "string" && Object.hasOwn(governorates, code) ? governorates[code] : undefined;
  if (!governorate) {
    throw new Error("Le service n’a pas identifié votre gouvernorat. Choisissez-le dans la liste.");
  }
  return governorate;
}
