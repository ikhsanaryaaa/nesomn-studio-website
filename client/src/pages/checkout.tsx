import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthGate } from '@/components/page-state';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { api } from '@/lib/api';
const rp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
export default function CheckoutPage() {
  const [params] = useSearchParams();
  return (
    <AuthGate>
      <InvoiceContent key={params.get('order') ?? 'missing'} />
    </AuthGate>
  );
}
function InvoiceContent() {
  const qc = useQueryClient();
  const [params] = useSearchParams(),
    id = params.get('order');
  const [confirmed, setConfirmed] = useState(false);
  const [qrError, setQrError] = useState(false);
  const invoice = useQuery({
    queryKey: ['qris-invoice', id],
    queryFn: () => api.billing.invoice(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
    retry: false,
  });
  const value = invoice.data;
  useEffect(() => {
    if (value?.status === 'paid')
      for (const key of ['library', 'billing-history', 'subscription', 'ai-credit'])
        void qc.invalidateQueries({ queryKey: [key] });
  }, [value?.status, qc]);
  return (
    <>
      <Seo title="Checkout QRIS" description="Periksa nominal dan kode unik sebelum membayar." />
      <Topbar title="Checkout" />
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Pembayaran QRIS</h1>
        {!id ? (
          <p role="alert">
            ID pesanan tidak tersedia. <Link to="/account">Buka akun</Link>
          </p>
        ) : invoice.isLoading ? (
          <p role="status">Memuat invoice…</p>
        ) : invoice.isError ? (
          <div role="alert">
            <p>
              Invoice tidak dapat dimuat. Jangan melakukan pembayaran sebelum nominal terverifikasi.
            </p>
            <Button className="mt-4 min-h-11" onClick={() => void invoice.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : value ? (
          <>
            <dl className="divide-y divide-border border-y border-border">
              {(
                [
                  ['Subtotal', value.quote.subtotalIdr],
                  ['Diskon', value.quote.discountIdr ? -value.quote.discountIdr : 0],
                  ['Kode unik', value.code],
                  ['Jumlah bayar', value.payableIdr],
                ] as const
              ).map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-4 py-4">
                  <dt>{label}</dt>
                  <dd className="font-mono font-semibold">{rp(amount)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Kode unik {rp(value.code)} ditambahkan untuk pencocokan pembayaran. Bayar tepat{' '}
              {rp(value.payableIdr)}. Kode ini bagian dari jumlah bayar dan tidak menambah credits.
            </p>
            <section aria-live="polite" className="mt-6">
              {qrError && (
                <p role="alert" className="mb-4">
                  QR belum dapat dimuat. Periksa status dan coba lagi sebelum membayar.
                </p>
              )}
              {value.status === 'paid' ? (
                <p className="font-medium">
                  Pembayaran terverifikasi. <Link to="/account">Buka akun dan riwayat</Link>
                </p>
              ) : value.status === 'pending' ? (
                <>
                  <p className="mb-4 text-sm">
                    Berlaku sampai {new Date(value.expiresAt).toLocaleString('id-ID')}. Status
                    diperbarui dari server.
                  </p>
                  {!confirmed ? (
                    <Button
                      className="min-h-11 w-full"
                      onClick={() => {
                        setQrError(false);
                        setConfirmed(true);
                      }}
                    >
                      Tampilkan QRIS untuk {rp(value.payableIdr)}
                    </Button>
                  ) : (
                    <>
                      <img
                        className="mx-auto aspect-square w-full max-w-80 bg-white p-3"
                        src={`/api/billing/orders/${encodeURIComponent(id)}/qr`}
                        alt={`QRIS pesanan ${id}, jumlah bayar ${rp(value.payableIdr)}`}
                        onError={() => {
                          setQrError(true);
                          setConfirmed(false);
                        }}
                      />
                      <p className="mt-4 text-sm">
                        Pindai QR dengan aplikasi pembayaran Anda. Jangan bayar dua kali saat
                        menunggu konfirmasi.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p role="alert">
                  {value.status === 'expired'
                    ? 'Invoice kedaluwarsa. Jangan gunakan QR ini.'
                    : 'Pembayaran perlu rekonsiliasi. Jangan bayar ulang; hubungi dukungan dengan ID pesanan.'}
                </p>
              )}
              {value.status !== 'paid' && (
                <Button
                  variant="secondary"
                  className="mt-4 min-h-11"
                  disabled={invoice.isFetching}
                  onClick={() => void invoice.refetch()}
                >
                  Periksa status pembayaran
                </Button>
              )}
            </section>
            <p className="mt-6 break-all text-xs text-muted-foreground">ID pesanan: {id}</p>
          </>
        ) : null}
      </div>
    </>
  );
}
