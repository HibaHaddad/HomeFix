export const REVIEW_EDIT_MS = 7 * 24 * 60 * 60 * 1000;
export function reviewContent(body: Record<string, unknown>) {
  const rating = body.rating === undefined || body.rating === null || body.rating === "" ? null : Number(body.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error("Choisissez une note de 1 à 5 étoiles.");
  if (body.comment !== undefined && typeof body.comment !== "string") throw new Error("Commentaire invalide.");
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length > 3000) throw new Error("Le commentaire est limité à 3 000 caractères.");
  if (rating === null && !comment) throw new Error("Ajoutez une note ou un commentaire.");
  return { rating, comment };
}

export function paymentMatches(payment: { amountMillimes: number; stripeAmount?: number | null; currency: string; livemode: boolean }, session: { amount_total: number | null; currency: string | null; livemode: boolean }) {
  return !payment.livemode && !session.livemode && session.currency === payment.currency && session.amount_total === (payment.stripeAmount ?? payment.amountMillimes);
}

export function testCurrencyPlan(supported: string[], balanceMillimes: number, config: { currency?: string; rate?: string } = {}) {
  if (!Number.isSafeInteger(balanceMillimes) || balanceMillimes <= 0) throw new Error("Aucun solde valide à régler.");
  const currency = supported.includes("tnd") ? "tnd" : (config.currency || "eur").toLowerCase();
  if (!["tnd", "eur", "usd"].includes(currency) || !supported.includes(currency)) throw new Error("La devise de test choisie n’est pas acceptée par le compte Stripe Test.");
  const rate = currency === "tnd" ? "1" : config.rate || (currency === "eur" ? "0.30" : "0.33");
  if (!/^\d{1,3}(\.\d{1,6})?$/.test(rate) || Number(rate) <= 0) throw new Error("Le taux de conversion de test est invalide.");
  const exchangeRatePpm = Math.round(Number(rate) * 1000000);
  const divisor = BigInt(currency === "tnd" ? 1000000 : 10000000);
  const stripeAmount = Number((BigInt(balanceMillimes) * BigInt(exchangeRatePpm) + divisor / BigInt(2)) / divisor);
  if (stripeAmount < (currency === "tnd" ? 1 : 50)) throw new Error("Le solde converti est inférieur au minimum de paiement Stripe Test. Le prix ne sera pas augmenté.");
  if (stripeAmount > 99999999) throw new Error("Le montant dépasse la limite de paiement Stripe Test.");
  return { currency, stripeAmount, exchangeRatePpm };
}
export function testMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: currency === "tnd" ? 3 : 2 }).format(amount / (currency === "tnd" ? 1000 : 100));
}
