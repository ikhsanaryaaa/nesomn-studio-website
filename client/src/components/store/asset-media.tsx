import { useState } from 'react';
export function AssetMedia({
  src,
  title,
  className = '',
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={'asset-media ' + className}>
      {src && !failed ? (
        <img src={src} alt={title} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>{failed ? 'Preview tidak dapat dimuat' : 'Preview belum tersedia'}</span>
      )}
    </div>
  );
}
