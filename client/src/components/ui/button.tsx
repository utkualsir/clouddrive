import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0A0A0A] disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg shadow-none',
        destructive:
          'bg-red-500 hover:bg-red-600 text-white rounded-lg',
        outline:
          'border border-[#E5E5E5] dark:border-[#2A2A2A] bg-transparent hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#F5F5F5] rounded-lg',
        secondary:
          'bg-[#F0F0F0] dark:bg-[#1E1E1E] hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-[#0A0A0A] dark:text-[#F5F5F5] rounded-lg',
        ghost:
          'hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] rounded-lg',
        link:
          'text-[#4F46E5] dark:text-[#6366f1] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-11 px-6 text-base',
        xl:      'h-12 px-8 text-base',
        icon:    'h-9 w-9',
        'icon-sm':'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
