import { requireAdminPage } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { sanctionDefaults, validateSanctions } from "@/lib/admin-validation";
import { AdminSection } from "@/components/admin/AdminWorkspace";
import AdminSettingsForm from "@/components/admin/AdminSettingsForm";
export default async function SanctionsPage() {
  await requireAdminPage();
  const setting = await prisma.adminSetting.findUnique({ where: { key: "SANCTION_RULES" } });
  let rules = sanctionDefaults;
  if (setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)) {
    const saved = Object.fromEntries(Object.entries(setting.value).filter(([key]) => key !== "automaticEnforcement"));
    rules = validateSanctions(saved);
  }
  return <AdminSection title="Sanctions et pénalités" description="Définissez une politique cohérente pour l’examen humain des incidents."><div className="aw-note"><strong>Application automatique désactivée.</strong> Ces seuils sont des règles de référence. Leur enregistrement ne suspend aucun compte, ne modère aucun avis et ne prélève aucune pénalité.</div><div className="aw-grid"><section className="aw-card"><h2>Règles de référence</h2><AdminSettingsForm settingKey="SANCTION_RULES" fields={[{ name: "reviewThreshold", label: "Note à examiner (sur 5, inférieure ou égale)", value: rules.reviewThreshold, max: 5 }, { name: "absenceThreshold", label: "Nombre d’absences avant examen", value: rules.absenceThreshold }, { name: "paymentDelayDays", label: "Retard de paiement avant examen (jours)", value: rules.paymentDelayDays, max: 365 }, { name: "warningPoints", label: "Points de référence pour un avertissement", value: rules.warningPoints }, { name: "suspensionPoints", label: "Points de référence pour une suspension", value: rules.suspensionPoints }]}/></section><aside className="aw-card"><h2>Une décision humaine, toujours</h2><p>Une note faible, une absence ou un retard doit être examiné dans son contexte. Les avis, réservations, paiements et réclamations restent accessibles dans leurs modules respectifs.</p><p>Les suspensions manuelles continuent d’utiliser le parcours existant de la fiche utilisateur, avec un motif et une trace d’audit. Aucun barème monétaire n’est appliqué.</p></aside></div></AdminSection>;
}
