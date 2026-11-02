import { forwardRef } from 'react';
import { Button as ThemesButton, IconButton } from '@radix-ui/themes';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      primary: 'ui-button--primary',
      secondary: 'ui-button--secondary',
      ghost: 'ui-button--ghost',
      danger: 'ui-button--danger',
      link: 'ui-button--link',
    },
    size: {
      sm: 'ui-button--sm',
      md: 'ui-button--md',
      lg: 'ui-button--lg',
      icon: 'ui-button--icon',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const appearance =
      variant === 'secondary'
        ? 'surface'
        : variant === 'danger'
          ? 'outline'
          : variant === 'ghost' || variant === 'link'
            ? 'ghost'
            : 'solid';
    const shared = {
      ...props,
      ref,
      asChild,
      radius: size === 'lg' ? 'full' : undefined,
      variant: appearance,
      color:
        variant === 'danger'
          ? 'red'
          : variant === 'secondary' || variant === 'ghost'
            ? 'gray'
            : undefined,
      className: cn(buttonVariants({ variant, size }), className),
    } as const;
    return size === 'icon' ? (
      <IconButton {...shared} size="3" />
    ) : (
      <ThemesButton {...shared} size={size === 'lg' ? '3' : '2'} />
    );
  },
);
Button.displayName = 'Button';
export { Button, buttonVariants };
