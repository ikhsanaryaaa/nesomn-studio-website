import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { AuthGate, PageState } from '@/components/page-state';
import { AssetMedia } from '@/components/store/asset-media';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { api } from '@/lib/api';
export default function LibraryPage() {
  return (
    <AuthGate>
      <LibraryContent />
    </AuthGate>
  );
}
function LibraryContent() {
  const query = useQuery({ queryKey: ['library'], queryFn: () => api.library() }),
    [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState(''),
    [download, setDownload] = useState<{ id: string; url: string } | null>(null);
  async function prepare(id: string) {
    setPending(id);
    setError('');
    setDownload(null);
    try {
      const result = await api.downloadUrl(id);
      const url = new URL(result.url, window.location.origin);
      if (url.protocol !== 'https:' && url.origin !== window.location.origin)
        throw Error('Tautan download tidak valid.');
      setDownload({ id, url: url.href });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download belum tersedia.');
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="page-wrap">
      <Seo title="Asset Library" />
      <header className="page-heading">
        <div>
          <h1>Asset Library</h1>
          <p>Aset milik Anda, siap untuk project berikutnya.</p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/marketplace">Jelajahi katalog</Link>
        </Button>
      </header>
      {query.isLoading ? (
        <PageState title="Memuat Library…" loading />
      ) : query.isError ? (
        <PageState title="Library tidak dapat dimuat" retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <div className="asset-grid">
          {query.data.map((item) => (
            <article key={item.id}>
              <Link to={'/marketplace/' + item.slug}>
                <AssetMedia src={item.previews[0]} title={item.title} />
                <h2 className="my-4 font-semibold">{item.title}</h2>
              </Link>
              <Button
                variant="secondary"
                disabled={pending !== null}
                onClick={() => void prepare(item.id)}
              >
                {pending === item.id ? 'Menyiapkan…' : 'Siapkan download'}
              </Button>
              {download?.id === item.id && (
                <a
                  className="ml-3 text-accent underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={download.url}
                >
                  Buka download
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <PageState title="Belum ada aset dimiliki">
          Klaim aset gratis atau beli melalui katalog.
        </PageState>
      )}
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
