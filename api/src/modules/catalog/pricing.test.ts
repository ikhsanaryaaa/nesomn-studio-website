import { describe, expect, it } from 'bun:test';
import { computeBundlePrice, discountRateFor, type PriceItem } from './pricing.ts';

function items(n: number, priceIdr = 100000, priceUsd = 10): PriceItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `a${i}`, priceIdr, priceUsd }));
}

describe('bundle pricing discount tiers', () => {
  it('tanpa diskon untuk kurang dari 3 item', () => {
    expect(discountRateFor(0)).toBe(0);
    expect(discountRateFor(2)).toBe(0);
  });

  it('-15% untuk 3-4 item', () => {
    expect(discountRateFor(3)).toBe(0.15);
    expect(discountRateFor(4)).toBe(0.15);
  });

  it('-25% untuk 5-6 item', () => {
    expect(discountRateFor(5)).toBe(0.25);
    expect(discountRateFor(6)).toBe(0.25);
  });

  it('-30% untuk 7 item atau lebih', () => {
    expect(discountRateFor(7)).toBe(0.3);
    expect(discountRateFor(12)).toBe(0.3);
  });
});

describe('computeBundlePrice', () => {
  it('menghitung subtotal tanpa diskon untuk 2 item', () => {
    const r = computeBundlePrice(items(2));
    expect(r.subtotalIdr).toBe(200000);
    expect(r.discountIdr).toBe(0);
    expect(r.totalIdr).toBe(200000);
  });

  it('menerapkan diskon 15% untuk 3 item', () => {
    const r = computeBundlePrice(items(3));
    expect(r.subtotalIdr).toBe(300000);
    expect(r.discountRate).toBe(0.15);
    expect(r.discountIdr).toBe(45000);
    expect(r.totalIdr).toBe(255000);
  });

  it('menerapkan diskon 30% untuk 7 item', () => {
    const r = computeBundlePrice(items(7));
    expect(r.subtotalIdr).toBe(700000);
    expect(r.discountIdr).toBe(210000);
    expect(r.totalIdr).toBe(490000);
  });

  it('menjumlah harga unit yang berbeda-beda', () => {
    const r = computeBundlePrice([
      { id: 'a', priceIdr: 50000, priceUsd: 5 },
      { id: 'b', priceIdr: 150000, priceUsd: 15 },
      { id: 'c', priceIdr: 100000, priceUsd: 10 },
    ]);
    expect(r.subtotalIdr).toBe(300000);
    expect(r.totalIdr).toBe(255000);
    expect(r.totalUsd).toBe(25.5);
  });

  it('bundle kosong menghasilkan total 0', () => {
    const r = computeBundlePrice([]);
    expect(r.totalIdr).toBe(0);
    expect(r.totalUsd).toBe(0);
  });
});
