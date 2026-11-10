import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminObject, adminText, AdminActionError, validateSanctions } from "@/lib/admin-validation";
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
    } else throw new AdminActionError("Paramètre invalide.");
    const key = body.key as "GENERAL" | "SANCTION_RULES";
    await prisma.$transaction(async tx => {
      const previous = await tx.adminSetting.findUnique({ where: { key } });
      await tx.adminSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      await audit(tx, admin, "SETTINGS_UPDATE", `settings:${key}`, undefined, { previous: previous?.value ?? null, value });
    });
    return Response.json({ ok: true, automaticEnforcement: false });
  });
}
