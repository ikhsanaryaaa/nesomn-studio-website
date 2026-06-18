import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { useCart } from '@/stores/cart-store';
import { api } from '@/lib/api';

function rp(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`;
}

export default function BundleBuilderPage() {
  const cart = useCart();
  const { toast } = useToast();
  const ids = cart.items.map((i) => i.id);

  // Harga dihitung server-side setiap kali isi cart berubah.
  const { data: price } = useQuery({
    queryKey: ['bundle-price', ids],
    queryFn: () => api.bundlePrice(ids),
    enabled: ids.length > 0,
  });

  const checkout = async () => {
    try {
      const res = await api.checkout(ids);
      toast({ title: 'Order dibuat', description: res.note });
      cart.clear();
    } catch {
      toast({ title: 'Gagal checkout', variant: 'danger' });
    }
  };

  return (
    <>
      <Seo title="Build Your Own Studio Bundle" description="Susun bundle aset custom dan dapatkan diskon bertingkat." />
      <Topbar title="Bundle Builder" />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            Build Your Own Studio Bundle
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Tambahkan aset dari marketplace. Diskon otomatis: 3+ item -15%, 5+ item -25%, 7+ item -30%.
          </p>

          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-sm font-medium">Bundle masih kosong</p>
              <Link to="/marketplace">
                <Button variant="secondary">Jelajahi Marketplace</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {cart.items.map((a) => (
                <Card key={a.id} className="overflow-hidden">
                  <div className="aspect-[4/5] bg-surface-2">
                    {a.previews[0] && (
                      <img src={a.previews[0]} alt={a.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <span className="truncate text-[13px] font-medium">{a.title}</span>
                    <button
                      onClick={() => cart.remove(a.id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Hapus
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Ringkasan harga */}
        <aside className="h-fit rounded-lg border border-border bg-surface-2 p-5">
          <h2 className="mb-4 text-sm font-semibold">Ringkasan Bundle</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item</span>
              <span>{cart.items.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{rp(price?.subtotalIdr ?? 0)}</span>
            </div>
            <div className="flex justify-between text-emerald-500">
              <span>Diskon ({Math.round((price?.discountRate ?? 0) * 100)}%)</span>
              <span>-{rp(price?.discountIdr ?? 0)}</span>
            </div>
            <div className="my-2 border-t border-border" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{rp(price?.totalIdr ?? 0)}</span>
            </div>
          </div>
          <Button
            className="mt-5 w-full"
            disabled={cart.items.length === 0}
            onClick={checkout}
          >
            Checkout
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Pembayaran diselesaikan di M8. Saat ini membuat order pending.
          </p>
        </aside>
      </div>
    </>
  );
}
