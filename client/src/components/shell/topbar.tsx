import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TopbarProps {
  title?: string;
  /** Slot di kiri (mis. tabs editor). */
  left?: ReactNode;
  /** Slot di kanan (mis. tombol Export). */
  right?: ReactNode;
  /** Transparan agar menyatu dengan canvas/hero. */
  transparent?: boolean;
}

export function Topbar({ title, left, right, transparent }: TopbarProps) {
  return (
    <header
      className={cn(
        'workspace-topbar',
        transparent ? 'workspace-topbar-transparent' : 'workspace-topbar-surface',
      )}
    >
      {title && <h2 className="workspace-topbar-title">{title}</h2>}
      {left}

      <div className="workspace-topbar-actions">{right}</div>
    </header>
  );
}
