import { Link } from 'react-router';
import type { AssetDTO } from '@nesomn/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** Format harga IDR ringkas (mis. 50000 -> "Rp50.000"). */
function formatIdr(value: string): string {
  const n = Number(value);
  if (!n) return 'Gratis';
  return `Rp${n.toLocaleString('id-ID')}`;
}

/** Kartu aset di grid katalog. Preview pertama jadi thumbnail. */
export function AssetCard({ asset }: { asset: AssetDTO }) {
  const preview = asset.previews[0];
  return (
    <Link to={`/marketplace/${asset.slug}`}>
      <Card interactive className="overflow-hidden">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface-2">
          {preview ? (
            <img
              src={preview}
              alt={asset.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
        </div>
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[13px] font-medium">{asset.title}</span>
            <span className="text-xs text-muted-foreground">{formatIdr(asset.priceIdr)}</span>
          </div>
          {asset.tier === 'pro' ? (
            <Badge variant="popular">Pro</Badge>
          ) : (
            <Badge>Free</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
