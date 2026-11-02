import { AppTheme } from './components/app-theme';
import { StrictMode } from 'react';
import App from './App';
import './index.css';
import { applyTheme } from '@nesomn/shared/theme';
import { ROUTE_META, formatTitle, DEFAULT_DESCRIPTION } from './lib/seo-config';

/**
 * Entry ganda:
 * - Di browser: hydrate/render aplikasi ke #root.
 * - Saat build (Node): export `prerender` untuk vite-prerender-plugin,
 *   menghasilkan HTML statis + meta SEO per halaman publik.
 */

async function mountBrowser() {
  applyTheme();
  const { createRoot } = await import('react-dom/client');
  const { BrowserRouter } = await import('react-router');
  const rootEl = document.getElementById('root')!;

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <AppTheme>
          <App />
        </AppTheme>
      </BrowserRouter>
    </StrictMode>,
  );
}

// Do not await at module scope: Rollup may share React with the client chunk,
// creating an import cycle which otherwise leaves production bootstrap pending.
if (typeof window !== 'undefined') void mountBrowser();

/** Dipanggil vite-prerender-plugin untuk tiap route publik. */
export async function prerender(data: { url: string }) {
  // Vite's browser resolution opens a MessageChannel that keeps Node alive.
  // The Web Streams entry supports this build-time render without Node builtins.
  const { renderToString } = await import('react-dom/server.edge');
  const { StaticRouter } = await import('react-router');

  const html = renderToString(
    <StrictMode>
      <StaticRouter location={data.url}>
        <AppTheme>
          <App />
        </AppTheme>
      </StaticRouter>
    </StrictMode>,
  );

  const meta = ROUTE_META[data.url] ?? {
    title: 'Nesomn Studio',
    description: DEFAULT_DESCRIPTION,
  };

  return {
    html,
    head: {
      lang: 'en',
      title: formatTitle(meta.title),
      elements: new Set([
        {
          type: 'meta',
          props: { name: 'description', content: meta.description },
        },
        {
          type: 'meta',
          props: { property: 'og:title', content: formatTitle(meta.title) },
        },
        {
          type: 'meta',
          props: { property: 'og:description', content: meta.description },
        },
        {
          type: 'meta',
          props: { property: 'og:type', content: 'website' },
        },
      ]),
    },
  };
}
