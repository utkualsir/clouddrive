import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ArrowLeft, HardDrive, Download, Eye, Heart, Share2, FileText, Upload, Trash2, Star, Folder, Bell, LogIn } from 'lucide-react';
import { statsApi } from '@/api/stats';
import { Activity } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const TYPE_COLORS: Record<string, string> = {
  Images: '#6366f1',
  Documents: '#8b5cf6',
  Videos: '#ec4899',
  Audio: '#14b8a6',
  Archives: '#f59e0b',
  Other: '#6b7280',
};

function activityIcon(action: string) {
  if (action.includes('upload')) return <Upload className="w-3.5 h-3.5 text-[#4F46E5]" strokeWidth={1.5} />;
  if (action.includes('download')) return <Download className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={1.5} />;
  if (action.includes('folder')) return <Folder className="w-3.5 h-3.5 text-[#F59E0B]" strokeWidth={1.5} />;
  if (action.includes('share')) return <Share2 className="w-3.5 h-3.5 text-[#8B5CF6]" strokeWidth={1.5} />;
  if (action.includes('login')) return <LogIn className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.5} />;
  if (action.includes('trash')) return <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" strokeWidth={1.5} />;
  if (action.includes('star')) return <Star className="w-3.5 h-3.5 text-[#F59E0B]" strokeWidth={1.5} />;
  return <Bell className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.5} />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface MetricCardProps { label: string; value: string | number; icon: React.ReactNode; sub?: string }
function MetricCard({ label, value, icon, sub }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] tabular-nums">{value}</p>
      <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[#4F46E5] mt-0.5">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { size: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">{label}</p>
      <p className="text-[#4F46E5]">{payload[0].value} file{payload[0].value !== 1 ? 's' : ''}</p>
      {payload[0].payload.size > 0 && (
        <p className="text-[#AAAAAA]">{formatFileSize(payload[0].payload.size)}</p>
      )}
    </div>
  );
}

export default function StatsPage() {
  const navigate = useNavigate();
  const { data: statsRes, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getStats(),
  });

  const stats = statsRes?.data;

  const pieData = stats?.filesByType.map(t => ({
    name: t.type,
    value: t.count,
    size: t.size,
  })) ?? [];

  const barData = stats?.uploadsByDay.map(d => ({
    date: d.date.slice(5), // MM-DD
    count: d.count,
    size: d.size,
  })) ?? [];

  // Show only every ~5th bar label on mobile
  const barInterval = barData.length > 15 ? 4 : 2;

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/drive')}
          className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <h1 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Storage Statistics</h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Row 1 — metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <MetricCard
                label="Total Files"
                value={stats?.totalFiles ?? 0}
                icon={<FileText className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />}
              />
              <MetricCard
                label="Storage Used"
                value={stats?.storageUsedFormatted ?? '0 B'}
                icon={<HardDrive className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />}
                sub={`${stats?.storagePercentage ?? 0}% of ${stats?.storageLimitFormatted}`}
              />
              <MetricCard
                label="Total Downloads"
                value={stats?.totalDownloads ?? 0}
                icon={<Download className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />}
              />
              <MetricCard
                label="Shared Files"
                value={stats?.totalSharedFiles ?? 0}
                icon={<Share2 className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />}
              />
            </>
          )}
        </div>

        {/* Row 2 — charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">Storage by Type</h2>
            {isLoading ? <Skeleton className="h-52 rounded-lg" /> : (
              pieData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#AAAAAA]">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={TYPE_COLORS[entry.name] ?? '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name, props) => [
                        `${val} files (${formatFileSize((props.payload as { size: number }).size)})`,
                        name,
                      ]}
                      contentStyle={{
                        background: 'var(--bg-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(val) => <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )
            )}
          </div>

          {/* Bar chart */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">Uploads — Last 30 Days</h2>
            {isLoading ? <Skeleton className="h-52 rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                    interval={barInterval}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Row 3 — largest files + top folders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Largest files */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">Largest Files</h2>
            {isLoading ? <Skeleton className="h-40 rounded-lg" /> : (
              <div className="space-y-3">
                {!stats?.largestFiles.length ? (
                  <p className="text-xs text-[#AAAAAA] text-center py-4">No files yet</p>
                ) : (
                  stats.largestFiles.map((f, i) => {
                    const maxSize = stats.largestFiles[0] ? parseInt(stats.largestFiles[0].size) : 1;
                    const pct = Math.round((parseInt(f.size) / maxSize) * 100);
                    return (
                      <div key={f.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-[180px]">
                            {i + 1}. {f.name}
                          </span>
                          <span className="text-[11px] text-[#6B7280] dark:text-[#555555] shrink-0 ml-2">{formatFileSize(f.size)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F0F0F0] dark:bg-[#252525] overflow-hidden">
                          <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Top folders */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">Top Folders by Size</h2>
            {isLoading ? <Skeleton className="h-40 rounded-lg" /> : (
              <div className="space-y-3">
                {!stats?.topFolders.length ? (
                  <p className="text-xs text-[#AAAAAA] text-center py-4">No folders yet</p>
                ) : (
                  stats.topFolders.map((folder, i) => {
                    const maxSize = stats.topFolders[0]?.size ?? 1;
                    const pct = maxSize > 0 ? Math.round((folder.size / maxSize) * 100) : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-[180px]">
                            {i + 1}. {folder.name}
                          </span>
                          <span className="text-[11px] text-[#6B7280] dark:text-[#555555] shrink-0 ml-2">
                            {folder.fileCount} files · {formatFileSize(folder.size)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F0F0F0] dark:bg-[#252525] overflow-hidden">
                          <div className="h-full rounded-full bg-[#8b5cf6]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 4 — Most Viewed / Most Downloaded / Most Liked */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Most Viewed */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-3.5 h-3.5 text-[#4F46E5]" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Most Viewed</h2>
            </div>
            {isLoading ? <Skeleton className="h-36 rounded-lg" /> : (
              <div className="space-y-2.5">
                {!stats?.mostViewedFiles?.length ? (
                  <p className="text-xs text-[#AAAAAA] text-center py-4">No data yet</p>
                ) : (
                  stats.mostViewedFiles.map((f, i) => {
                    const max = stats.mostViewedFiles[0]?.viewCount ?? 1;
                    const pct = max > 0 ? Math.round((f.viewCount / max) * 100) : 0;
                    return (
                      <div key={f.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-[160px]">{i + 1}. {f.name}</span>
                          <span className="text-[11px] text-[#6B7280] dark:text-[#555555] shrink-0 ml-2">{f.viewCount}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F0F0F0] dark:bg-[#252525] overflow-hidden">
                          <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Most Downloaded */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Most Downloaded</h2>
            </div>
            {isLoading ? <Skeleton className="h-36 rounded-lg" /> : (
              <div className="space-y-2.5">
                {!stats?.mostDownloadedFiles?.length ? (
                  <p className="text-xs text-[#AAAAAA] text-center py-4">No data yet</p>
                ) : (
                  stats.mostDownloadedFiles.map((f, i) => {
                    const max = stats.mostDownloadedFiles[0]?.downloadCount ?? 1;
                    const pct = max > 0 ? Math.round((f.downloadCount / max) * 100) : 0;
                    return (
                      <div key={f.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-[160px]">{i + 1}. {f.name}</span>
                          <span className="text-[11px] text-[#6B7280] dark:text-[#555555] shrink-0 ml-2">{f.downloadCount}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F0F0F0] dark:bg-[#252525] overflow-hidden">
                          <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Most Liked */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-3.5 h-3.5 text-red-400" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Most Liked</h2>
            </div>
            {isLoading ? <Skeleton className="h-36 rounded-lg" /> : (
              <div className="space-y-2.5">
                {!stats?.mostLikedFiles?.length ? (
                  <p className="text-xs text-[#AAAAAA] text-center py-4">No data yet</p>
                ) : (
                  stats.mostLikedFiles.map((f, i) => {
                    const max = stats.mostLikedFiles[0]?.likeCount ?? 1;
                    const pct = max > 0 ? Math.round((f.likeCount / max) * 100) : 0;
                    return (
                      <div key={f.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-[160px]">{i + 1}. {f.name}</span>
                          <span className="text-[11px] text-[#6B7280] dark:text-[#555555] shrink-0 ml-2">{f.likeCount}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F0F0F0] dark:bg-[#252525] overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 5 — Recent activity */}
        <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
          <h2 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">Recent Activity</h2>
          {isLoading ? <Skeleton className="h-32 rounded-lg" /> : (
            <div className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
              {!stats?.recentActivity.length ? (
                <p className="text-xs text-[#AAAAAA] text-center py-4">No activity yet</p>
              ) : (
                (stats.recentActivity as Activity[]).map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-6 h-6 rounded-full bg-[#F0F0F0] dark:bg-[#252525] flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(a.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5]">
                        <span className="capitalize">{a.action}</span>{' '}
                        <span className="font-medium">{a.target}</span>
                      </p>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#555555] mt-0.5">{timeAgo(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
