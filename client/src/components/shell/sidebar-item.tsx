import { Link, useLocation } from 'react-router';
import { isSidebarActive } from '@/lib/navigation';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  badge?: { text: string; variant?: 'new' | 'count' | 'beta' };
  end?: boolean;
}

export function SidebarItem({
  to,
  icon: Icon,
  label,
  collapsed = false,
  badge,
  end,
}: SidebarItemProps) {
  const { pathname, search } = useLocation();
  const isActive = isSidebarActive(to, pathname, search, end);
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        'sidebar-nav-item',
        'sidebar-nav-focus',
        collapsed && 'sidebar-nav-item-collapsed',
        isActive ? 'sidebar-nav-item-active' : 'sidebar-nav-item-idle',
      )}
    >
      <>
        {isActive && <span className="sidebar-nav-indicator" />}
        <Icon className="sidebar-nav-icon" />
        {!collapsed && <span className="sidebar-nav-label">{label}</span>}
        {!collapsed && badge && <Badge variant={badge.variant ?? 'count'}>{badge.text}</Badge>}
      </>
    </Link>
  );
}
