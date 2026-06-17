import { useEffect } from 'react';
import {
  DEFAULT_DESCRIPTION,
  formatTitle,
  SITE_NAME,
} from '@/lib/seo-config';

interface SeoProps {
  title: string;
  description?: string;
}

/**
 * Set document title + meta description saat runtime client.
 * Untuk halaman publik, nilai yang sama juga di-inject saat prerender
 * (lihat main.tsx) sehingga HTML statis sudah ber-SEO sebelum hydrate.
 */
export function Seo({ title, description = DEFAULT_DESCRIPTION }: SeoProps) {
  useEffect(() => {
    document.title = formatTitle(title);
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', formatTitle(title));
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', 'website');
  }, [title, description]);

  return null;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
