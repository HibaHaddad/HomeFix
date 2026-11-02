export const HOUR_MS = 60 * 60 * 1000;
export const blockingBookingStatuses = ["PROPOSED", "COUNTER_PROPOSED", "ACCEPTED", "CONFIRMED"];
export const tunisDay = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export const tunisTime = (value: string | Date) => new Intl.DateTimeFormat("fr-TN", { timeZone: "Africa/Tunis", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
export function monthBounds(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mois invalide.");
  const [year, m] = month.split("-").map(Number);
  return { from: new Date(`${month}-01T00:00:00+01:00`), until: new Date(Date.UTC(year, m, 1, -1)) };
}
export function availabilityHours(day: unknown, start: unknown, end: unknown, now = Date.now()) {
  if (typeof day !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(day)) throw new Error("Date invalide.");
  const from = new Date(`${day}T00:00:00+01:00`);
  if (!Number.isFinite(+from) || tunisDay(from) !== day) throw new Error("Date invalide.");
  if (typeof start !== "string" || typeof end !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw new Error("Horaires invalides.");
  const startsAt = new Date(`${day}T${start}:00+01:00`), endsAt = new Date(`${day}T${end}:00+01:00`);
  if (+endsAt <= now || day < tunisDay(new Date(now))) throw new Error("Choisissez une plage qui se termine dans le futur.");
  if (+endsAt <= +startsAt || (+endsAt - +startsAt) % HOUR_MS !== 0) throw new Error("La plage doit contenir des créneaux complets d’une heure, avec une fin après le début.");
  return { startsAt, endsAt, from, until: new Date(+from + 24 * HOUR_MS) };
}
export function splitHours(startsAt: Date, endsAt: Date) {
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  for (let cursor = +startsAt; cursor + HOUR_MS <= +endsAt; cursor += HOUR_MS) slots.push({ startsAt: new Date(cursor), endsAt: new Date(cursor + HOUR_MS) });
  return slots;
}
