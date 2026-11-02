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
      setError(err instanceof Error ? err.message : 'Unable to start checkout.');
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
          Add assets from the marketplace. Prices and discounts are calculated by the server before
          payment.
        </p>
      </header>
      <div className="bundle-layout">
        <section>
          {!ids.length ? (
            <PageState title="Your bundle is empty">
              <Button variant="secondary" asChild>
                <Link to="/marketplace">Explore Marketplace</Link>
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
                    aria-label={'Remove ' + a.title}
                    disabled={pending}
                    onClick={() => cart.remove(a.id)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="order-summary">
          <h2>Bundle summary</h2>
          <p>Selected items: {ids.length}</p>
          {auth.isLoading ? (
            <PageState loading title="Checking your session…" />
          ) : auth.isError ? (
            <PageState title="Unable to check your session" retry={() => void auth.refetch()} />
          ) : !auth.isAuthenticated ? (
            <PageState title="Log in to view prices">
              <Button asChild>
                <Link to={loginUrl('/bundle-builder')}>Log in</Link>
              </Button>
            </PageState>
          ) : !ids.length ? (
            <p className="workspace-muted">Choose some assets first.</p>
          ) : price.isLoading ? (
            <PageState loading title="Calculating price…" />
          ) : price.isError ? (
            <PageState title="Unable to load prices" retry={() => void price.refetch()} />
          ) : (
            price.data && (
              <>
                <dl className="price-breakdown">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{rp(price.data.subtotalIdr)}</dd>
                  </div>
                  <div>
                    <dt>Discount</dt>
                    <dd>{rp(price.data.discountIdr)}</dd>
                  </div>
                  <div>
                    <dt>Total before the unique payment code</dt>
                    <dd>{rp(price.data.totalIdr)}</dd>
                  </div>
                </dl>
                <Button
                  className="workspace-wide-action"
                  disabled={pending || price.isFetching}
                  onClick={() => void checkout()}
                >
                  {pending ? 'Creating invoice…' : 'Continue to checkout'}
                </Button>
              </>
            )
          )}
          {error && (
            <p role="alert" className="workspace-error">
              {error}
            </p>
          )}
          <p className="workspace-description">
            The unique payment code and final payment amount are shown separately at QRIS checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
