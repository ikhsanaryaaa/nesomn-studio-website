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
        <span>{failed ? 'Unable to load preview' : 'No preview is available yet'}</span>
      )}
    </div>
  );
}
