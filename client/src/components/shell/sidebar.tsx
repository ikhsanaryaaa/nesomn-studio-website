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
import './sidebar.css';

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
        'sidebar-shell',
        collapsed && 'sidebar-shell-collapsed',
        mobile && 'sidebar-shell-mobile',
        mobile
          ? 'sidebar-full-width'
          : collapsed
            ? 'sidebar-width-collapsed'
            : 'sidebar-width-expanded',
      )}
    >
      {/* Logo + toggle */}
      <div className="sidebar-brand-row">
        <Link to="/" aria-label="Nesomn Studio home" className="sidebar-brand">
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
              <span className="sidebar-wordmark">Nesomn Studio</span>
            </>
          )}
        </Link>
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-collapse"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            id="sidebar-toggle"
          >
            {collapsed ? <PanelLeft /> : <PanelLeftClose />}
          </Button>
        )}
      </div>

      {/* Nav scrollable */}
      <nav aria-label="Main navigation" className="sidebar-navigation">
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
      <div className="sidebar-footer">
        {!collapsed && (
          <form action="/marketplace" className="sidebar-search">
            <Search className="sidebar-search-icon" />
            <Input
              id={mobile ? 'mobile-sidebar-search' : 'sidebar-search'}
              name="q"
              placeholder="Search assets..."
              className="sidebar-search-input"
              aria-label="Search assets"
            />
          </form>
        )}

        <div className="sidebar-footer-actions">
          <Button
            variant="primary"
            size={collapsed ? 'icon' : 'md'}
            className="sidebar-full-width"
            aria-label="View pricing"
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
                  aria-label="Account menu"
                  className={cn(
                    'sidebar-account-trigger',
                    collapsed && 'sidebar-account-collapsed',
                  )}
                >
                  <span className="sidebar-account-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  {!collapsed && <span className="sidebar-account-name">{user.name}</span>}
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
                  className="sidebar-account-logout"
                >
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="secondary"
              size={collapsed ? 'icon' : 'md'}
              className="sidebar-full-width"
              aria-label="Log in"
              asChild
            >
              <Link to="/login">
                <LogIn />
                {!collapsed && <span>Log in</span>}
              </Link>
            </Button>
          )}
        </div>
        {!collapsed && !mobile && <ThemeControl />}
      </div>
    </aside>
  );
}
