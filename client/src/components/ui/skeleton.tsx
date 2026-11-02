import { Skeleton as ThemesSkeleton } from '@radix-ui/themes';
import { cn } from '@/lib/utils';
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <ThemesSkeleton className={cn('ui-skeleton', className)}>
      <div {...props} />
    </ThemesSkeleton>
  );
}
