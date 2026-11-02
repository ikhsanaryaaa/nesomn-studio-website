import { forwardRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex min-h-11 w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-3">
      <SliderPrimitive.Range className="absolute h-full bg-accent" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'relative block size-11 rounded-full transition-colors after:absolute after:left-1/2 after:top-1/2 after:size-4 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border-2 after:border-accent after:bg-surface',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
      aria-label="Slider"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
