import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { AdminActionError, adminObject } from "@/lib/admin-validation";
import { validateSanctionRules } from "@/lib/sanctions";
export async function PUT(request: Request) {
  return adminMutation(request, async admin => {
    const body = adminObject(await request.json().catch(() => null), ["rules"]);
    let rules; try { rules = validateSanctionRules(body.rules); } catch (e) { throw new AdminActionError(e instanceof Error ? e.message : "Règles invalides."); }
    await prisma.$transaction(async tx => {
      const previous = await tx.sanctionRule.findMany();
      for (const rule of rules) await tx.sanctionRule.update({ where: { id: rule.id }, data: rule });
      await audit(tx, admin, "SANCTION_RULES_UPDATE", "sanctions:rules", undefined, { previous: previous.map(({ id, enabled, thresholdMinutes, amountMillimes, ratingHundredths }) => ({ id, enabled, thresholdMinutes, amountMillimes, ratingHundredths })), rules });
    });
    return Response.json({ ok: true });
  });
}
