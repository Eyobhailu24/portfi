"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/shared/utils";

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, defaultValue, value, min = 0, max = 100, ...props }, ref) => {
  // One thumb per value â€” Radix renders thumbs as children, so the count has
  // to be derived from whichever of value/defaultValue is actually in play.
  const thumbCount = React.useMemo(() => {
    if (Array.isArray(value)) return value.length;
    if (Array.isArray(defaultValue)) return defaultValue.length;
    return 1;
  }, [value, defaultValue]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5">
        <SliderPrimitive.Range className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm transition-[color,box-shadow] outline-none hover:ring-4 hover:ring-ring/20 focus-visible:ring-4 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

