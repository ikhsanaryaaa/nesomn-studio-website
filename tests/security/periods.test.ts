import { expect, test } from 'bun:test';
import { addCalendarMonths, creditPeriod, extendBillingPeriod } from '../../api/src/lib/periods.ts';

test('calendar billing anchors clamp month ends without cumulative drift', () => {
  const start = new Date('2028-01-31T12:00:00Z');
  expect(addCalendarMonths(start, 1).toISOString()).toBe('2028-02-29T12:00:00.000Z');
  expect(addCalendarMonths(start, 2).toISOString()).toBe('2028-03-31T12:00:00.000Z');
  const period = creditPeriod(start, new Date('2028-03-15'), new Date('2029-01-31T12:00:00Z'));
  expect(period.start.toISOString()).toBe('2028-02-29T12:00:00.000Z');
  expect(period.end.toISOString()).toBe('2028-03-31T12:00:00.000Z');
});

test('renewal keeps original calendar anchor after a short February', () => {
  expect(
    extendBillingPeriod(new Date('2027-01-31'), new Date('2027-02-28'), 'monthly').toISOString(),
  ).toBe('2027-03-31T00:00:00.000Z');
});
