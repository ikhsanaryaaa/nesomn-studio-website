import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { useCart } from '@/stores/cart-store';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiRequestError } from '@/lib/api';

function formatIdr(value: string): string {
  const n = Number(value);
  if (!n) return 'Gratis';
  return `Rp${n.toLocaleString('id-ID')}`;
}

export default function AssetDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const cart = useCart();

  const { data: asset, isLoading } = useQuery({
    queryKey: ['catalog', 'asset', slug],
    queryFn: () => api.catalogAsset(slug!),
    enabled: !!slug,
  });

  const claim = useMutation({
    mutationFn: () => api.claimAsset(asset!.id),
    onSuccess: () => {
      toast({ title: 'Aset ditambahkan ke Library', description: asset?.title });
      navigate('/library');
    },
    onError: (err) => {
      const msg =
        err instanceof ApiRequestError ? err.message : 'Gagal menambahkan aset.';
      toast({ title: 'Gagal', description: msg, variant: 'danger' });
    },
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Marketplace" />
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Skeleton className="aspect-video w-full" />
        </div>
      </>
    );
  }

  if (!asset) {
    return (
      <>
        <Topbar title="Marketplace" />
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <p className="text-sm font-medium">Aset tidak ditemukan.</p>
        </div>
      </>
    );
  }

  const isFree = asset.tier === 'free' || Number(asset.priceIdr) === 0;
  const inCart = cart.has(asset.id);

  return (
    <>
      <Seo title={asset.title} description={asset.description ?? undefined} />
      <Topbar title={asset.title} />
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
          {asset.previews[0] ? (
            <img src={asset.previews[0]} alt={asset.title} className="w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
              No preview
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={asset.tier === 'pro' ? 'popular' : 'neutral'}>
              {asset.tier === 'pro' ? 'Pro' : 'Free'}
            </Badge>
            <Badge>{asset.type}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.title}</h1>
          <p className="text-sm text-muted-foreground">
            {asset.description ?? 'Tidak ada deskripsi.'}
          </p>
          <div className="text-xl font-semibold">{formatIdr(asset.priceIdr)}</div>

          <div className="flex flex-col gap-2">
            {isFree ? (
              <Button
                disabled={!isAuthenticated || claim.isPending}
                onClick={() => claim.mutate()}
              >
                {isAuthenticated ? 'Get (gratis)' : 'Login untuk klaim'}
              </Button>
            ) : (
              <Button
                variant={inCart ? 'secondary' : 'primary'}
                onClick={() => (inCart ? cart.remove(asset.id) : cart.add(asset))}
              >
                {inCart ? 'Hapus dari bundle' : 'Tambah ke bundle'}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Lisensi {asset.tier === 'pro' ? 'komersial' : 'standar'}. Item berbayar
              di-checkout sebagai order pending (pembayaran menyusul).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
