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
        throw Error('The download link is invalid.');
      setDownload({ id, url: url.href });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The download is not available yet.');
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
          <p>Your assets, ready for your next project.</p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/marketplace">Explore the catalogue</Link>
        </Button>
      </header>
      {query.isLoading ? (
        <PageState title="Loading Library…" loading />
      ) : query.isError ? (
        <PageState title="Unable to load your Library" retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <div className="asset-grid">
          {query.data.map((item) => (
            <article key={item.id}>
              <Link to={'/marketplace/' + item.slug}>
                <AssetMedia src={item.previews[0]} title={item.title} />
                <h2 className="library-asset-title">{item.title}</h2>
              </Link>
              <Button
                variant="secondary"
                disabled={pending !== null}
                onClick={() => void prepare(item.id)}
              >
                {pending === item.id ? 'Preparing…' : 'Prepare download'}
              </Button>
              {download?.id === item.id && (
                <a
                  className="library-editor-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={download.url}
                >
                  Open download
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <PageState title="You don't own any assets yet">
          Claim free assets or purchase them from the catalogue.
        </PageState>
      )}
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
    </div>
  );
}
