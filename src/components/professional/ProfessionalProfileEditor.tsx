"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type EditableProfessionalProfile = {
  name: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  specialty: string | null;
  experience: string | null;
  serviceCity: string | null;
  coveredAreas: string | null;
  priceRange: string | null;
  description: string | null;
  isPublic?: boolean;
  experienceYears?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  availability?: string | null;
};

type FormValues = Omit<EditableProfessionalProfile, "phone" | "businessName" | "specialty" | "experience" | "serviceCity" | "coveredAreas" | "priceRange" | "description"> & {
  phone: string; businessName: string; specialty: string; experience: string;
  serviceCity: string; coveredAreas: string; priceRange: string; description: string;
};

function initialValues(profile: EditableProfessionalProfile): FormValues {
  return { name: profile.name, email: profile.email, phone: profile.phone || "", businessName: profile.businessName || "", specialty: profile.specialty || "", experience: profile.experience || "", serviceCity: profile.serviceCity || "", coveredAreas: profile.coveredAreas || "", priceRange: profile.priceRange || "", description: profile.description || "" };
}

export default function ProfessionalProfileEditor({ profile }: { profile: EditableProfessionalProfile }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => initialValues(profile));
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [directory, setDirectory] = useState({
    isPublic: profile.isPublic ?? true,
    experienceYears: profile.experienceYears?.toString() ?? "",
    priceMin: profile.priceMin?.toString() ?? "",
    priceMax: profile.priceMax?.toString() ?? "",
    availability: profile.availability ?? "",
  });
  const emailChanged = values.email.trim().toLowerCase() !== profile.email.toLowerCase();

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(""); setSuccess("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/professionnel/profil", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, ...directory, experienceYears: directory.experienceYears === "" ? null : Number(directory.experienceYears), priceMin: directory.priceMin === "" ? null : Number(directory.priceMin), priceMax: directory.priceMax === "" ? null : Number(directory.priceMax), availability: directory.availability || null, currentPassword: emailChanged ? currentPassword : undefined }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Le profil n’a pas pu être enregistré."); return; }
      setCurrentPassword(""); setSuccess(result.message || "Votre profil a été mis à jour.");
      router.refresh();
    } catch { setError("Impossible de joindre le serveur. Réessayez."); }
    finally { setBusy(false); }
  }

  return <form className="pro-profile-editor" onSubmit={save}>
    <div className="pro-profile-editor-heading"><div><span>INFORMATIONS PROFESSIONNELLES</span><h2>Modifier votre profil</h2></div><small>Vos coordonnées sont visibles par les clients HomeFix.</small></div>
    <div className="pro-profile-fields">
      <label><span>Nom complet</span><input required minLength={2} maxLength={120} autoComplete="name" value={values.name} onChange={(event) => update("name", event.target.value)} /></label>
      <label><span>Nom professionnel</span><input required minLength={2} maxLength={120} autoComplete="organization" value={values.businessName} onChange={(event) => update("businessName", event.target.value)} /></label>
      <label><span>Adresse e-mail</span><input required type="email" maxLength={254} autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} /></label>
      <label><span>Téléphone</span><input type="tel" autoComplete="tel" placeholder="+216 12345678" value={values.phone} onChange={(event) => update("phone", event.target.value)} /></label>
      <label><span>Spécialité</span><input required minLength={2} maxLength={120} value={values.specialty} onChange={(event) => update("specialty", event.target.value)} /></label>
      <label><span>Expérience</span><input required maxLength={120} value={values.experience} onChange={(event) => update("experience", event.target.value)} /></label>
      <label><span>Ville d’intervention</span><input required minLength={2} maxLength={120} value={values.serviceCity} onChange={(event) => update("serviceCity", event.target.value)} /></label>
      <label><span>Fourchette de prix</span><input maxLength={160} placeholder="Ex. à partir de 40 DT" value={values.priceRange} onChange={(event) => update("priceRange", event.target.value)} /></label>
      <label className="pro-field-wide"><span>Zones d’intervention</span><textarea required minLength={2} maxLength={1000} rows={3} value={values.coveredAreas} onChange={(event) => update("coveredAreas", event.target.value)} /></label>
      <label className="pro-field-wide"><span>Présentation de votre activité</span><textarea maxLength={2000} rows={4} value={values.description} onChange={(event) => update("description", event.target.value)} /></label>
      {emailChanged && <label className="pro-field-wide"><span>Mot de passe actuel <i>*</i></span><input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} /><small>Confirmez votre identité pour modifier l’adresse e-mail de connexion.</small></label>}
    </div>
    <div className="pro-profile-editor-heading" style={{ marginTop: 25 }}><div><span>ANNUAIRE HOMEFIX</span><h2>Visibilité et disponibilités</h2></div></div>
    <div className="pro-profile-fields">
      <label><span>Années d’expérience exactes</span><input type="number" min="0" max="80" placeholder="Non renseignées" value={directory.experienceYears} onChange={(e) => setDirectory({ ...directory, experienceYears: e.target.value })}/></label>
      <label><span>Disponibilité annoncée</span><select value={directory.availability} onChange={(e) => setDirectory({ ...directory, availability: e.target.value })}><option value="">À confirmer</option><option value="AVAILABLE">Disponible</option><option value="THIS_WEEK">Cette semaine</option><option value="BUSY">Indisponible actuellement</option></select></label>
      <label><span>Tarif minimum indicatif (TND)</span><input type="number" min="0" max="100000" placeholder="Sur devis" value={directory.priceMin} onChange={(e) => setDirectory({ ...directory, priceMin: e.target.value })}/></label>
      <label><span>Tarif maximum indicatif (TND)</span><input type="number" min={directory.priceMin || "0"} max="100000" placeholder="Non renseigné" value={directory.priceMax} onChange={(e) => setDirectory({ ...directory, priceMax: e.target.value })}/></label>
      <label className="pro-field-wide"><span>Visibilité dans la recherche client</span><select value={directory.isPublic ? "public" : "private"} onChange={(e) => setDirectory({ ...directory, isPublic: e.target.value === "public" })}><option value="public">Afficher mon profil approuvé</option><option value="private">Masquer mon profil</option></select><small>Ces informations permettent aux clients de filtrer leurs recherches. Seuls les profils approuvés peuvent apparaître.</small></label>
    </div>
    {error && <p className="pro-editor-feedback is-error" role="alert">{error}</p>}{success && <p className="pro-editor-feedback is-success" role="status">{success}</p>}
    <div className="pro-editor-footer"><button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les modifications"}</button></div>
  </form>;
}
