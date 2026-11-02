import { Link } from 'react-router';
import {
  Layers,
  Box,
  Package,
  Store,
  Grid3x3,
  Type,
  Shapes,
  Film,
  Search,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  LogIn,
  User,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';
import { useUiStore } from '@/stores/ui-store';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useCart } from '@/stores/cart-store';
import { ThemeControl } from './theme-control';

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const storedCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const collapsed = mobile ? false : storedCollapsed;
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const count = useCart((s) => s.items.length);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200',
        mobile ? 'w-full' : collapsed ? 'w-20' : 'w-64',
      )}
    >
      {/* Logo + toggle */}
      <div className={cn('flex h-14 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
        <Link
          to="/"
          aria-label="Nesomn Studio beranda"
          className="flex min-h-11 items-center overflow-hidden"
        >
          {collapsed ? (
            <>
              <img
                src="/nesomn-logo-black.svg"
                alt="Nesomn Studio"
                className="brand-logo brand-logo-light"
              />
              <img
                src="/nesomn-logo-white.svg"
                alt="Nesomn Studio"
                className="brand-logo brand-logo-dark"
              />
            </>
          ) : (
            <>
              <img
                src="/nesomn-logo-black.svg"
                alt="Nesomn Studio"
                className="brand-logo brand-logo-light"
              />
              <img
                src="/nesomn-logo-white.svg"
                alt="Nesomn Studio"
                className="brand-logo brand-logo-dark"
              />
              <span className="font-display text-base font-bold">Nesomn Studio</span>
            </>
          )}
        </Link>
      </div>

      {/* Nav scrollable */}
      <nav
        aria-label="Navigasi utama"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-2"
      >
        <SidebarSection title="Web App" collapsed={collapsed}>
          <SidebarItem
            to="/editor/projects"
            icon={Layers}
            label="My Projects"
            collapsed={collapsed}
          />
          <SidebarItem to="/library" icon={Package} label="Asset Library" collapsed={collapsed} />
          <SidebarItem
            to="/editor/scene"
            icon={Layers}
            label="Scene Editor"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/editor/3d"
            icon={Box}
            label="3D Editor"
            collapsed={collapsed}
            badge={{ text: 'New', variant: 'new' }}
          />
        </SidebarSection>

        <SidebarSection title="Asset Store" collapsed={collapsed}>
          <SidebarItem
            to="/bundle-builder"
            icon={Package}
            label="Bundle"
            collapsed={collapsed}
            badge={{ text: String(count), variant: 'count' }}
          />
        </SidebarSection>

        <SidebarSection title="Marketplace" collapsed={collapsed} expandable defaultOpen>
          <SidebarItem
            to="/marketplace"
            icon={Store}
            label="Full Catalogue"
            collapsed={collapsed}
            end
          />
          <SidebarItem
            to="/marketplace?type=mockup3d"
            icon={Box}
            label="3D Mockups"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace?type=mockup2d"
            icon={Grid3x3}
            label="Mockups"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace?type=asset3d"
            icon={Shapes}
            label="3D Assets / Vector"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace?type=font"
            icon={Type}
            label="Fonts"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace?type=motion"
            icon={Film}
            label="Graphic / Motion"
            collapsed={collapsed}
          />
        </SidebarSection>
      </nav>

      {/* Footer: search, pricing, auth */}
      <div className="shrink-0 space-y-2 border-t border-border p-3">
        {!collapsed && !mobile && <ThemeControl />}
        {!collapsed && (
          <form action="/marketplace" className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
            <Input
              id={mobile ? 'mobile-sidebar-search' : 'sidebar-search'}
              name="q"
              placeholder="Search assets..."
              className="pl-9"
              aria-label="Search assets"
            />
          </form>
        )}

        <Button
          variant="primary"
          size={collapsed ? 'icon' : 'md'}
          className="w-full"
          aria-label="Lihat harga"
          asChild
        >
          <Link to="/pricing">
            <Sparkles />
            {!collapsed && <span>View Pricing</span>}
          </Link>
        </Button>

        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                id={mobile ? 'mobile-sidebar-user-menu' : 'sidebar-user-menu'}
                aria-label="Menu akun"
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-surface-2',
                  collapsed && 'justify-center',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {!collapsed && (
                  <span className="flex-1 truncate text-sm font-medium">{user.name}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account">
                  <User />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => logout.mutate()}
                className="text-danger focus:bg-danger/10"
              >
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="secondary"
            size={collapsed ? 'icon' : 'md'}
            className="w-full"
            aria-label="Login"
            asChild
          >
            <Link to="/login">
              <LogIn />
              {!collapsed && <span>Login</span>}
            </Link>
          </Button>
        )}

        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            id="sidebar-toggle"
          >
            {collapsed ? <PanelLeft /> : <PanelLeftClose />}
          </Button>
        )}
      </div>
    </aside>
  );
}
