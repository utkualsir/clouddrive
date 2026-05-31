import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

const DropdownMenu          = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger   = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup     = DropdownMenuPrimitive.Group;
const DropdownMenuPortal    = DropdownMenuPrimitive.Portal;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-[#E5E5E5] dark:bg-[#2A2A2A]', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[160px] overflow-hidden rounded-lg',
        'bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A]',
        'shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
        'p-1 animate-modal-in',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
      'text-[#0A0A0A] dark:text-[#F5F5F5] outline-none',
      'transition-colors duration-100',
      'hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]',
      'focus:bg-[#F8F8F8] dark:focus:bg-[#1E1E1E]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSeparator,
};
