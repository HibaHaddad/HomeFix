type RequestSummary = {
  id: number;
  clientId: number;
  professionalId: number | null;
  conversationId: number | null;
  status: string;
  category: string;
  title: string;
  message: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  booking: { startsAt: string } | null;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const bookingDay = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date(value));

// Allow one typing error in a description, without merging unrelated problems.
function sameProblem(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 8 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let differences = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++differences > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return differences + (a.length - i) + (b.length - j) <= 1;
}

export function requestsForTracking<T extends RequestSummary>(requests: T[]): T[] {
  const completed = requests.filter((request) => request.status === "COMPLETED");
  const seen = new Set<number>();
  return requests.filter((request) => {
    if (seen.has(request.id)) return false;
    seen.add(request.id);
    if (request.status !== "SENT" || !request.booking || !request.professionalId) return true;
    return !completed.some((finished) =>
      finished.clientId === request.clientId &&
      finished.professionalId === request.professionalId &&
      finished.conversationId === request.conversationId &&
      finished.category === request.category &&
      normalize(finished.address || "") === normalize(request.address || "") &&
      finished.booking && bookingDay(finished.booking.startsAt) === bookingDay(request.booking!.startsAt) &&
      +new Date(request.createdAt) <= +new Date(finished.updatedAt) &&
      (sameProblem(finished.message, request.message) || sameProblem(finished.title, request.title)),
    );
  });
}
