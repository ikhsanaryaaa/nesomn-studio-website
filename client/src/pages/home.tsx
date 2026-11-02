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
    'Susun mockup, atur layer, ganti warna, dan ekspor desain langsung dari browser.',
    '/editor/scene',
  ],
  [
    '3D Editor',
    'Kustomisasi mockup produk 3D, atur material, kamera, dan render image atau video.',
    '/editor/3d',
  ],
  [
    'AI-powered',
    'Generate scene dan motion dengan AI. Cukup deskripsikan, biarkan studio yang bekerja.',
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
              Nesomn Studio menyatukan editor 2D, 3D, dan generasi AI dalam satu ruang kerja kreatif
              yang cepat dan elegan.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/editor/scene">
                  Mulai Berkarya <ArrowUpRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/marketplace">Jelajahi aset</Link>
              </Button>
            </div>
          </div>
          <div className="brand-cover" aria-label="Nesomn creative workspace">
            <img src="/nesomn-logo-black.svg" alt="Logo Nesomn" />
            <span>
              Creative
              <br />
              workspace.
            </span>
            <Link to="/editor/projects">
              Buka project <ArrowUpRight size={20} />
            </Link>
          </div>
        </section>
        <section className="tool-index" aria-label="Tools Nesomn">
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
            <h2>Aset untuk ide berikutnya.</h2>
            <Link to="/marketplace">
              Lihat katalog <ArrowUpRight size={18} />
            </Link>
          </div>
          {catalog.isLoading ? (
            <PageState loading title="Memuat katalog…" />
          ) : catalog.isError ? (
            <PageState title="Katalog belum dapat dimuat" retry={() => void catalog.refetch()} />
          ) : catalog.data?.length ? (
            <div className="asset-grid">
              {catalog.data.slice(0, 4).map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <PageState title="Belum ada aset tersedia">
              Editor tetap dapat dibuka dari navigasi.
            </PageState>
          )}
        </section>
        <footer className="public-footer">
          <span>Nesomn Studio</span>
          <Link to="/pricing">Harga</Link>
          <Link to="/library">Library</Link>
          <Link to="/account">Account</Link>
        </footer>
      </div>
    </>
  );
}
