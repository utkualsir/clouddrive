import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[#F0F0F0] dark:bg-[#1E1E1E]', className)}
      {...props}
    />
  );
}

export { Skeleton };
