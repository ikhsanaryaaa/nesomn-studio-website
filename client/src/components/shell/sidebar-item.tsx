import { NavLink } from 'react-router';
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
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent-subtle text-foreground'
            : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
          )}
          <Icon className="size-[18px] shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {!collapsed && badge && (
            <Badge variant={badge.variant ?? 'count'}>{badge.text}</Badge>
          )}
        </>
      )}
    </NavLink>
  );
}
