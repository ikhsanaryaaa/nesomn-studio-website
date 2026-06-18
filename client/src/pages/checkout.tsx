import { useSearchParams, useNavigate } from 'react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck, CreditCard } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { api, ApiRequestError } from '@/lib/api';

/**
 * Halaman checkout. Untuk gateway stub (dev), menampilkan ringkasan order
 * dan tombol simulasi pembayaran yang memicu grant server-side. Untuk
 * gateway nyata, alur ini diganti redirect ke URL gateway.
 */
function formatIdr(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const orderId = params.get('order');
  const [paying, setPaying] = useState(false);

  // Ambil order dari riwayat (sumber kebenaran server).
  const history = useQuery({ queryKey: ['billing-history'], queryFn: () => api.billing.history() });
  const order = history.data?.find((o) => o.id === orderId);

  async function handlePay() {
    if (!orderId) return;
    setPaying(true);
    try {
      await api.billing.devPay(orderId);
      toast({ title: 'Pembayaran berhasil', description: 'Pesanan Anda telah diproses.' });
      navigate('/account');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Gagal memproses pembayaran.';
      toast({ title: 'Pembayaran gagal', description: msg, variant: 'danger' });
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <Seo title="Checkout" description="Selesaikan pembayaran pesanan Nesomn Studio." />
      <Topbar title="Checkout" />
      <div className="mx-auto max-w-lg px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {history.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !order ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Pesanan tidak ditemukan. Silakan ulangi dari halaman pricing.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex flex-col">
                    <span className="font-medium capitalize">{order.type}</span>
                    <span className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)}</span>
                  </div>
                  <span className="font-mono text-lg font-bold">{formatIdr(order.amountIdr)}</span>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-success" />
                  Pembayaran diproses dengan aman. Harga sudah termasuk pajak.
                </div>

                {order.status === 'paid' ? (
                  <p className="text-center text-sm text-success">Pesanan ini sudah dibayar.</p>
                ) : (
                  <Button id="pay-now" onClick={handlePay} disabled={paying} className="w-full">
                    {paying ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {paying ? 'Memproses...' : `Bayar ${formatIdr(order.amountIdr)}`}
                  </Button>
                )}
                <p className="text-center text-xs text-faint-foreground">
                  Mode simulasi (gateway stub). Integrasi Pakasir/Stripe aktif saat kredensial diisi.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
