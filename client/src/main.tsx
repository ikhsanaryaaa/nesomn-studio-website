import { StrictMode } from 'react';
import App from './App';
import './index.css';
import { ROUTE_META, formatTitle, DEFAULT_DESCRIPTION } from './lib/seo-config';

/**
 * Entry ganda:
 * - Di browser: hydrate/render aplikasi ke #root.
 * - Saat build (Node): export `prerender` untuk vite-prerender-plugin,
 *   menghasilkan HTML statis + meta SEO per halaman publik.
 */

if (typeof window !== 'undefined') {
  const { createRoot } = await import('react-dom/client');
  const { BrowserRouter } = await import('react-router');
  const rootEl = document.getElementById('root')!;

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

/** Dipanggil vite-prerender-plugin untuk tiap route publik. */
export async function prerender(data: { url: string }) {
  const { renderToString } = await import('react-dom/server');
  const { StaticRouter } = await import('react-router');

  const html = renderToString(
    <StrictMode>
      <StaticRouter location={data.url}>
        <App />
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
      lang: 'id',
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
