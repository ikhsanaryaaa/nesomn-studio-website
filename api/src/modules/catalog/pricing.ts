/**
 * Logika harga Bundle Builder (PRD §8.3).
 * Diskon bertingkat berdasarkan jumlah item dalam bundle custom:
 *   - 3-4 item  : -15%
 *   - 5-6 item  : -25%
 *   - >= 7 item : -30%
 *   - < 3 item  : tanpa diskon
 *
 * Fungsi murni: tidak menyentuh DB. Pemanggil menyediakan harga unit.
 */

export type PriceItem = {
  id: string;
  priceIdr: number;
  priceUsd: number;
};

export type BundlePrice = {
  itemCount: number;
  discountRate: number; // 0..1
  subtotalIdr: number;
  subtotalUsd: number;
  discountIdr: number;
  discountUsd: number;
  totalIdr: number;
  totalUsd: number;
};

/** Tentukan rate diskon dari jumlah item. */
export function discountRateFor(itemCount: number): number {
  if (itemCount >= 7) return 0.3;
  if (itemCount >= 5) return 0.25;
  if (itemCount >= 3) return 0.15;
  return 0;
}

/** Bulatkan ke bilangan bulat terdekat (harga ditampilkan tanpa desimal kecil). */
function round(n: number): number {
  return Math.round(n);
}

/** Hitung ringkasan harga bundle dari daftar item. */
export function computeBundlePrice(items: PriceItem[]): BundlePrice {
  const subtotalIdr = items.reduce((sum, i) => sum + i.priceIdr, 0);
  const subtotalUsd = items.reduce((sum, i) => sum + i.priceUsd, 0);
  const discountRate = discountRateFor(items.length);

  const discountIdr = round(subtotalIdr * discountRate);
  const discountUsd = round(subtotalUsd * discountRate * 100) / 100;

  return {
    itemCount: items.length,
    discountRate,
    subtotalIdr: round(subtotalIdr),
    subtotalUsd: round(subtotalUsd * 100) / 100,
    discountIdr,
    discountUsd,
    totalIdr: round(subtotalIdr) - discountIdr,
    totalUsd: round((subtotalUsd - subtotalUsd * discountRate) * 100) / 100,
  };
}
