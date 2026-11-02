import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  collapsed?: boolean;
  /** Bila true, judul section dapat di-expand/collapse. */
  expandable?: boolean;
  defaultOpen?: boolean;
}

export function SidebarSection({
  title,
  children,
  collapsed = false,
  expandable = false,
  defaultOpen = true,
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="sidebar-section">
      {!collapsed && (
        <button
          type="button"
          disabled={!expandable}
          aria-expanded={expandable ? open : undefined}
          aria-controls={expandable ? id : undefined}
          onClick={() => expandable && setOpen((v) => !v)}
          className={cn('sidebar-section-title', expandable && 'sidebar-section-expandable')}
        >
          <span>{title}</span>
          {expandable && (
            <ChevronDown
              className={cn('sidebar-section-chevron', !open && 'sidebar-section-closed')}
            />
          )}
        </button>
      )}
      {collapsed && <div className="sidebar-section-divider" />}
      {(open || collapsed) && (
        <div id={id} className="sidebar-section-items">
          {children}
        </div>
      )}
    </div>
  );
}
