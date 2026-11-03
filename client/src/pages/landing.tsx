import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Box, Layers, Library, Menu, Minus, Plus, X } from 'lucide-react';
import { Badge, Button } from '@radix-ui/themes';
import { MarketingFooter } from '@/components/marketing/marketing-shell';
import { Seo } from '@/components/seo';
import { PageState } from '@/components/page-state';
import { AssetMedia } from '@/components/store/asset-media';
import type { AssetDTO } from '@nesomn/shared';
import { API_BASE } from '@/lib/site-config';
import { rp } from '@/lib/public-flow';
import './landing.css';
import { LandingHeroPreview } from './landing-hero-preview';

const shop = (import.meta.env.VITE_SHOP_URL || 'https://shop.nesomn.studio').replace(/\/$/, '');
const shopLink = (path: string) => `${shop}${path}`;
const tools = [
  {
    number: '01',
    icon: Layers,
    title: 'Build your scene.',
    name: 'Scene Editor 2D',
    description:
      'Bring images, text, and mockups together. Arrange layers, fine-tune the details, and make the composition yours.',
    href: '/editor/scene',
  },
  {
    number: '02',
    icon: Box,
    title: 'Find a new angle.',
    name: '3D Editor',
    description:
      'Take your ideas into three dimensions. Work with models, materials, lighting, and camera angles in your browser.',
    href: '/editor/3d',
  },
  {
    number: '03',
    icon: Library,
    title: 'Start with something good.',
    name: 'Asset Library',
    description:
      'Discover assets for your next project and keep the ones you own together in your personal library.',
    href: '/marketplace',
  },
];
const questions = [
  [
    'What is Nesomn Studio?',
    'Nesomn is a creative platform with an asset marketplace, a 2D scene editor, and a 3D editor. Explore assets, build compositions, and manage your creative projects in one place.',
  ],
  [
    'Do I need to install anything?',
    'The editors run in your browser. The 3D workspace requires a browser and device with WebGL support. You can try the labelled sample showcase before starting a project.',
  ],
  [
    'Are all assets included with a subscription?',
    'Access depends on the asset, its licence, and your plan. Check the asset details and current pricing in the shop before purchasing.',
  ],
  [
    'How do credits work?',
    'Credits are used for supported AI generation jobs. Available models, credit costs, and your balance are shown in the workspace before you submit a job.',
  ],
  [
    'Where can I find my projects and purchases?',
    'Sign in to the shop to access your dashboard, saved projects, personal asset library, subscription, and payment history.',
  ],
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const catalog = useQuery({
    queryKey: ['landing-catalog'],
    queryFn: async ({ signal }): Promise<AssetDTO[]> => {
      const response = await fetch(`${API_BASE}/catalog/assets`, { credentials: 'omit', signal });
      if (!response.ok) throw new Error('Catalogue unavailable');
      const data: unknown = await response.json();
      if (
        !Array.isArray(data) ||
        data.some(
          (asset) =>
            !asset ||
            typeof asset.id !== 'string' ||
            typeof asset.slug !== 'string' ||
            typeof asset.title !== 'string' ||
            typeof asset.type !== 'string' ||
            !Array.isArray(asset.previews) ||
            asset.previews.some((url: unknown) => typeof url !== 'string') ||
            !Number.isFinite(Number(asset.priceIdr)),
        )
      )
        throw new Error('Invalid catalogue response');
      return data as AssetDTO[];
    },
  });
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuTrigger.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="landing">
      <Seo
        title="Nesomn Studio"
        description="A creative space for your next idea. Explore assets, build 2D scenes, and customise 3D mockups with Nesomn Studio."
      />
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-header landing-container">
        <a className="landing-brand" href="/" aria-label="Nesomn Studio home">
          <img
            className="brand-logo-light"
            src="/nesomn-logo-black.svg"
            alt=""
            width="40"
            height="36"
          />
          <img
            className="brand-logo-dark"
            src="/nesomn-logo-white.svg"
            alt=""
            width="40"
            height="36"
          />
          <span>
            Nesomn<span className="landing-brand-studio"> Studio</span>
          </span>
        </a>
        <nav
          id="landing-navigation"
          className="landing-nav"
          aria-label="Main navigation"
          data-open={menuOpen}
        >
          <a
            href={import.meta.env.VITE_LANDING_URL || '/landing'}
            aria-current="page"
            onClick={closeMenu}
          >
            Home
          </a>
          <a href="/works" onClick={closeMenu}>
            Works
          </a>
          <a href="/about" onClick={closeMenu}>
            About Us
          </a>
          <a className="marketing-mobile-login" href={shopLink('/login')} onClick={closeMenu}>
            Log in
          </a>
        </nav>
        <div className="landing-header-actions">
          <a className="landing-login" href={shopLink('/login')}>
            Log in
          </a>
          <Button size="3" radius="full" asChild>
            <a href={shopLink('/dashboard')}>
              Open studio <ArrowUpRight size={17} aria-hidden />
            </a>
          </Button>
          <Button
            ref={menuTrigger}
            className="landing-menu-toggle"
            variant="surface"
            color="gray"
            size="3"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls="landing-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero landing-container" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <Badge size="3" radius="full" className="landing-eyebrow">
              <span className="landing-status-dot" /> A space for creative possibilities
            </Badge>
            <h1 id="landing-title">
              Your next idea,
              <br />
              made <span className="landing-highlight">visual.</span>
            </h1>
            <div className="landing-hero-bottom">
              <div>
                <p className="landing-lead">
                  From the first asset to the final scene.
                  <br className="landing-desktop-break" /> Your tools, your projects, your creative
                  space.
                </p>
                <div className="landing-actions">
                  <Button size="4" radius="full" asChild>
                    <a href={shopLink('/marketplace')}>
                      Explore assets <ArrowUpRight size={20} aria-hidden />
                    </a>
                  </Button>
                  <Button size="4" radius="full" color="gray" variant="surface" asChild>
                    <a href={shopLink('/editor/scene')}>
                      Start creating <ArrowRight size={20} aria-hidden />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <LandingHeroPreview shopUrl={shop} />
        </section>

        <section
          id="tools"
          className="landing-tools landing-container landing-section"
          aria-labelledby="tools-title"
        >
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">THE CREATIVE TOOLKIT</span>
              <h2 id="tools-title">
                Less setup.
                <br />
                More making.
              </h2>
            </div>
            <p>
              A collection of tools that takes you from finding the right asset to bringing your own
              perspective to it.
            </p>
          </div>
          <div className="landing-tool-list">
            {tools.map(({ number, icon: Icon, title, name, description, href }) => (
              <article className="landing-tool" key={number}>
                <div className="landing-tool-top">
                  <span className="landing-number">{number}</span>
                  <Icon size={25} strokeWidth={1.5} aria-hidden />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <a href={shopLink(href)}>
                  {name}
                  <ArrowUpRight size={18} aria-hidden />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-dimension landing-container" aria-labelledby="dimension-title">
          <div className="landing-dimension-art">
            <img
              src="/demo/models/nesomn-lowpoly-room.svg"
              alt="Original low-poly room sample with furniture and an orange accent wall"
              width="400"
              height="400"
              loading="lazy"
            />
            <Badge color="gray" radius="full">
              Demo / Sample
            </Badge>
          </div>
          <div className="landing-dimension-copy">
            <span className="landing-kicker">A DIFFERENT PERSPECTIVE</span>
            <h2 id="dimension-title">
              Ideas look better
              <br />
              from every angle.
            </h2>
            <p>
              Move beyond a flat canvas. Explore a model, find the right view, and work with the
              details that make a scene feel like yours.
            </p>
            <p className="landing-dimension-note">
              Not sure where to start? Try our original sample models in the read-only 3D showcase.
            </p>
            <Button size="3" radius="full" variant="surface" color="gray" asChild>
              <a href={shopLink('/demo/3d')}>
                Try the 3D demo <ArrowUpRight size={18} aria-hidden />
              </a>
            </Button>
          </div>
        </section>

        <section
          id="assets"
          className="landing-assets landing-container landing-section"
          aria-labelledby="assets-title"
        >
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">THE ASSET STORE</span>
              <h2 id="assets-title">
                A starting point
                <br />
                for something yours.
              </h2>
            </div>
            <a className="landing-text-link" href={shopLink('/marketplace')}>
              Browse the catalogue <ArrowUpRight size={19} aria-hidden />
            </a>
          </div>
          {catalog.isLoading ? (
            <PageState loading title="Loading the catalogue…" />
          ) : catalog.isError ? (
            <PageState title="The catalogue is unavailable" retry={() => void catalog.refetch()}>
              Please try again, or visit the shop to explore the available tools.
            </PageState>
          ) : catalog.data?.length ? (
            <div className="landing-asset-grid">
              {catalog.data.slice(0, 4).map((asset) => (
                <a
                  className="landing-asset"
                  key={asset.id}
                  href={shopLink(`/marketplace/${encodeURIComponent(asset.slug)}`)}
                >
                  <AssetMedia src={asset.thumbnail ?? asset.previews[0]} title={asset.title} />
                  <div className="landing-asset-caption">
                    <div>
                      <h3>{asset.title}</h3>
                      <span>{asset.category ?? asset.type}</span>
                    </div>
                    <span>{Number(asset.priceIdr) === 0 ? 'Free' : rp(asset.priceIdr)}</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="landing-catalog-empty">
              <Library size={30} strokeWidth={1.5} aria-hidden />
              <h3>The catalogue is taking shape.</h3>
              <p>
                No published assets are available yet. You can still explore the creative tools and
                our labelled 3D samples.
              </p>
              <a className="landing-text-link" href={shopLink('/demo/3d')}>
                Explore the sample showcase <ArrowUpRight size={18} aria-hidden />
              </a>
            </div>
          )}
        </section>

        <section
          id="how-it-works"
          className="landing-workflow landing-container landing-section"
          aria-labelledby="workflow-title"
        >
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">FROM IDEA TO OUTPUT</span>
              <h2 id="workflow-title">
                Make it your own.
                <br />
                One step at a time.
              </h2>
            </div>
          </div>
          <ol>
            {[
              [
                'Find your starting point',
                'Browse the asset store, open a saved project, or start a new scene.',
              ],
              [
                'Bring your perspective',
                'Arrange your composition in 2D or work with materials and cameras in 3D.',
              ],
              [
                'Take it beyond the canvas',
                'Save your project and use the export options available in your editor and plan.',
              ],
            ].map(([title, description], index) => (
              <li key={title}>
                <span className="landing-step-number">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-plan landing-container" aria-labelledby="plan-title">
          <div>
            <span className="landing-kicker">YOUR PACE. YOUR WORKSPACE.</span>
            <h2 id="plan-title">
              Find the room
              <br />
              you need to create.
            </h2>
            <p>
              Compare editor access, subscription benefits, and credits in the shop. Choose what
              fits the way you work.
            </p>
            <Button size="4" radius="full" asChild>
              <a href={shopLink('/pricing')}>
                Explore plans <ArrowUpRight size={20} aria-hidden />
              </a>
            </Button>
          </div>
          <div className="landing-plan-type" aria-hidden>
            MAKE
            <br />
            <span>IT YOURS.</span>
            <ArrowUpRight size={76} strokeWidth={1} />
          </div>
        </section>

        <section
          id="faq"
          className="landing-faq landing-container landing-section"
          aria-labelledby="faq-title"
        >
          <div>
            <span className="landing-kicker">A FEW GOOD QUESTIONS</span>
            <h2 id="faq-title">
              Before you
              <br />
              dive in.
            </h2>
            <p>Get to know your creative workspace.</p>
          </div>
          <div className="landing-faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span className="landing-faq-icon">
                    <Plus size={19} className="landing-faq-plus" aria-hidden />
                    <Minus size={19} className="landing-faq-minus" aria-hidden />
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-closing landing-container">
          <span className="landing-kicker">YOUR NEXT CHAPTER</span>
          <h2>
            Good ideas deserve
            <br />
            <span className="landing-highlight">a little space.</span>
          </h2>
          <Button size="4" radius="full" asChild>
            <a href={shopLink('/dashboard')}>
              Step into your studio <ArrowUpRight size={20} aria-hidden />
            </a>
          </Button>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
