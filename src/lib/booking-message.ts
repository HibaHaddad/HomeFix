import { tunisDay, tunisTime } from "./availability";

export function bookingRangeLabel(startsAt: Date, endsAt: Date) {
  const date = (value: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" }).format(value);
  const end = tunisDay(startsAt) === tunisDay(endsAt) ? tunisTime(endsAt) : `${date(endsAt)}, ${tunisTime(endsAt)}`;
  return `${date(startsAt)}, ${tunisTime(startsAt)} – ${end}`;
}

// Keep already stored automatic messages readable without rewriting history.
export function formatBookingChatText(text: string) {
  const time24 = (value: string) => value.replace(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i, (_, hour: string, minute: string, period: string) => `${String(Number(hour) % 12 + (period.toUpperCase() === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}`);
  return text.replace(/^(Votre créneau est accepté|Votre rendez-vous est confirmé) : ([^,\n]+), (\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[–-]\s*\2, (\d{1,2}:\d{2}(?:\s*[AP]M)?)/i, (_, prefix: string, date: string, start: string, end: string) => `${prefix} : ${date}, ${time24(start)} – ${time24(end)}`);
}
