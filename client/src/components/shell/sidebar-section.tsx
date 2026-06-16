import { useState, type ReactNode } from 'react';
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

  return (
    <div className="flex flex-col gap-1">
      {!collapsed && (
        <button
          type="button"
          disabled={!expandable}
          onClick={() => expandable && setOpen((v) => !v)}
          className={cn(
            'flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground',
            expandable && 'cursor-pointer hover:text-foreground',
          )}
        >
          <span>{title}</span>
          {expandable && (
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200',
                !open && '-rotate-90',
              )}
            />
          )}
        </button>
      )}
      {collapsed && <div className="my-1 h-px bg-border" />}
      {(open || collapsed) && (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
    </div>
  );
}
