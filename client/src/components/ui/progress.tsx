import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-[3px] w-full overflow-hidden rounded-full bg-[#E5E5E5] dark:bg-[#2A2A2A]', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full bg-[#4F46E5] dark:bg-[#6366f1] transition-all duration-700 ease-spring"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
