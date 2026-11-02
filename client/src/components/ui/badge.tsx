import { Badge as ThemesBadge } from '@radix-ui/themes';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva('ui-badge', {
  variants: {
    variant: {
      new: 'ui-badge--accent',
      popular: 'ui-badge--accent',
      beta: 'ui-badge--beta',
      save: 'ui-badge--save',
      neutral: 'ui-badge--neutral',
      count: 'ui-badge--count',
    },
  },
  defaultVariants: { variant: 'neutral' },
});
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <ThemesBadge
      {...props}
      color={
        variant === 'save'
          ? 'green'
          : variant === 'neutral' || variant === 'count' || !variant
            ? 'gray'
            : undefined
      }
      variant={variant === 'new' || variant === 'popular' ? 'solid' : 'soft'}
      radius="full"
      className={cn(badgeVariants({ variant }), className)}
    />
  );
}
export { badgeVariants };
