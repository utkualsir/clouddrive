import { ChevronRight } from 'lucide-react';
import { BreadcrumbItem } from '@/types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (id: string | null) => void;
}

export default function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-0.5 px-4 py-2 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
      {items.map((item, idx) => (
        <div key={item.id ?? 'root'} className="flex items-center gap-0.5">
          {idx > 0 && (
            <ChevronRight className="w-3.5 h-3.5 text-[#AAAAAA] dark:text-[#444444] shrink-0 mx-0.5" strokeWidth={1.5} />
          )}
          {idx === items.length - 1 ? (
            <span className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] px-1.5 py-1">
              {item.name}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(item.id)}
              className="text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] px-1.5 py-1 rounded-md hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors duration-150"
            >
              {item.name}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
