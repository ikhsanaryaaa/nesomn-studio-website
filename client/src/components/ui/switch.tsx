import { forwardRef } from 'react';
import { Switch as ThemesSwitch } from '@radix-ui/themes';
import { cn } from '@/lib/utils';
const Switch = forwardRef<
  React.ElementRef<typeof ThemesSwitch>,
  React.ComponentPropsWithoutRef<typeof ThemesSwitch>
>(({ className, ...props }, ref) => (
  <ThemesSwitch size="3" ref={ref} className={cn('ui-switch', className)} {...props} />
));
Switch.displayName = 'Switch';
export { Switch };
