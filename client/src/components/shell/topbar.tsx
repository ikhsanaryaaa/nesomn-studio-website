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
        'flex h-14 shrink-0 items-center gap-3 border-b border-border px-4',
        transparent ? 'bg-transparent' : 'bg-surface/50',
      )}
    >
      {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
      {left}

      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}
