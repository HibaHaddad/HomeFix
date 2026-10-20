import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  phone: z.string().trim().regex(/^\+216\s?\d{8}$/, "Saisissez un numéro tunisien valide (+216 suivi de 8 chiffres)"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  passwordConfirmation: z.string(),
  termsAccepted: z.literal("true", { message: "Vous devez accepter les conditions pour continuer" }),
  role: z.enum(["CLIENT", "PROFESSIONAL"]),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  businessName: z.string().trim().optional(),
  specialty: z.string().trim().optional(),
  description: z.string().trim().optional(),
  experience: z.string().trim().optional(),
  serviceCity: z.string().trim().optional(),
  coveredAreas: z.string().trim().optional(),
  priceRange: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.password !== data.passwordConfirmation) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirmation"], message: "Les mots de passe ne correspondent pas" });
  }

  if (data.role === "PROFESSIONAL") {
    const requiredFields: [keyof typeof data, string][] = [
      ["businessName", "Le nom commercial est obligatoire"],
      ["specialty", "Choisissez votre spécialité"],
      ["experience", "Indiquez votre expérience"],
      ["serviceCity", "Indiquez votre ville d’intervention"],
      ["coveredAreas", "Sélectionnez au moins une ville d’intervention"],
    ];

    for (const [field, message] of requiredFields) {
      if (!data[field] || String(data[field]).trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    }
  }
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
