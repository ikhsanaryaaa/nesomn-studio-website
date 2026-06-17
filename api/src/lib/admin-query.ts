import { z } from 'zod';
import { asc, desc, type SQL } from 'drizzle-orm';

/**
 * Parser query list selaras dialek @refinedev/simple-rest:
 * `_start`/`_end` (range), `_sort`/`_order` (urut). Dipakai semua endpoint
 * list admin agar data provider Refine bisa dipakai tanpa kustomisasi berat.
 */
const querySchema = z.object({
  _start: z.coerce.number().int().min(0).optional(),
  _end: z.coerce.number().int().min(0).optional(),
  _sort: z.string().optional(),
  _order: z.enum(['asc', 'ASC', 'desc', 'DESC']).optional(),
});

export type ListRange = {
  offset: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
};

/** Ubah query mentah jadi range + sort yang aman. */
export function parseListQuery(raw: unknown): ListRange {
  const q = querySchema.parse(raw ?? {});
  const start = q._start ?? 0;
  const end = q._end ?? start + 25;
  const limit = Math.min(Math.max(end - start, 1), 200);
  return {
    offset: start,
    limit,
    sort: q._sort,
    order: (q._order ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
  };
}

/**
 * Bangun klausa ORDER BY dari kolom yang diizinkan.
 * `columns` memetakan nama field (dari _sort) ke kolom Drizzle.
 */
export function buildOrderBy(
  range: ListRange,
  columns: Record<string, unknown>,
  fallback: unknown,
): SQL {
  const col = (range.sort && columns[range.sort]) || fallback;
  return (range.order === 'desc' ? desc(col as never) : asc(col as never)) as SQL;
}

/**
 * Set header x-total-count yang dibaca Refine untuk pagination.
 * `set.headers` dari konteks Elysia.
 */
export function setTotalCount(
  set: { headers: Record<string, string | number> },
  total: number,
): void {
  set.headers['x-total-count'] = String(total);
  set.headers['access-control-expose-headers'] = 'x-total-count';
}
