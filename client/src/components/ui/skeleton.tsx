import { cn } from '@/lib/utils';

/** Placeholder loading shimmer (DESIGN.md §9). */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-shimmer rounded-md', className)}
      {...props}
    />
  );
}
