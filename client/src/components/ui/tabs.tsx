import { forwardRef } from 'react';
import { Tabs as ThemesTabs } from '@radix-ui/themes';
import { cn } from '@/lib/utils';
const Tabs = ThemesTabs.Root;
const TabsList = forwardRef<
  React.ElementRef<typeof ThemesTabs.List>,
  React.ComponentPropsWithoutRef<typeof ThemesTabs.List>
>(({ className, ...props }, ref) => (
  <ThemesTabs.List ref={ref} className={cn('ui-tabs-list', className)} {...props} />
));
TabsList.displayName = 'TabsList';
const TabsTrigger = forwardRef<
  React.ElementRef<typeof ThemesTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof ThemesTabs.Trigger>
>(({ className, ...props }, ref) => (
  <ThemesTabs.Trigger ref={ref} className={cn('ui-tabs-trigger', className)} {...props} />
));
TabsTrigger.displayName = 'TabsTrigger';
const TabsContent = forwardRef<
  React.ElementRef<typeof ThemesTabs.Content>,
  React.ComponentPropsWithoutRef<typeof ThemesTabs.Content>
>(({ className, ...props }, ref) => (
  <ThemesTabs.Content ref={ref} className={cn('ui-tabs-content', className)} {...props} />
));
TabsContent.displayName = 'TabsContent';
export { Tabs, TabsList, TabsTrigger, TabsContent };
