import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { PageState } from '@/components/page-state';
import { AssetMedia } from '@/components/store/asset-media';
import { AssetPreview3D } from '@/components/store/asset-preview-3d';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiRequestError } from '@/lib/api';
import { useCart } from '@/stores/cart-store';
import { rp, loginUrl } from '@/lib/public-flow';
export default function AssetDetailPage() {
  const { slug } = useParams(),
    navigate = useNavigate(),
    cart = useCart(),
    auth = useAuth(),
    qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const query = useQuery({
    queryKey: ['catalog', 'asset', slug],
    queryFn: () => api.catalogAsset(slug!),
    enabled: !!slug,
  });
  const claim = useMutation({
    mutationFn: () => api.claimAsset(query.data!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['library'] });
      navigate('/library');
    },
  });
  const asset = query.data;
  if (query.isLoading) return <PageState title="Loading asset…" loading />;
  if (query.isError)
    return (
      <PageState
        title={
          query.error instanceof ApiRequestError && query.error.status === 404
            ? 'Asset not found'
            : 'Unable to load asset details'
        }
        retry={() => void query.refetch()}
      />
    );
  if (!asset) return <PageState title="Asset not found" />;
  const previews = asset.previews.length
    ? asset.previews
    : asset.thumbnail
      ? [asset.thumbnail]
      : [];
  const src = previews[Math.min(index, previews.length - 1)];
  const free = Number(asset.priceIdr) === 0;
  return (
    <div className="page-wrap">
      <Seo title={asset.title} description={asset.description ?? undefined} />
      <Link className="workspace-back-link" to="/marketplace">
        Back to catalogue
      </Link>
      <div className="asset-detail-layout">
        <section>
          {(asset.type === 'mockup3d' || asset.type === 'asset3d') && (
            <AssetPreview3D
              key={asset.slug}
              slug={asset.slug}
              title={asset.title}
              poster={asset.thumbnail ?? asset.previews[0]}
            />
          )}
          <AssetMedia key={src} src={src} title={asset.title} className="detail-media" />
          {previews.length > 1 && (
            <div className="preview-strip" aria-label="Choose a preview">
              {previews.map((p, i) => (
                <button
                  key={p + i}
                  aria-label={'Preview ' + (i + 1)}
                  aria-pressed={index === i}
                  onClick={() => setIndex(i)}
                >
                  <AssetMedia src={p} title={'Preview ' + (i + 1)} />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="asset-details">
          <p className="workspace-description">
            {asset.category ?? asset.type} · {asset.tier}
          </p>
          <h1>{asset.title}</h1>
          <p>{asset.description ?? 'No description is available yet.'}</p>
          <div className="asset-price">{free ? 'Free' : rp(asset.priceIdr)}</div>
          {free ? (
            auth.isAuthenticated ? (
              <Button disabled={claim.isPending} onClick={() => claim.mutate()}>
                {claim.isPending ? 'Adding…' : 'Add to Library'}
              </Button>
            ) : (
              <Button asChild>
                <Link to={loginUrl('/marketplace/' + asset.slug)}>Log in to claim</Link>
              </Button>
            )
          ) : (
            <Button onClick={() => (cart.has(asset.id) ? cart.remove(asset.id) : cart.add(asset))}>
              {cart.has(asset.id) ? 'Remove from bundle' : 'Add to bundle'}
            </Button>
          )}
          {claim.isError && (
            <p role="alert" className="workspace-error">
              {claim.error.message}
            </p>
          )}
          {!free && cart.has(asset.id) && (
            <Button variant="secondary" asChild>
              <Link to="/bundle-builder">Review bundle</Link>
            </Button>
          )}
          <dl className="asset-metadata">
            <div>
              <dt>Editor format</dt>
              <dd>{asset.editorType}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{asset.version}</dd>
            </div>
          </dl>
          <p className="workspace-description">
            This preview shows asset images. Paid items are processed through a QRIS invoice; check
            the unique payment code before paying.
          </p>
        </section>
      </div>
    </div>
  );
}
