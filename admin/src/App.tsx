import { Refine, useLogout, useGetIdentity } from '@refinedev/core';
import routerProvider, {
  NavigateToResource,
  CatchAllNavigate,
  UnsavedChangesNotifier,
} from '@refinedev/react-router';
import { BrowserRouter, Routes, Route, Outlet, NavLink, useLocation } from 'react-router';
import { Button, Dialog, Theme } from '@radix-ui/themes';
import { ArrowUpRight, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { LoginPage } from './pages/login';
import { Authenticated } from './components/authenticated';
import { resources } from './resources';
import { adminRoutes } from './routes';
import { useAdminTheme, AdminThemeControl } from './theme';
import { Notifications, notificationProvider } from './components/ui';

const adminOrigin = import.meta.env.VITE_ADMIN_URL;
const dedicatedHost = adminOrigin && window.location.hostname === new URL(adminOrigin).hostname;
const basename = dedicatedHost ? '/' : '/admin';
const shopUrl = import.meta.env.VITE_SHOP_URL || '/';

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const dark = useAdminTheme();
  const logout = useLogout();
  return (
    <aside className="admin-sidebar">
      <a className="admin-brand" href={basename}>
        <img
          src={import.meta.env.BASE_URL + 'nesomn-logo-' + (dark ? 'white' : 'black') + '.svg'}
          alt="Nesomn Studio"
        />
        <span>Studio administration</span>
      </a>
      <nav aria-label="Admin navigation">
        {[
          { key: undefined, title: 'Overview' },
          { key: 'content', title: 'Website content' },
          { key: 'catalog', title: 'Catalogue' },
          { key: 'ai', title: 'AI system' },
          { key: 'system', title: 'System' },
        ].map((group) => (
          <div className="admin-nav-group" key={group.title}>
            <p>{group.title}</p>
            {resources
              .filter((resource) => resource.list && resource.meta?.parent === group.key)
              .map((resource) => (
                <NavLink key={resource.name} to={String(resource.list)} onClick={onNavigate}>
                  {resource.meta?.icon}
                  <span>{resource.meta?.label ?? resource.name}</span>
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
      <footer className="admin-sidebar-footer">
        <AdminThemeControl />
        <a href={shopUrl} target="_blank" rel="noreferrer">
          Visit store <ArrowUpRight size={16} />
        </a>
        <Button variant="soft" color="gray" onClick={() => logout.mutate()}>
          Sign out <LogOut size={16} />
        </Button>
      </footer>
    </aside>
  );
}
function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { data: user } = useGetIdentity<{ name: string; email: string }>();
  const location = useLocation();
  const current = resources.find(
    (resource) => resource.list && location.pathname.startsWith(String(resource.list)),
  );
  return (
    <div className="admin-shell">
      <div className="admin-desktop-sidebar">
        <Sidebar />
      </div>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger>
              <Button
                variant="soft"
                color="gray"
                className="admin-mobile-menu"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </Button>
            </Dialog.Trigger>
            <Dialog.Content className="admin-mobile-drawer" aria-describedby={undefined}>
              <Dialog.Title className="admin-sr-only">Navigation</Dialog.Title>
              <Dialog.Close>
                <Button
                  variant="ghost"
                  className="admin-drawer-close"
                  aria-label="Close navigation"
                >
                  <X />
                </Button>
              </Dialog.Close>
              <Sidebar onNavigate={() => setOpen(false)} />
            </Dialog.Content>
          </Dialog.Root>
          <span className="admin-breadcrumb">
            Nesomn Studio <span>/</span> {current?.meta?.label ?? 'Administration'}
          </span>
          <div className="admin-identity">
            <span className="admin-avatar" aria-hidden="true">
              {user?.name?.[0] ?? 'A'}
            </span>
            <span>
              {user?.name ?? 'Administrator'}
              <small>Admin workspace</small>
            </span>
          </div>
        </header>
        <main id="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export default function App() {
  const dark = useAdminTheme();
  return (
    <BrowserRouter basename={basename}>
      <Theme
        accentColor="orange"
        grayColor="gray"
        radius="large"
        scaling="100%"
        appearance={dark ? 'dark' : 'light'}
        className="admin-radix-theme"
      >
        <Notifications>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={notificationProvider}
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              disableTelemetry: true,
            }}
          >
            <UnsavedChangesNotifier />
            <a className="admin-skip" href="#admin-content">
              Skip to content
            </a>
            <Routes>
              <Route
                element={
                  <Authenticated>
                    <AdminLayout />
                  </Authenticated>
                }
              >
                <Route index element={<NavigateToResource resource="assets-scene" />} />
                {adminRoutes}
                <Route
                  path="*"
                  element={
                    <section className="admin-page">
                      <h1>Page not found</h1>
                      <NavLink to="/">Back to administration</NavLink>
                    </section>
                  }
                />
              </Route>
              <Route
                element={
                  <Authenticated fallback={<Outlet />}>
                    <NavigateToResource resource="assets-scene" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route path="*" element={<CatchAllNavigate to="/login" />} />
            </Routes>
          </Refine>
        </Notifications>
      </Theme>
    </BrowserRouter>
  );
}
