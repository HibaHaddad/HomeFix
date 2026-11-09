export type FinancePeriod = "all" | "month" | "30days" | "90days" | "year";
export type FinanceTransaction = {
  id: string;
  kind: "gain" | "sanction" | "pending";
  amountMillimes: number;
  date: string;
  title: string;
  client: string;
  requestId: number;
  invoiceId: number;
  reference: string | null;
  receiptUrl: string | null;
  reason?: string;
};
export type ProfessionalFinance = {
  earnedMillimes: number;
  sanctionsMillimes: number;
  netMillimes: number;
  pendingMillimes: number;
  transactions: FinanceTransaction[];
};
type FinanceInvoice = {
  id: number; totalMillimes: number; paidMillimes: number; status: string; createdAt: Date;
  receiptUrl: string | null; paymentReference: string | null;
  quote: { status: string; request: { id: number; title: string; status: string; client: { name: string } } };
  // Only webhook-confirmed Stripe Test payments are selected by the server.
  payments: { id: string; amountMillimes: number; updatedAt: Date; paymentIntentId: string | null }[];
};

export function financePeriod(raw: string | undefined, now = new Date()): { key: FinancePeriod; start: Date | null } {
  const key = (["all", "month", "30days", "90days", "year"] as const).find((value) => value === raw) ?? "all";
  if (key === "all") return { key, start: null };
  // Tunis is UTC+1 year-round. Calendar periods begin at midnight in Tunisia.
  const tunis = new Date(now.getTime() + 3600000);
  const year = tunis.getUTCFullYear(), month = tunis.getUTCMonth();
  const start = key === "month" ? new Date(Date.UTC(year, month, 1) - 3600000)
    : key === "year" ? new Date(Date.UTC(year, 0, 1) - 3600000)
    : new Date(now.getTime() - (key === "30days" ? 30 : 90) * 86400000);
  return { key, start };
}

export function buildProfessionalFinance(invoices: FinanceInvoice[], start: Date | null): ProfessionalFinance {
  const transactions: FinanceTransaction[] = [];
  const seen = new Set<string>();
  for (const invoice of invoices) {
    const request = invoice.quote.request;
    const common = { title: request.title, client: request.client.name, requestId: request.id, invoiceId: invoice.id };
    for (const payment of invoice.payments) {
      // paidMillimes and priorPaidMillimes are cumulative balances, never additional gains.
      if (!payment.paymentIntentId || seen.has(payment.paymentIntentId)) continue;
      seen.add(payment.paymentIntentId);
      if (start && payment.updatedAt < start) continue;
      transactions.push({ ...common, id: `gain-${payment.id}`, kind: "gain", amountMillimes: payment.amountMillimes,
        date: payment.updatedAt.toISOString(), reference: payment.paymentIntentId,
        receiptUrl: invoice.paymentReference === payment.paymentIntentId && invoice.receiptUrl?.startsWith("https://") ? invoice.receiptUrl : null });
    }
    const balance = Math.max(0, invoice.totalMillimes - invoice.paidMillimes);
    if (balance && invoice.status !== "PAID" && invoice.quote.status === "ACCEPTED"
      && !["CANCELLED", "REJECTED"].includes(request.status) && (!start || invoice.createdAt >= start)) {
      transactions.push({ ...common, id: `pending-${invoice.id}`, kind: "pending", amountMillimes: balance,
        date: invoice.createdAt.toISOString(), reference: null, receiptUrl: null });
    }
  }
  transactions.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const earnedMillimes = transactions.reduce((sum, row) => sum + (row.kind === "gain" ? row.amountMillimes : 0), 0);
  const pendingMillimes = transactions.reduce((sum, row) => sum + (row.kind === "pending" ? row.amountMillimes : 0), 0);
  // Interface reserved for future sanctions, without a sanction management system.
  const sanctionsMillimes = 0;
  return { transactions, earnedMillimes, sanctionsMillimes, netMillimes: earnedMillimes - sanctionsMillimes, pendingMillimes };
}

export function financeMoney(millimes: number) {
  return `${new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(millimes / 1000)} DT`;
}
