import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { AssetCard } from '@/components/store/asset-card';
import { PageState } from '@/components/page-state';
import { api } from '@/lib/api';
const tools = [
  [
    'Scene Editor 2D',
    'Arrange mockups, manage layers, change colours, and export designs in your browser.',
    '/editor/scene',
  ],
  [
    '3D Editor',
    'Customise 3D product mockups, adjust materials and cameras, and render images or video.',
    '/editor/3d',
  ],
  [
    'AI-powered',
    'Generate scenes and motion with AI. Describe your idea and let the studio do the work.',
    '/editor/scene',
  ],
];
export default function HomePage() {
  const catalog = useQuery({ queryKey: ['home-catalog'], queryFn: () => api.catalogAssets() });
  return (
    <>
      <Seo title="Nesomn Studio" />
      <div className="page-wrap home-editorial">
        <section className="home-hero">
          <div>
            <h1>
              Design the mockup.
              <br />
              <span>Build the scene</span> with AI.
            </h1>
            <p>
              Nesomn Studio brings 2D and 3D editors together with AI generation in one streamlined
              creative workspace.
            </p>
            <div className="workspace-actions">
              <Button size="lg" asChild>
                <Link to="/editor/scene">
                  Start creating <ArrowUpRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/marketplace">Explore assets</Link>
              </Button>
            </div>
          </div>
          <div className="brand-cover" aria-label="Nesomn creative workspace">
            <img src="/nesomn-logo-black.svg" alt="Nesomn logo" />
            <span>
              Creative
              <br />
              workspace.
            </span>
            <Link to="/editor/projects">
              Open projects <ArrowUpRight size={20} />
            </Link>
          </div>
        </section>
        <section className="tool-index" aria-label="Nesomn tools">
          {tools.map(([title, desc, to]) => (
            <Link to={to} key={title}>
              <h2>{title}</h2>
              <p>{desc}</p>
              <ArrowUpRight aria-hidden size={24} />
            </Link>
          ))}
        </section>
        <section className="home-catalog">
          <div className="section-heading">
            <h2>Assets for your next idea.</h2>
            <Link to="/marketplace">
              View catalogue <ArrowUpRight size={18} />
            </Link>
          </div>
          {catalog.isLoading ? (
            <PageState loading title="Loading catalogue…" />
          ) : catalog.isError ? (
            <PageState title="Unable to load the catalogue" retry={() => void catalog.refetch()} />
          ) : catalog.data?.length ? (
            <div className="asset-grid">
              {catalog.data.slice(0, 4).map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <PageState title="No assets are available yet">
              You can still open the editors from the navigation.
            </PageState>
          )}
        </section>
        <footer className="public-footer">
          <span>Nesomn Studio</span>
          <Link to="/pricing">Pricing</Link>
          <Link to="/library">Library</Link>
          <Link to="/account">Account</Link>
        </footer>
      </div>
    </>
  );
}
