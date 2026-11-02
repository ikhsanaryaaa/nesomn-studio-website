import { forwardRef } from 'react';
import { DropdownMenu as ThemesDropdownMenu } from '@radix-ui/themes';
import { Portal as MenuPortal } from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const DropdownMenu = ThemesDropdownMenu.Root;
type TriggerProps = React.ComponentPropsWithoutRef<typeof ThemesDropdownMenu.Trigger> & {
  asChild?: boolean;
};
const DropdownMenuTrigger = forwardRef<
  React.ElementRef<typeof ThemesDropdownMenu.Trigger>,
  TriggerProps
>(({ asChild = false, children, ...props }, ref) => (
  <ThemesDropdownMenu.Trigger ref={ref} {...props}>
    {asChild ? children : <button type="button">{children}</button>}
  </ThemesDropdownMenu.Trigger>
));
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';
const DropdownMenuGroup = ThemesDropdownMenu.Group;
const DropdownMenuPortal = MenuPortal;

const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof ThemesDropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof ThemesDropdownMenu.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <ThemesDropdownMenu.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn('nesomn-menu', className)}
    {...props}
  />
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

type ItemProps = React.ComponentPropsWithoutRef<typeof ThemesDropdownMenu.Item> & {
  inset?: boolean;
  asChild?: boolean;
};
// Themes3.3.0 forwards asChild to its Radix Item/Slottable, although its public type omits it.
// Keep this pinned compatibility adapter so existing account links retain native anchor semantics.
const CompatibleItem = ThemesDropdownMenu.Item as React.ForwardRefExoticComponent<
  Omit<ItemProps, 'inset'> & React.RefAttributes<HTMLDivElement>
>;
const DropdownMenuItem = forwardRef<React.ElementRef<typeof ThemesDropdownMenu.Item>, ItemProps>(
  ({ className, inset, ...props }, ref) => (
    <CompatibleItem
      ref={ref}
      className={cn('nesomn-menu-item', inset && 'nesomn-menu-item--inset', className)}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof ThemesDropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof ThemesDropdownMenu.Label>
>(({ className, ...props }, ref) => (
  <ThemesDropdownMenu.Label ref={ref} className={cn('nesomn-menu-label', className)} {...props} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';
const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof ThemesDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof ThemesDropdownMenu.Separator>
>(({ className, ...props }, ref) => (
  <ThemesDropdownMenu.Separator ref={ref} className={className} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  Check as DropdownMenuCheck,
};
