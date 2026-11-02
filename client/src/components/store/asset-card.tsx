import { Link } from 'react-router';
import type { AssetDTO } from '@nesomn/shared';
import { AssetMedia } from './asset-media';
import { rp } from '@/lib/public-flow';
export function AssetCard({ asset }: { asset: AssetDTO }) {
  return (
    <Link className="asset-card" to={'/marketplace/' + asset.slug}>
      <AssetMedia
        key={asset.thumbnail ?? asset.previews[0]}
        src={asset.thumbnail ?? asset.previews[0]}
        title={asset.title}
      />
      <div className="asset-card-caption">
        <div>
          <h3>{asset.title}</h3>
          <p>{asset.category ?? asset.type}</p>
        </div>
        <span>{Number(asset.priceIdr) === 0 ? 'Free' : rp(asset.priceIdr)}</span>
      </div>
    </Link>
  );
}
