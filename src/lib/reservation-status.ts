export function reservationStatus(
  requestStatus: string,
  booking: { status: string; startsAt: string | Date },
  now = Date.now(),
) {
  if (["COMPLETED", "CANCELLED", "REJECTED", "EN_ROUTE", "IN_PROGRESS"].includes(requestStatus)) return requestStatus;
  if (requestStatus === "BOOKED") return "CONFIRMED";
  const awaitingConfirmation = ["SENT", "QUOTED", "PRICE_ACCEPTED"].includes(requestStatus) &&
    ["PROPOSED", "COUNTER_PROPOSED", "ACCEPTED"].includes(booking.status);
  return awaitingConfirmation && +new Date(booking.startsAt) <= now ? "EXPIRED" : booking.status;
}
