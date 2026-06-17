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

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo + toggle */}
      <div
        className={cn(
          'flex h-14 items-center gap-2 px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-accent">
            <Sparkles className="size-4 text-white" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">
              Nesomn Studio
            </span>
          )}
        </Link>
      </div>

      {/* Nav scrollable */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        <SidebarSection title="Web App" collapsed={collapsed}>
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
            to="/bundle"
            icon={Package}
            label="Bundle"
            collapsed={collapsed}
            badge={{ text: '0', variant: 'count' }}
          />
        </SidebarSection>

        <SidebarSection
          title="Marketplace"
          collapsed={collapsed}
          expandable
          defaultOpen
        >
          <SidebarItem
            to="/marketplace"
            icon={Store}
            label="Full Catalogue"
            collapsed={collapsed}
            end
          />
          <SidebarItem
            to="/marketplace/3d-mockups"
            icon={Box}
            label="3D Mockups"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace/mockups"
            icon={Grid3x3}
            label="Mockups"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace/3d-assets"
            icon={Shapes}
            label="3D Assets / Vector"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace/fonts"
            icon={Type}
            label="Fonts"
            collapsed={collapsed}
          />
          <SidebarItem
            to="/marketplace/motion"
            icon={Film}
            label="Graphic / Motion"
            collapsed={collapsed}
          />
        </SidebarSection>
      </nav>

      {/* Footer: search, pricing, auth */}
      <div className="space-y-3 border-t border-border p-3">
        {!collapsed && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
            <Input
              id="sidebar-search"
              placeholder="Search assets..."
              className="pl-9"
              aria-label="Search assets"
            />
          </div>
        )}

        <Button
          variant="primary"
          size={collapsed ? 'icon' : 'md'}
          className="w-full"
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
                id="sidebar-user-menu"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-surface-2',
                  collapsed && 'justify-center',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {!collapsed && (
                  <span className="flex-1 truncate text-sm font-medium">
                    {user.name}
                  </span>
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
            asChild
          >
            <Link to="/login">
              <LogIn />
              {!collapsed && <span>Login</span>}
            </Link>
          </Button>
        )}

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
      </div>
    </aside>
  );
}
