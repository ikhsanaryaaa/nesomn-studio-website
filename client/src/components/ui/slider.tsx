import { forwardRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

/** Themes3.3.0 does not forward labels to thumbs; keep named primitives with its official CSS. */
const Slider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(
  (
    {
      className,
      'aria-label': label = 'Slider',
      'aria-labelledby': labelledBy,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn('rt-SliderRoot rt-r-size-3 rt-variant-surface ui-slider', className)}
      {...props}
    >
      <SliderPrimitive.Track className="rt-SliderTrack">
        <SliderPrimitive.Range className="rt-SliderRange" />
      </SliderPrimitive.Track>
      {(value ?? defaultValue ?? [0]).map((_, index, values) => (
        <SliderPrimitive.Thumb
          key={index}
          className="rt-SliderThumb"
          aria-labelledby={labelledBy}
          aria-label={
            labelledBy ? undefined : values.length > 1 ? label + ' ' + (index + 1) : label
          }
        />
      ))}
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = 'Slider';
export { Slider };
