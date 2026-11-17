/** Calendar dates are interpreted in the platform's Africa/Tunis timezone. */
export function paymentPeriod(from = "", to = "") {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value ? value : "";
  let start = valid(from), end = valid(to);
  if (start && end && start > end) [start, end] = [end, start];
  return {
    from: start, to: end,
    createdAt: {
      ...(start ? { gte: new Date(`${start}T00:00:00+01:00`) } : {}),
      ...(end ? { lt: new Date(Date.parse(`${end}T00:00:00+01:00`) + 86_400_000) } : {}),
    },
  };
}
