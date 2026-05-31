import { LiveCursor, FolderViewer } from '@/types';

interface LiveCursorsProps {
  cursors: LiveCursor[];
  viewers: FolderViewer[];
  containerRef: React.RefObject<HTMLElement | null>;
}

export default function LiveCursors({ cursors, viewers, containerRef }: LiveCursorsProps) {
  if (cursors.length === 0) return null;

  return (
    <>
      {cursors.map(cursor => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const left = (cursor.x / 100) * rect.width;
        const top = (cursor.y / 100) * rect.height;

        return (
          <div
            key={cursor.userId}
            className="pointer-events-none absolute z-[80]"
            style={{
              left,
              top,
              transform: 'translate(0, 0)',
              transition: 'left 0.1s linear, top 0.1s linear',
            }}
          >
            {/* Arrow cursor SVG */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="drop-shadow-sm">
              <path d="M0 0L0 16L4.5 12L7 18L9 17L6.5 11L12 11L0 0Z" fill={cursor.avatarColor} stroke="white" strokeWidth="1" />
            </svg>
            {/* Name pill */}
            <div
              className="absolute top-4 left-3 px-2 py-0.5 rounded-full text-white text-[10px] font-medium whitespace-nowrap shadow-sm"
              style={{ backgroundColor: cursor.avatarColor }}
            >
              {cursor.displayName}
            </div>
          </div>
        );
      })}

      {/* Presence indicator — top-right of content area */}
      {viewers.length > 0 && (
        <div className="absolute top-0 right-0 flex items-center gap-1 z-[79]">
          <span className="text-[10px] text-[#6B7280] dark:text-[#555555] mr-1">
            {viewers.length} {viewers.length === 1 ? 'person' : 'people'} here
          </span>
          {viewers.slice(0, 3).map(v => (
            <div
              key={v.userId}
              title={`${v.displayName} is here`}
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold border border-white dark:border-[#0A0A0A] shrink-0"
              style={{ backgroundColor: v.avatarColor }}
            >
              {v.displayName[0]?.toUpperCase()}
            </div>
          ))}
          {viewers.length > 3 && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold bg-[#E5E5E5] dark:bg-[#2A2A2A] text-[#6B7280] dark:text-[#888888] border border-white dark:border-[#0A0A0A]">
              +{viewers.length - 3}
            </div>
          )}
        </div>
      )}
    </>
  );
}
