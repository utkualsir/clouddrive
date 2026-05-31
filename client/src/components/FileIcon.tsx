import { getFileCategory } from '@/lib/utils';

const categoryConfig = {
  image:      { color: '#10B981', label: 'img' },
  pdf:        { color: '#EF4444', label: 'pdf' },
  video:      { color: '#8B5CF6', label: 'vid' },
  audio:      { color: '#EC4899', label: 'mp3' },
  archive:    { color: '#F59E0B', label: 'zip' },
  word:       { color: '#3B82F6', label: 'doc' },
  excel:      { color: '#10B981', label: 'xls' },
  powerpoint: { color: '#F97316', label: 'ppt' },
  text:       { color: '#6B7280', label: 'txt' },
  other:      { color: '#9CA3AF', label: 'bin' },
};

interface FileTypeTagProps {
  mimeType: string;
  size?: 'sm' | 'md';
}

export function FileTypeTag({ mimeType, size = 'md' }: FileTypeTagProps) {
  const category = getFileCategory(mimeType);
  const { color, label } = categoryConfig[category];
  const ext = mimeType.split('/')[1]?.split('+')[0]?.slice(0, 4)?.toLowerCase() ?? label;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`rounded-full shrink-0 ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
        style={{ backgroundColor: color }}
      />
      <span
        className={`font-mono uppercase tracking-wide text-[#6B6B6B] dark:text-[#888888] ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}
      >
        {ext}
      </span>
    </div>
  );
}

export function getFileColor(mimeType: string): string {
  return categoryConfig[getFileCategory(mimeType)].color;
}

export function FileDot({ mimeType, className = '' }: { mimeType: string; className?: string }) {
  const category = getFileCategory(mimeType);
  const { color } = categoryConfig[category];
  return (
    <div
      className={`w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
