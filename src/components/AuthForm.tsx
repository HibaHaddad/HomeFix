"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RegistrationRole = "CLIENT" | "PROFESSIONAL";

const clientSteps = ["Profil", "Coordonnées", "Informations complémentaires", "Sécurité", "Récapitulatif"];
const professionalSteps = ["Profil", "Coordonnées", "Votre activité", "Intervention", "Sécurité", "Récapitulatif"];
const governorateCenters = [
  ["Ariana", 36.8625, 10.1956], ["Béja", 36.7256, 9.1817], ["Ben Arous", 36.7545, 10.2217], ["Bizerte", 37.2744, 9.8739],
  ["Gabès", 33.8815, 10.0982], ["Gafsa", 34.425, 8.784], ["Jendouba", 36.501, 8.78], ["Kairouan", 35.678, 10.096],
  ["Kasserine", 35.1676, 8.8365], ["Kébili", 33.7044, 8.969], ["Le Kef", 36.174, 8.704], ["Mahdia", 35.5047, 11.0622],
  ["La Manouba", 36.808, 10.097], ["Médenine", 33.3549, 10.505], ["Monastir", 35.7643, 10.811], ["Nabeul", 36.451, 10.735],
  ["Sfax", 34.7406, 10.7603], ["Sidi Bouzid", 35.038, 9.4858], ["Siliana", 36.084, 9.37], ["Sousse", 35.8256, 10.636],
  ["Tataouine", 32.929, 10.45], ["Tozeur", 33.9197, 8.1335], ["Tunis", 36.806, 10.1815], ["Zaghouan", 36.402, 10.1429],
] as const;

function nearestGovernorate(latitude: number, longitude: number) {
  return governorateCenters.reduce((nearest, current) => {
    const currentDistance = (current[1] - latitude) ** 2 + (current[2] - longitude) ** 2;
    const nearestDistance = (nearest[1] - latitude) ** 2 + (nearest[2] - longitude) ** 2;
    return currentDistance < nearestDistance ? current : nearest;
  })[0];
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerRole, setRegisterRole] = useState<RegistrationRole | null>(null);
  const [specialtyChoice, setSpecialtyChoice] = useState("");
  const [certificationName, setCertificationName] = useState("");
  const [serviceCityChoice, setServiceCityChoice] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");
  const steps = registerRole === "PROFESSIONAL" ? professionalSteps : clientSteps;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    if (mode === "register" && typeof data.phone === "string") {
      data.phone = `+216${data.phone.replace(/\D/g, "")}`;
      formData.set("phone", data.phone);
    }
    if (mode === "register") {
      const serviceCity = formData.get("serviceCity");
      if (typeof serviceCity === "string" && serviceCity) {
        data.coveredAreas = serviceCity;
        formData.set("coveredAreas", serviceCity);
      }
      if (typeof data.specialtyChoice === "string") {
        data.specialty = data.specialtyChoice === "Autre" ? data.specialtyOther : data.specialtyChoice;
        formData.set("specialty", String(data.specialty));
        delete data.specialtyChoice;
        delete data.specialtyOther;
        formData.delete("specialtyChoice");
        formData.delete("specialtyOther");
      }
    }

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        ...(mode === "login"
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
          : { body: formData }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Une erreur est survenue");
        return;
      }

      if (mode === "register") {
        const result = await res.json();
        if (result.status === "PENDING_VERIFICATION") {
          setRegistrationPending(true);
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(mode === "login"
        ? "Impossible de vous connecter pour le moment. Réessayez."
        : "Impossible de créer votre compte pour le moment. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  const cta = mode === "login" ? "Se connecter" : "S'inscrire";

  if (mode === "login") {
    return (
      <form onSubmit={onSubmit} className="login-form">
        <label className="login-field"><span>Adresse e-mail</span><input name="email" type="email" placeholder="vous@exemple.tn" autoComplete="email" required aria-label="Adresse e-mail" /></label>
        <label className="login-field"><span>Mot de passe</span><span className="login-password-wrap"><input name="password" type={showPassword ? "text" : "password"} placeholder="Votre mot de passe" autoComplete="current-password" required aria-label="Mot de passe" /><button type="button" className="login-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>
          {showPassword ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C4.2 7.5 2.9 9.6 2.5 12c.5 2.7 4 7 9.5 7 1.1 0 2.1-.2 3-.5" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
        </button></span></label>
        <div className="login-options"><label className="login-remember"><input type="checkbox" name="remember" /><span className="login-checkbox" />Se souvenir de moi</label><a href="mailto:support@homefix.tn?subject=Mot%20de%20passe%20oubli%C3%A9">Mot de passe oublié ?</a></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button disabled={loading} className="login-submit" type="submit">{loading ? "Connexion en cours…" : cta}{!loading && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>}</button>
        <p className="login-security"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></svg>Vos informations restent protégées.</p>
      </form>
    );
  }

  if (registrationPending) {
    return <div className="register-pending" role="status" aria-live="polite"><span className="register-pending-icon" aria-hidden="true">✓</span><h2>Demande bien reçue !</h2><p>Votre profil professionnel est enregistré. Il restera en attente de vérification avant que vous puissiez accéder à votre espace.</p><p className="register-pending-note">Vous pourrez vous connecter dès que votre profil sera validé.</p></div>;
  }

  function validateCurrentStep() {
    setError("");
    if (step === 1) {
      if (!registerRole) {
        setError("Choisissez le profil qui vous correspond pour continuer.");
        return false;
      }
      return true;
    }

    const activeFieldset = formRef.current?.querySelector<HTMLFieldSetElement>(`fieldset[data-step="${step}"]`);
    if (!activeFieldset) return false;
    const controls = Array.from(activeFieldset.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
    if (step === 4) {
      const password = formRef.current?.elements.namedItem("password") as HTMLInputElement | null;
      const confirmation = formRef.current?.elements.namedItem("passwordConfirmation") as HTMLInputElement | null;
      confirmation?.setCustomValidity(password?.value === confirmation?.value ? "" : "Les mots de passe ne correspondent pas.");
    }
    const firstInvalid = controls.find((control) => !control.checkValidity());
    if (firstInvalid) {
      firstInvalid.reportValidity();
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    setStepDirection("forward");
    setStep((current) => Math.min(current + 1, steps.length));
    setError("");
  }

  function suggestCityFromLocation() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("La géolocalisation n’est pas disponible sur cet appareil. Choisissez votre ville dans la liste.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (coords.latitude < 30 || coords.latitude > 38 || coords.longitude < 7 || coords.longitude > 12) {
          setLocationMessage("Votre position semble être hors de Tunisie. Choisissez votre ville dans la liste.");
          return;
        }
        const suggestion = nearestGovernorate(coords.latitude, coords.longitude);
        setServiceCityChoice(suggestion);
        setLocationMessage(`Ville proposée : ${suggestion}. Vérifiez-la avant de continuer.`);
      },
      () => {
        setLocating(false);
        setLocationMessage("Position non accessible. Choisissez votre ville dans la liste.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function getSummary() {
    const formData = formRef.current ? new FormData(formRef.current) : null;
    if (!formData) return [];
    const values: [string, string][] = [
      ["Profil", registerRole === "CLIENT" ? "Client" : "Professionnel"],
      ["Nom", `${formData.get("firstName") ?? ""} ${formData.get("lastName") ?? ""}`.trim()],
      ["E-mail", String(formData.get("email") ?? "")],
      ["Téléphone", `+216 ${formData.get("phone") ?? ""}`],
      ["Conditions", formData.get("termsAccepted") === "true" ? "Acceptées" : "À accepter"],
    ];
    if (registerRole === "CLIENT") {
      const address = String(formData.get("address") ?? "").trim();
      const city = String(formData.get("city") ?? "").trim();
      if (address) values.push(["Adresse", address]);
      if (city) values.push(["Gouvernorat", city]);
    } else {
      values.push(["Activité", String(formData.get("businessName") ?? "")]);
      const specialty = specialtyChoice === "Autre" ? String(formData.get("specialtyOther") ?? "") : specialtyChoice;
      values.push(["Spécialité", specialty]);
      values.push(["Ville d’intervention", String(formData.get("serviceCity") ?? "")]);
      values.push(["Expérience", String(formData.get("experience") ?? "")]);
      const description = String(formData.get("description") ?? "").trim();
      if (description) values.push(["Description", description]);
      const priceRange = String(formData.get("priceRange") ?? "").trim();
      if (priceRange) values.push(["Tarifs indicatifs", priceRange]);
      if (certificationName) values.push(["Justificatif", certificationName]);
    }
    return values;
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="register-form register-wizard" noValidate>
      <input type="hidden" name="role" value={registerRole ?? ""} />

      <div className="register-progress" aria-label={`Étape ${step} sur ${steps.length}`}>
        <div className="register-progress-top"><span>ÉTAPE {step} <i>/ {steps.length}</i></span><strong>{steps[step - 1]}</strong></div>
        <div className="register-progress-track" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden="true">{steps.map((label, index) => <span key={label} className={index + 1 <= step ? "is-complete" : ""} />)}</div>
        <div className="register-progress-labels" aria-hidden="true">{steps.map((label, index) => <span key={label} className={index + 1 === step ? "is-current" : index + 1 < step ? "is-done" : ""}>{label}</span>)}</div>
      </div>

      <div className="register-step-viewport"><fieldset data-step="1" hidden={step !== 1} className={`register-step-panel step-${stepDirection}`}>
        <legend>Quel profil vous correspond ?</legend>
        <p className="register-step-copy">Choisissez votre espace HomeFix pour personnaliser votre inscription.</p>
        <div className="register-role-options register-role-options-large">
          <button type="button" className={`register-role-option ${registerRole === "CLIENT" ? "is-selected" : ""}`} aria-pressed={registerRole === "CLIENT"} onClick={() => { setRegisterRole("CLIENT"); setError(""); }}><span className="register-role-icon" aria-hidden="true">⌂</span><span><strong>Je suis client</strong><small>Je cherche un professionnel de confiance</small></span><span className="register-role-radio" /></button>
          <button type="button" className={`register-role-option ${registerRole === "PROFESSIONAL" ? "is-selected" : ""}`} aria-pressed={registerRole === "PROFESSIONAL"} onClick={() => { setRegisterRole("PROFESSIONAL"); setError(""); }}><span className="register-role-icon register-role-icon-pro" aria-hidden="true">⌕</span><span><strong>Je suis professionnel</strong><small>Je souhaite proposer mes services</small></span><span className="register-role-radio" /></button>
        </div>
        <div className="register-role-footnote"><span aria-hidden="true">✳</span> Vous pourrez compléter votre profil après l’inscription.</div>
      </fieldset>

      <fieldset data-step="2" hidden={step !== 2} className={`register-step-panel step-${stepDirection}`}>
        <legend>Vos coordonnées</legend><p className="register-step-copy">Comment pouvons-nous vous joindre ?</p>
        <div className="register-fields-grid">
          <label className="register-field"><span>Prénom <i>*</i></span><input name="firstName" placeholder="Ex. Amira" autoComplete="given-name" minLength={2} required /></label>
          <label className="register-field"><span>Nom <i>*</i></span><input name="lastName" placeholder="Ex. Ben Ali" autoComplete="family-name" minLength={2} required /></label>
          <label className="register-field register-field-full"><span>Adresse e-mail <i>*</i></span><input name="email" type="email" placeholder="vous@exemple.tn" autoComplete="email" required /></label>
          <label className="register-field register-field-full"><span>Téléphone <i>*</i></span><span className="register-phone-wrap"><span>🇹🇳 +216</span><input name="phone" type="tel" placeholder="12 345 678" autoComplete="tel-national" inputMode="numeric" pattern="[0-9 ]{8,10}" minLength={8} maxLength={10} required /></span></label>
        </div>
      </fieldset>

      <fieldset data-step="3" hidden={step !== 3} className={`register-step-panel step-${stepDirection}`}>
        {registerRole === "CLIENT" ? <><legend>Un peu plus sur vous</legend><p className="register-step-copy">Ces informations aident à trouver des professionnels près de chez vous.</p><div className="register-fields-grid"><label className="register-field register-field-full"><span>Adresse</span><input name="address" placeholder="Rue, quartier…" autoComplete="street-address" /></label><label className="register-field register-field-full"><span>Gouvernorat</span><select name="city" defaultValue="" autoComplete="address-level1"><option value="">Choisir un gouvernorat</option><option>Ariana</option><option>Béja</option><option>Ben Arous</option><option>Bizerte</option><option>Gabès</option><option>Gafsa</option><option>Jendouba</option><option>Kairouan</option><option>Kasserine</option><option>Kébili</option><option>Le Kef</option><option>Mahdia</option><option>La Manouba</option><option>Médenine</option><option>Monastir</option><option>Nabeul</option><option>Sfax</option><option>Sidi Bouzid</option><option>Siliana</option><option>Sousse</option><option>Tataouine</option><option>Tozeur</option><option>Tunis</option><option>Zaghouan</option></select></label></div></> : <><legend>Parlez-nous de votre activité</legend><p className="register-step-copy">Présentez votre savoir-faire et vos services.</p><div className="register-fields-grid">
          <label className="register-field register-field-full"><span>Nom commercial <i>*</i></span><input name="businessName" placeholder="Ex. Plomberie Ben Ali" autoComplete="organization" minLength={2} required /></label>
          <label className="register-field"><span>Spécialité <i>*</i></span><select name="specialtyChoice" value={specialtyChoice} onChange={(event) => setSpecialtyChoice(event.target.value)} required><option value="" disabled>Choisir</option><option>Plomberie</option><option>Électricité</option><option>Climatisation</option><option>Serrurerie</option><option>Électroménager</option><option>Peinture</option><option>Ménage</option><option>Autre</option></select></label>
          <label className="register-field"><span>Expérience <i>*</i></span><select name="experience" defaultValue="" required><option value="" disabled>Choisir</option><option>Débutant</option><option>1 à 3 ans</option><option>4 à 7 ans</option><option>8 à 15 ans</option><option>Plus de 15 ans</option></select></label>
          {specialtyChoice === "Autre" && <label className="register-field register-field-full"><span>Précisez votre spécialité <i>*</i></span><input name="specialtyOther" placeholder="Ex. Jardinage, vitrerie…" minLength={2} required /></label>}
          <label className="register-field register-field-full"><span>Description de votre activité</span><textarea name="description" placeholder="Présentez vos services et votre savoir-faire…" rows={3} /></label>
        </div></>}
      </fieldset>

      {registerRole === "PROFESSIONAL" && <fieldset data-step="4" hidden={step !== 4} className={`register-step-panel step-${stepDirection}`}>
        <legend>Où intervenez-vous ?</legend><p className="register-step-copy">Choisissez votre ville d’intervention. Nous pouvons vous proposer celle qui est la plus proche de votre position.</p>
        <button type="button" className="register-location-button" onClick={suggestCityFromLocation} disabled={locating}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>{locating ? "Recherche de votre position…" : "Utiliser ma position"}</button>
        {locationMessage && <p className="register-location-message" role="status" aria-live="polite">{locationMessage}</p>}
        <div className="register-fields-grid"><label className="register-field register-field-full"><span>Ville d’intervention <i>*</i></span><select name="serviceCity" value={serviceCityChoice} onChange={(event) => setServiceCityChoice(event.target.value)} required><option value="" disabled>Choisir un gouvernorat</option><option>Ariana</option><option>Béja</option><option>Ben Arous</option><option>Bizerte</option><option>Gabès</option><option>Gafsa</option><option>Jendouba</option><option>Kairouan</option><option>Kasserine</option><option>Kébili</option><option>Le Kef</option><option>Mahdia</option><option>La Manouba</option><option>Médenine</option><option>Monastir</option><option>Nabeul</option><option>Sfax</option><option>Sidi Bouzid</option><option>Siliana</option><option>Sousse</option><option>Tataouine</option><option>Tozeur</option><option>Tunis</option><option>Zaghouan</option></select></label>
          <label className="register-field register-field-full"><span>Tarifs indicatifs</span><input name="priceRange" placeholder="Ex. À partir de 40 DT" /></label>
          <div className="register-field register-field-full"><span>Certification professionnelle</span><label className="register-file-picker"><input className="register-file-input" name="certification" type="file" accept="application/pdf,.pdf" aria-describedby="certification-hint" onChange={(event) => setCertificationName(event.target.files?.[0]?.name ?? "")} /><span className="register-file-button">Choisir un fichier</span><span className="register-file-name">{certificationName || "Aucun fichier sélectionné"}</span></label><small className="register-field-hint" id="certification-hint">Format PDF · 5 Mo maximum.</small></div>
        </div><p className="register-review-note"><span aria-hidden="true">◷</span> Votre profil professionnel restera en attente de vérification.</p>
      </fieldset>}

      <fieldset data-step={registerRole === "PROFESSIONAL" ? 5 : 4} hidden={step !== (registerRole === "PROFESSIONAL" ? 5 : 4)} className={`register-step-panel step-${stepDirection}`}>
        <legend>Sécurisez votre compte</legend><p className="register-step-copy">Choisissez un mot de passe personnel pour protéger votre espace.</p>
        <div className="register-fields-grid"><label className="register-field register-field-full"><span>Mot de passe <i>*</i></span><span className="register-password-wrap"><input name="password" type={showPassword ? "text" : "password"} placeholder="8 caractères minimum" autoComplete="new-password" minLength={8} required /><button type="button" className="register-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Masquer les mots de passe" : "Afficher les mots de passe"} aria-pressed={showPassword}>{showPassword ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C4.2 7.5 2.9 9.6 2.5 12c.5 2.7 4 7 9.5 7 1.1 0 2.1-.2 3-.5" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}</button></span></label><label className="register-field register-field-full"><span>Confirmer le mot de passe <i>*</i></span><input name="passwordConfirmation" type={showPassword ? "text" : "password"} placeholder="Saisissez à nouveau votre mot de passe" autoComplete="new-password" minLength={8} required /></label></div>
        <label className="register-terms"><input type="checkbox" name="termsAccepted" value="true" required /><span className="register-terms-check" /><span>J’accepte les <a href="mailto:support@homefix.tn?subject=Conditions%20d’utilisation">conditions d’utilisation</a> et la politique de confidentialité. <i>*</i></span></label>
        <p className="register-security-note"><span aria-hidden="true">♢</span> Vos données sont protégées et utilisées pour votre compte HomeFix.</p>
      </fieldset>

      <fieldset data-step={steps.length} hidden={step !== steps.length} className={`register-step-panel register-summary-panel step-${stepDirection}`}>
        <legend>Tout est prêt</legend><p className="register-step-copy">Vérifiez vos informations avant de créer votre compte.</p>
        <dl className="register-summary-list">{getSummary().map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>
        <p className="register-summary-note"><span aria-hidden="true">✓</span> {registerRole === "PROFESSIONAL" ? "Votre profil sera soumis à vérification après l’inscription." : "Vous pourrez retrouver vos demandes depuis votre espace personnel."}</p>
      </fieldset></div>

      {error && <p className="register-error" role="alert">{error}</p>}
      <div className="register-wizard-actions">
        {step > 1 ? <button type="button" className="register-back" onClick={() => { setError(""); setStepDirection("backward"); setStep((current) => current - 1); }}>← <span>Retour</span></button> : <span />}
        {step < steps.length ? <button type="button" className="register-next" onClick={goNext}>Suivant <span aria-hidden="true">→</span></button> : <button type="submit" disabled={loading} className="register-submit">{loading ? "Création de votre compte…" : "Créer mon compte"}<span aria-hidden="true">↗</span></button>}
      </div>
      <p className="register-required-note"><i>*</i> Champs obligatoires</p>
    </form>
  );
}
