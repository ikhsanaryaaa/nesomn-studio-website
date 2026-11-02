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
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main-content" className="skip-link">
        Lewati navigasi
      </a>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-3 py-2 md:hidden">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger
              className="flex min-h-11 items-center gap-2 rounded-md px-3"
              aria-label="Buka navigasi"
            >
              <Menu size={20} />
              Menu
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(320px,calc(100vw_-_32px))] bg-surface shadow-lg">
                <Dialog.Title className="sr-only">Navigasi Nesomn Studio</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Pilih editor, katalog aset, harga atau akun.
                </Dialog.Description>
                <Dialog.Close
                  className="absolute right-1 top-1 z-10 flex size-11 items-center justify-center rounded-md bg-surface"
                  aria-label="Tutup navigasi"
                >
                  <X size={20} />
                </Dialog.Close>
                <Sidebar mobile />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <ThemeControl />
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PageTransition key={epoch}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
