import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { ThemeControl } from '@/components/shell/theme-control';
import { isLandingHost } from '@/lib/site-config';
import './marketing-shell.css';
import { ContactIcon } from './contact-icon';

const marketingHome = () => (isLandingHost() ? '/' : '/landing');
const shop = (import.meta.env.VITE_SHOP_URL || 'https://shop.nesomn.studio').replace(/\/$/, '');

export function MarketingShell({
  children,
  active = 'works',
}: {
  children: ReactNode;
  active?: 'home' | 'works' | 'about';
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return (
    <div className="marketing-shell">
      <a className="marketing-skip" href="#marketing-main">
        Skip to content
      </a>
      <header className="marketing-header marketing-container">
        <Link className="marketing-brand" to={marketingHome()} aria-label="Nesomn Studio home">
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
            Nesomn<span className="marketing-brand-studio"> Studio</span>
          </span>
        </Link>
        <nav
          ref={menu}
          id="marketing-navigation"
          className="marketing-navigation"
          aria-label="Main navigation"
          data-open={open}
        >
          <Link
            to={marketingHome()}
            aria-current={active === 'home' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/works"
            aria-current={active === 'works' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            Works
          </Link>
          <Link
            to="/about"
            aria-current={active === 'about' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            About Us
          </Link>
          <a
            className="marketing-mobile-login"
            href={shop + '/login'}
            onClick={() => setOpen(false)}
          >
            Log in
          </a>
        </nav>
        <div className="marketing-header-actions">
          <a className="marketing-login" href={shop + '/login'}>
            Log in
          </a>
          <Button size="3" radius="full" asChild>
            <a href={shop + '/dashboard'}>
              Open studio <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </Button>
          <Button
            ref={trigger}
            className="marketing-menu-toggle"
            size="3"
            variant="surface"
            color="gray"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="marketing-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </Button>
        </div>
      </header>
      <main id="marketing-main">{children}</main>
      <MarketingFooter />
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer marketing-container">
      <section className="marketing-contact-cta">
        <h2>Have something in mind?</h2>
        <Button size="3" radius="full" asChild>
          <Link to="/about#contact">
            Let’s talk <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </Button>
      </section>
      <div className="marketing-footer-columns">
        <div>
          <Link className="marketing-footer-brand" to={marketingHome()}>
            <img
              src="/nesomn-logo-black.svg"
              className="brand-logo-light"
              alt=""
              width="36"
              height="32"
            />
            <img
              src="/nesomn-logo-white.svg"
              className="brand-logo-dark"
              alt=""
              width="36"
              height="32"
            />
            Nesomn Studio
          </Link>
          <p>A creative space for your next idea.</p>
        </div>
        <nav aria-label="Explore">
          <strong>Explore</strong>
          <Link to={marketingHome()}>Home</Link>
          <Link to="/works">Works</Link>
          <Link to="/about">About Us</Link>
        </nav>
        <nav aria-label="Studio">
          <strong>Studio</strong>
          <a href={shop + '/marketplace'}>Asset Store</a>
          <a href={shop + '/editor/scene'}>Scene Editor</a>
          <a href={shop + '/editor/3d'}>3D Editor</a>
        </nav>
        <nav aria-label="Get in touch">
          <strong>Get in touch</strong>
          <a href="mailto:contact@nesomn.studio">
            <ContactIcon kind="mail" />
            contact@nesomn.studio
          </a>
          <a href="https://instagram.com/nesomnstudio" target="_blank" rel="noopener noreferrer">
            <ContactIcon kind="instagram" />
            Instagram ↗
          </a>
          <a href="https://wa.me/6285183159776" target="_blank" rel="noopener noreferrer">
            <ContactIcon kind="whatsapp" />
            WhatsApp ↗
          </a>
          <a href="https://t.me/nesomnstudio" target="_blank" rel="noopener noreferrer">
            <ContactIcon kind="telegram" />
            Telegram ↗
          </a>
        </nav>
      </div>
      <div className="marketing-footer-bottom">
        <span>© {new Date().getFullYear()} Nesomn Studio</span>
        <ThemeControl />
      </div>
    </footer>
  );
}
