import { prisma } from "@/app/lib/prisma";
import { buildProfessionalFinance, financePeriod } from "@/lib/professional-finance";
import ProfessionalFinanceDashboard from "./ProfessionalFinanceDashboard";
import styles from "./ProfessionalPayments.module.css";
import ProfessionalSanctions from "./ProfessionalSanctions";

export default async function ProfessionalPayments({ professionalId, period: rawPeriod }: { professionalId: number; period?: string }) {
  const now = new Date();
  const period = financePeriod(rawPeriod, now);
  // Totals use every invoice in a consistent snapshot, independently of pagination.
  const { invoices, sanctions } = await prisma.$transaction(async tx => {
    const invoices = await tx.clientInvoice.findMany({
    where: { quote: { request: { professionalId } } },
    select: {
      id: true, totalMillimes: true, paidMillimes: true, status: true, createdAt: true,
      receiptUrl: true, paymentReference: true,
      quote: { select: { status: true, request: { select: { id: true, title: true, status: true, client: { select: { name: true } } } } } },
      payments: {
        where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] }, livemode: false, paymentIntentId: { not: null } },
        select: { id: true, amountMillimes: true, updatedAt: true, paymentIntentId: true, allocation: true },
      },
    },
    });
    const sanctions = await tx.professionalSanction.findMany({ where: { professionalId, status: "APPLIED", amountMillimes: { gt: 0 } }, select: { id: true, amountMillimes: true, appliedAt: true, decisionReason: true, reason: true, requestId: true, request: { select: { title: true, client: { select: { name: true } } } } } });
    return { invoices, sanctions };
  }, { isolationLevel: "RepeatableRead" });
  const finance = buildProfessionalFinance(invoices, period.start, sanctions);
  finance.balanceMillimes = buildProfessionalFinance(invoices, null, sanctions).netMillimes;
  return <div className={styles.dashboard}><ProfessionalFinanceDashboard finance={finance} period={period.key} updatedAt={now.toISOString()} /><ProfessionalSanctions professionalId={professionalId} kind="money"/></div>;
}
