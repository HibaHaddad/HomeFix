import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminObject, adminText, AdminActionError, validateSanctions } from "@/lib/admin-validation";
import { validateDashboardPreferences } from "@/lib/admin-dashboard-preferences";
import { dashboardPreferenceKey } from "@/app/lib/admin-dashboard-preferences";
import { validateCommissionBps } from "@/lib/payment-allocation";
export async function PUT(request: Request) {
  return adminMutation(request, async admin => {
    const body = adminObject(await request.json().catch(() => null), ["key", "value"]);
    let value;
    if (body.key === "SANCTION_RULES") value = { ...validateSanctions(body.value), automaticEnforcement: false };
    else if (body.key === "GENERAL") {
      const input = adminObject(body.value, ["supportEmail", "complaintSlaHours"]);
      const supportEmail = adminText(input.supportEmail, "E-mail", 5, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new AdminActionError("E-mail invalide.");
      const hours = input.complaintSlaHours;
      if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 720) throw new AdminActionError("Le délai doit être compris entre 1 et 720 heures.");
      value = { supportEmail, complaintSlaHours: hours };
    } else if (body.key === "PAYMENT_COMMISSION") {
      const input = adminObject(body.value, ["commissionBps"]);
      try { value = { commissionBps: validateCommissionBps(input.commissionBps) }; }
      catch (error) { throw new AdminActionError(error instanceof Error ? error.message : "Commission invalide."); }
    } else if (body.key === "DASHBOARD_PREFERENCES") value = validateDashboardPreferences(body.value);
    else throw new AdminActionError("Paramètre invalide.");
    const key = body.key === "DASHBOARD_PREFERENCES" ? dashboardPreferenceKey(admin.id) : body.key as "GENERAL" | "SANCTION_RULES" | "PAYMENT_COMMISSION";
    await prisma.$transaction(async tx => {
      const previous = await tx.adminSetting.findUnique({ where: { key } });
      await tx.adminSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      await audit(tx, admin, "SETTINGS_UPDATE", `settings:${key}`, undefined, { previous: previous?.value ?? null, value });
    });
    return Response.json({ ok: true, automaticEnforcement: false });
  });
}
