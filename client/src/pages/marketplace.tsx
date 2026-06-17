import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Seo } from '@/components/seo';

const CATEGORIES = ['All', 'Free', 'Popular', 'Mockups', '3D Assets', 'Fonts', 'Motion'];

export default function MarketplacePage() {
  return (
    <>
      <Seo
        title="Marketplace"
        description="Jelajahi katalog mockup, aset 3D, font, dan motion pack premium di Nesomn Studio."
      />
      <Topbar title="Marketplace" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Full Catalogue
          </h1>
          <p className="text-sm text-muted-foreground">
            Browser-based. No software needed. Temukan aset siap pakai untuk
            scene dan mockup Anda.
          </p>
        </div>

        {/* Filter chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat}
              className={
                i === 0
                  ? 'rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-accent-foreground'
                  : 'rounded-full border border-border bg-surface-2 px-4 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground'
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid placeholder (skeleton) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} interactive className="overflow-hidden">
              <Skeleton className="aspect-[4/5] w-full rounded-none" />
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
                {i % 3 === 0 && <Badge variant="popular">Popular</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
