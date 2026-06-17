import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Seo } from '@/components/seo';
import { AssetCard } from '@/components/store/asset-card';
import { FilterTabs } from '@/components/store/filter-tabs';
import { api } from '@/lib/api';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Popular', value: 'popular' },
  { label: 'Mockups 2D', value: 'mockup2d' },
  { label: '3D Mockups', value: 'mockup3d' },
  { label: '3D Assets', value: 'asset3d' },
  { label: 'Fonts', value: 'font' },
  { label: 'Graphics', value: 'graphic' },
  { label: 'Motion', value: 'motion' },
];

/** Petakan nilai filter aktif ke query param API. */
function filterToParams(filter: string, q: string) {
  const params: Record<string, string> = {};
  if (q.trim()) params.q = q.trim();
  if (filter === 'free') params.tier = 'free';
  else if (filter === 'popular') params.popular = 'true';
  else if (filter !== 'all') params.type = filter;
  return params;
}

export default function MarketplacePage() {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const { data: assets, isLoading } = useQuery({
    queryKey: ['catalog', filter, q],
    queryFn: () => api.catalogAssets(filterToParams(filter, q)),
  });

  return (
    <>
      <Seo
        title="Marketplace"
        description="Jelajahi katalog mockup, aset 3D, font, dan motion pack premium di Nesomn Studio."
      />
      <Topbar title="Marketplace" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Full Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Browser-based. No software needed. Temukan aset siap pakai untuk scene dan mockup Anda.
          </p>
        </div>

        <div className="mb-4 max-w-md">
          <Input
            placeholder="Cari aset (mis. mockup, kaos, poster)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <FilterTabs options={FILTERS} active={filter} onChange={setFilter} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-[4/5] w-full rounded-none" />
                <CardContent className="p-3">
                  <Skeleton className="h-3.5 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : assets && assets.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="text-sm font-medium">Tidak ada aset ditemukan</p>
            <p className="text-xs text-muted-foreground">
              Coba ubah filter atau kata kunci pencarian.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
