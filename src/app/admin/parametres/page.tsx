import { requireAdminPage } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { AdminSection } from "@/components/admin/AdminWorkspace";
import AdminSettingsForm from "@/components/admin/AdminSettingsForm";
export default async function SettingsPage() {
  const admin = await requireAdminPage();
  const setting = await prisma.adminSetting.findUnique({ where: { key: "GENERAL" } });
  const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value : {};
  return <AdminSection title="Paramètres Admin" description="Les repères de votre équipe, enregistrés dans PostgreSQL et traçables dans le journal d’audit."><div className="aw-grid"><section className="aw-card"><h2>Suivi et assistance</h2><AdminSettingsForm settingKey="GENERAL" fields={[{ name: "supportEmail", label: "E-mail de référence de l’équipe", value: typeof value.supportEmail === "string" ? value.supportEmail : "support@homefix.tn" }, { name: "complaintSlaHours", label: "Délai cible de traitement des réclamations (heures)", value: typeof value.complaintSlaHours === "number" ? value.complaintSlaHours : 48, max: 720 }]}/></section><aside className="aw-card"><h2>Votre environnement</h2><p>Connecté en tant que <strong>{admin.name}</strong>. Les autorisations sont vérifiées sur le serveur pour chaque action.</p><p>Fuseau : Africa/Tunis · Montants de référence : TND · Paiements : Stripe Test uniquement.</p><p>L’adresse ci-contre sert de référence à l’équipe. Aucun e-mail n’est envoyé automatiquement. Le délai cible alimente les alertes de traitement.</p></aside></div></AdminSection>;
}
