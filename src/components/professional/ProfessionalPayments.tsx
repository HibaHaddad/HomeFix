import { prisma } from "@/app/lib/prisma";
import { buildProfessionalFinance, financePeriod } from "@/lib/professional-finance";
import ProfessionalFinanceDashboard from "./ProfessionalFinanceDashboard";
import styles from "./ProfessionalPayments.module.css";

export default async function ProfessionalPayments({ professionalId, period: rawPeriod }: { professionalId: number; period?: string }) {
  const now = new Date();
  const period = financePeriod(rawPeriod, now);
  // Totals use every invoice in a consistent snapshot, independently of pagination.
  const invoices = await prisma.$transaction((tx) => tx.clientInvoice.findMany({
    where: { quote: { request: { professionalId } } },
    select: {
      id: true, totalMillimes: true, paidMillimes: true, status: true, createdAt: true,
      receiptUrl: true, paymentReference: true,
      quote: { select: { status: true, request: { select: { id: true, title: true, status: true, client: { select: { name: true } } } } } },
      payments: {
        where: { status: "SUCCEEDED", livemode: false, paymentIntentId: { not: null } },
        select: { id: true, amountMillimes: true, updatedAt: true, paymentIntentId: true },
      },
    },
  }), { isolationLevel: "RepeatableRead" });
  const finance = buildProfessionalFinance(invoices, period.start);
  return <div className={styles.dashboard}><ProfessionalFinanceDashboard finance={finance} period={period.key} updatedAt={now.toISOString()} /></div>;
}
