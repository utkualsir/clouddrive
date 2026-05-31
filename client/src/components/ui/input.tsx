import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-10 w-full border-0 border-b bg-transparent px-0 py-2.5 text-sm text-[#0A0A0A] dark:text-[#F5F5F5]',
      'placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444]',
      'focus-visible:outline-none transition-colors duration-200',
      'disabled:cursor-not-allowed disabled:opacity-40',
      error
        ? 'border-b-red-500 focus-visible:border-b-red-500'
        : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus-visible:border-b-[#4F46E5] dark:focus-visible:border-b-[#6366f1]',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
