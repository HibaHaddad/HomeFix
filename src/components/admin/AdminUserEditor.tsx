"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

type UserEditFields = {
  id: number;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  businessName: string | null;
  specialty: string | null;
  description: string | null;
  experience: string | null;
  serviceCity: string | null;
  coveredAreas: string | null;
  priceRange: string | null;
};

export default function AdminUserEditor({ user }: { user: UserEditFields }) {
  const router = useRouter();
  const fieldList = user.role === "PROFESSIONAL"
    ? [
        ["name", "Nom complet", true], ["email", "Email", true], ["phone", "Téléphone", false],
        ["address", "Adresse", false], ["city", "Ville", false], ["businessName", "Entreprise", false],
        ["specialty", "Spécialité", false], ["experience", "Expérience", false], ["serviceCity", "Ville d’intervention", false],
        ["coveredAreas", "Zones couvertes", false], ["priceRange", "Fourchette tarifaire", false],
        ["description", "Description", false],
      ] as const
    : [
        ["name", "Nom complet", true], ["email", "Email", true], ["phone", "Téléphone", false],
        ["address", "Adresse", false], ["city", "Ville", false],
      ] as const;
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(() => Object.fromEntries(fieldList.map(([key]) => [key, user[key] ?? ""])) as Record<string, string>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Les modifications n’ont pas pu être enregistrées.");
        return;
      }
      setSuccess("Les informations ont été mises à jour.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-user-editor">
    {success && <p className="admin-user-success" role="status">{success}</p>}
    {error && !open && <p className="admin-user-error" role="alert">{error}</p>}
    <button className="admin-user-edit-trigger" onClick={() => { setError(""); setOpen(true); }}><Pencil size={14}/>Modifier les informations</button>
    {open && <div className="admin-user-dialog-backdrop">
      <section className="admin-user-dialog admin-user-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="user-edit-title">
        <button className="admin-user-dialog-close" onClick={() => setOpen(false)} aria-label="Fermer"><X size={18}/></button>
        <span className="admin-section-kicker">GESTION DU PROFIL</span><h2 id="user-edit-title">Modifier les informations</h2>
        <p>Les rôles, mots de passe et statuts de vérification ne sont pas modifiables depuis cette fiche.</p>
        <form onSubmit={save}>
          <div className="admin-user-edit-fields">{fieldList.map(([key, label, required]) => <label className={key === "description" || key === "coveredAreas" ? "is-wide" : ""} key={key}><span>{label}</span>{key === "description" || key === "coveredAreas" ? <textarea value={fields[key] ?? ""} required={required} maxLength={key === "description" ? 2000 : 1000} rows={3} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}/> : <input type={key === "email" ? "email" : "text"} value={fields[key] ?? ""} required={required} maxLength={key === "email" ? 254 : 160} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}/>}</label>)}</div>
          {error && <p className="admin-user-error" role="alert">{error}</p>}
          <div className="admin-user-dialog-actions"><button type="button" className="admin-user-cancel-button" disabled={busy} onClick={() => setOpen(false)}>Annuler</button><button type="submit" className="admin-user-save-button" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
