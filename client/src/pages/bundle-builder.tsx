import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/page-state';
import { Seo } from '@/components/seo';
import { AssetMedia } from '@/components/store/asset-media';
import { useCart } from '@/stores/cart-store';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { rp, loginUrl } from '@/lib/public-flow';
export default function BundleBuilderPage() {
  const cart = useCart(),
    auth = useAuth(),
    navigate = useNavigate();
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const ids = cart.items.map((a) => a.id);
  const price = useQuery({
    queryKey: ['bundle-price', ids, auth.user?.id],
    queryFn: () => api.bundlePrice(ids),
    enabled: ids.length > 0 && auth.isAuthenticated,
  });
  async function checkout() {
    if (pending || !price.data) return;
    setPending(true);
    setError('');
    try {
      const result = await api.checkout(ids);
      cart.clear();
      navigate(result.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout belum berhasil.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="page-wrap">
      <Seo title="Build Your Own Studio Bundle" />
      <header className="page-heading">
        <h1>
          Build Your Own
          <br />
          Studio Bundle
        </h1>
        <p>
          Tambahkan aset dari marketplace. Harga dan diskon dihitung oleh server sebelum pembayaran.
        </p>
      </header>
      <div className="bundle-layout">
        <section>
          {!ids.length ? (
            <PageState title="Bundle masih kosong">
              <Button variant="secondary" asChild>
                <Link to="/marketplace">Jelajahi Marketplace</Link>
              </Button>
            </PageState>
          ) : (
            <ul className="bundle-items">
              {cart.items.map((a) => (
                <li key={a.id}>
                  <AssetMedia src={a.thumbnail ?? a.previews[0]} title={a.title} />
                  <Link to={'/marketplace/' + a.slug}>{a.title}</Link>
                  <Button
                    variant="ghost"
                    aria-label={'Hapus ' + a.title}
                    disabled={pending}
                    onClick={() => cart.remove(a.id)}
                  >
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="order-summary">
          <h2>Ringkasan bundle</h2>
          <p>{ids.length} item dipilih</p>
          {auth.isLoading ? (
            <PageState loading title="Memeriksa sesi…" />
          ) : auth.isError ? (
            <PageState title="Sesi tidak dapat diperiksa" retry={() => void auth.refetch()} />
          ) : !auth.isAuthenticated ? (
            <PageState title="Login untuk melihat harga">
              <Button asChild>
                <Link to={loginUrl('/bundle-builder')}>Login</Link>
              </Button>
            </PageState>
          ) : !ids.length ? (
            <p className="text-muted-foreground">Pilih aset terlebih dahulu.</p>
          ) : price.isLoading ? (
            <PageState loading title="Menghitung harga…" />
          ) : price.isError ? (
            <PageState title="Harga tidak dapat dimuat" retry={() => void price.refetch()} />
          ) : (
            price.data && (
              <>
                <dl className="price-breakdown">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{rp(price.data.subtotalIdr)}</dd>
                  </div>
                  <div>
                    <dt>Diskon</dt>
                    <dd>{rp(price.data.discountIdr)}</dd>
                  </div>
                  <div>
                    <dt>Total sebelum kode unik</dt>
                    <dd>{rp(price.data.totalIdr)}</dd>
                  </div>
                </dl>
                <Button
                  className="w-full"
                  disabled={pending || price.isFetching}
                  onClick={() => void checkout()}
                >
                  {pending ? 'Membuat invoice…' : 'Lanjut ke checkout'}
                </Button>
              </>
            )
          )}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Kode unik dan jumlah bayar final ditampilkan terpisah di checkout QRIS.
          </p>
        </aside>
      </div>
    </div>
  );
}
