import { Theme } from '@radix-ui/themes';
import { useEditorSession } from '@/lib/editor-session';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './sidebar';
import { ThemeControl } from './theme-control';
import { PageTransition } from './page-transition';
import { useUiStore } from '@/stores/ui-store';
export function AppLayout() {
  const epoch = useEditorSession((s) => s.epoch);
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const { pathname, search } = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, search, setMobileOpen]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const close = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, [setMobileOpen]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip navigation
      </a>
      <div className="app-desktop-sidebar">
        <Sidebar />
      </div>
      <div className="app-column">
        <div className="app-mobile-bar">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger className="app-mobile-trigger" aria-label="Open navigation">
              <Menu size={20} />
              Menu
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="app-drawer-overlay" />
              <Theme asChild>
                <Dialog.Content className="app-drawer">
                  <Dialog.Title className="app-accessible-title">
                    Nesomn Studio navigation
                  </Dialog.Title>
                  <Dialog.Description className="app-accessible-title">
                    Choose an editor, asset catalogue, pricing, or account.
                  </Dialog.Description>
                  <Dialog.Close className="app-drawer-close" aria-label="Close navigation">
                    <X size={20} />
                  </Dialog.Close>
                  <Sidebar mobile />
                </Dialog.Content>
              </Theme>
            </Dialog.Portal>
          </Dialog.Root>
          <ThemeControl />
        </div>
        <main id="main-content" tabIndex={-1} className="app-main">
          <div className="app-scroll">
            <PageTransition key={epoch}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
