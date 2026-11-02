/** UTC calendar arithmetic anchored to the original billing date. */
export function addCalendarMonths(anchor: Date, months: number): Date {
  if (!Number.isInteger(months) || !Number.isFinite(anchor.getTime()))
    throw new Error('Invalid period');
  const result = new Date(anchor);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(anchor.getUTCDate(), last));
  return result;
}

export function creditPeriod(anchor: Date, now: Date, end: Date) {
  if (now < anchor || now >= end) throw new Error('Outside subscription period');
  let month =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    anchor.getUTCMonth();
  if (addCalendarMonths(anchor, month) > now) month--;
  const start = addCalendarMonths(anchor, month);
  return {
    start,
    end: new Date(Math.min(addCalendarMonths(anchor, month + 1).getTime(), end.getTime())),
  };
}

export function extendBillingPeriod(anchor: Date, end: Date, cycle: 'monthly' | 'yearly') {
  const months =
    (end.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    anchor.getUTCMonth();
  if (months < 1 || addCalendarMonths(anchor, months).getTime() !== end.getTime())
    throw new Error('Legacy/manual period needs reconciliation before renewal.');
  return addCalendarMonths(anchor, months + (cycle === 'yearly' ? 12 : 1));
}
