export const DEFAULT_COMMISSION_BPS = 1000;

export function validateCommissionBps(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10000) throw new Error("La commission doit être comprise entre 0 et 100 %, avec deux décimales au maximum.");
  return value;
}

export const commissionLabel = (bps: number) => `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 2 }).format(bps / 100)} %`;

function roundedRatio(amount: number, numerator: number, denominator: number) {
  for (const value of [amount, numerator, denominator]) if (!Number.isSafeInteger(value) || value < 0) throw new Error("Montant comptable invalide.");
  if (!denominator) throw new Error("Diviseur comptable invalide.");
  return Number((BigInt(amount) * BigInt(numerator) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator));
}

export function paymentSplit(grossMillimes: number, commissionBps: number) {
  validateCommissionBps(commissionBps);
  const commissionMillimes = roundedRatio(grossMillimes, commissionBps, 10000);
  return { grossMillimes, commissionMillimes, professionalMillimes: grossMillimes - commissionMillimes };
}

export function refundSplit(allocation: { grossMillimes: number; commissionMillimes: number }, cumulativeStripeRefund: number, stripeTotal: number) {
  if (cumulativeStripeRefund > stripeTotal) throw new Error("Le remboursement dépasse le montant du paiement.");
  const refundedMillimes = roundedRatio(allocation.grossMillimes, cumulativeStripeRefund, stripeTotal);
  const refundedCommissionMillimes = allocation.grossMillimes ? roundedRatio(allocation.commissionMillimes, refundedMillimes, allocation.grossMillimes) : 0;
  return { refundedMillimes, refundedCommissionMillimes, refundedProfessionalMillimes: refundedMillimes - refundedCommissionMillimes };
}
