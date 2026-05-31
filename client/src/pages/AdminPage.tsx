import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Files, HardDrive, TrendingUp, Shield, Trash2, ChevronLeft, Edit2, Check, X, Clock, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/api/admin';
import { adminPaymentsApi, AdminPaymentRequest, PaymentRequestStatus } from '@/api/payments';
import { AdminUser, ApiResponse } from '@/types';
import { formatFileSize, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
      </div>
      <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mb-0.5">{label}</p>
      <p className="text-xl font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] tracking-tight">{value}</p>
    </div>
  );
}

function StorageBar({ used, limit }: { used: string; limit: string }) {
  const usedN = Number(used);
  const limitN = Number(limit);
  const pct = limitN > 0 ? Math.min((usedN / limitN) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-[#4F46E5]';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F0F0F0] dark:bg-[#252525] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-[#AAAAAA] dark:text-[#444444] shrink-0 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function EditableStorage({ user, onSave }: { user: AdminUser; onSave: (userId: string, gb: number) => void }) {
  const [editing, setEditing] = useState(false);
  const limitGb = Math.round(Number(user.storageLimit) / 1e9);
  const [val, setVal] = useState(String(limitGb));

  const save = () => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) onSave(user.id, n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="w-14 h-6 px-1.5 text-xs border border-[#4F46E5] rounded bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <span className="text-xs text-[#AAAAAA]">GB</span>
        <button onClick={save} className="p-0.5 text-green-500 hover:text-green-600"><Check className="w-3.5 h-3.5" strokeWidth={2} /></button>
        <button onClick={() => setEditing(false)} className="p-0.5 text-[#AAAAAA] hover:text-red-500"><X className="w-3.5 h-3.5" strokeWidth={2} /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 group text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]">
      <span>{limitGb} GB</span>
      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
    </button>
  );
}

type TabKey = 'overview' | 'users' | 'files' | 'activity' | 'payments';
type PaymentsFilter = 'all' | PaymentRequestStatus;

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('overview');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [paymentsFilter, setPaymentsFilter] = useState<PaymentsFilter>('all');
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);

  if (user?.role !== 'ADMIN') {
    navigate('/drive', { replace: true });
    return null;
  }

  const { data: statsData } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.getStats });
  const { data: usersData } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.getUsers, enabled: tab === 'users' || tab === 'overview' });
  const { data: filesData } = useQuery({ queryKey: ['admin-files'], queryFn: adminApi.getFiles, enabled: tab === 'files' });
  const { data: activityData } = useQuery({ queryKey: ['admin-activity'], queryFn: adminApi.getActivity, enabled: tab === 'activity' });
  const { data: paymentsData } = useQuery({ queryKey: ['admin-payments'], queryFn: () => adminPaymentsApi.getAll(), enabled: tab === 'payments' });

  const stats = statsData?.data;
  const users = usersData?.data ?? [];
  const files = filesData?.data ?? [];
  const activities = activityData?.data ?? [];
  const allPayments: AdminPaymentRequest[] = paymentsData?.data ?? [];

  const updateStorageMut = useMutation({
    mutationFn: ({ userId, gb }: { userId: string; gb: number }) =>
      adminApi.updateStorage(userId, gb * 1e9),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteUserMut = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setConfirmDelete(null);
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => adminPaymentsApi.approve(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-payments'] });
      const prev = queryClient.getQueryData<ApiResponse<AdminPaymentRequest[]>>(['admin-payments']);
      const req = prev?.data?.find(r => r.id === id);
      queryClient.setQueryData<ApiResponse<AdminPaymentRequest[]>>(['admin-payments'], old =>
        old?.data ? { ...old, data: old.data.map(r => r.id === id ? { ...r, status: 'APPROVED' as PaymentRequestStatus } : r) } : old
      );
      return { prev, req };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin-payments'], ctx.prev);
      toast.error('Failed to approve payment');
    },
    onSuccess: (_data, _id, ctx) => {
      if (ctx?.req?.type === 'UPGRADE' && ctx.req.storageGB) {
        toast.success(`Payment approved! Storage updated to ${ctx.req.storageGB} GB.`);
      } else {
        toast.success('Payment approved!');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminPaymentsApi.reject(id, note.trim() || undefined),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-payments'] });
      const prev = queryClient.getQueryData<ApiResponse<AdminPaymentRequest[]>>(['admin-payments']);
      queryClient.setQueryData<ApiResponse<AdminPaymentRequest[]>>(['admin-payments'], old =>
        old?.data ? { ...old, data: old.data.map(r => r.id === id ? { ...r, status: 'REJECTED' as PaymentRequestStatus } : r) } : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin-payments'], ctx.prev);
      toast.error('Failed to reject payment');
    },
    onSuccess: () => {
      toast.success('Payment request rejected.');
      setRejectModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
  });

  // ── Payment stats (computed client-side) ─────────────────────────────────────
  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const pendingCount = allPayments.filter(r => r.status === 'PENDING').length;
  const approvedThisMonth = allPayments.filter(r => r.status === 'APPROVED' && new Date(r.updatedAt) >= startOfMonth).length;
  const totalDonations = allPayments.filter(r => r.type === 'DONATE').length;
  const revenueMap = allPayments
    .filter(r => r.status === 'APPROVED' && r.type === 'UPGRADE' && new Date(r.updatedAt) >= startOfMonth)
    .reduce<Record<string, number>>((acc, r) => { acc[r.currency] = (acc[r.currency] ?? 0) + r.amount; return acc; }, {});
  const RSYM: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };
  const revenueStr = Object.entries(revenueMap).map(([c, a]) => `${RSYM[c] ?? ''}${a} ${c}`).join(' + ') || '—';

  const displayedPayments = [...allPayments]
    .filter(r => paymentsFilter === 'all' || r.status === paymentsFilter)
    .sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'files', label: 'Files' },
    { key: 'activity', label: 'Activity' },
    { key: 'payments', label: `Payments${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/drive')} className="flex items-center gap-1.5 text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Drive
        </button>
        <span className="text-[#E5E5E5] dark:text-[#2A2A2A]">/</span>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#4F46E5]" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Admin Panel</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
                tab === t.key
                  ? 'border-[#4F46E5] text-[#4F46E5]'
                  : 'border-transparent text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total users" value={stats?.totalUsers ?? '—'} color="bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5]" />
              <StatCard icon={Files} label="Total files" value={stats?.totalFiles ?? '—'} color="bg-green-50 dark:bg-green-900/20 text-green-600" />
              <StatCard icon={HardDrive} label="Storage used" value={stats ? formatFileSize(stats.totalStorageUsed) : '—'} color="bg-amber-50 dark:bg-amber-900/20 text-amber-600" />
              <StatCard icon={TrendingUp} label="Uploaded today" value={stats?.filesUploadedToday ?? '—'} color="bg-purple-50 dark:bg-purple-900/20 text-purple-600" />
            </div>

            {/* Top users by storage */}
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                <h3 className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Users by storage</h3>
              </div>
              <div className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
                {users.slice(0, 5).sort((a, b) => Number(b.storageUsed) - Number(a.storageUsed)).map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: u.avatarColor }}>
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{u.displayName}</p>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{u.fileCount} files</p>
                    </div>
                    <div className="w-32">
                      <StorageBar used={u.storageUsed} limit={u.storageLimit} />
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] mt-0.5 text-right">{formatFileSize(u.storageUsed)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] dark:border-[#2A2A2A] text-left">
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">User</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden md:table-cell">Files</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Storage</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden lg:table-cell">Limit</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Role</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden sm:table-cell">Last seen</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: u.avatarColor }}>
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{u.displayName}</p>
                          <p className="text-[#AAAAAA] dark:text-[#444444] truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#6B6B6B] dark:text-[#888888] hidden md:table-cell">{u.fileCount}</td>
                    <td className="px-5 py-3 w-32">
                      <StorageBar used={u.storageUsed} limit={u.storageLimit} />
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] mt-0.5">{formatFileSize(u.storageUsed)}</p>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <EditableStorage user={u} onSave={(uid, gb) => updateStorageMut.mutate({ userId: uid, gb })} />
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        onChange={e => updateRoleMut.mutate({ userId: u.id, role: e.target.value })}
                        disabled={u.id === user?.id}
                        className="text-[11px] px-1.5 py-1 rounded border border-[#E5E5E5] dark:border-[#2A2A2A] bg-transparent text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-[#AAAAAA] dark:text-[#444444] hidden sm:table-cell">
                      {u.lastSeen ? formatDate(u.lastSeen) : 'Never'}
                    </td>
                    <td className="px-5 py-3">
                      {u.id !== user?.id && (
                        confirmDelete === u.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteUserMut.mutate(u.id)} className="text-[11px] px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors">
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="text-[11px] px-2 py-1 rounded bg-[#F0F0F0] dark:bg-[#252525] text-[#6B6B6B] dark:text-[#888888] hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A] transition-colors">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 rounded-md text-[#AAAAAA] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Files tab */}
        {tab === 'files' && (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] dark:border-[#2A2A2A] text-left">
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Name</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden md:table-cell">Uploader</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Size</th>
                  <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden sm:table-cell">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
                {files.map(f => (
                  <tr key={f.id} className="hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-[200px]">{f.name}</p>
                      <p className="text-[#AAAAAA] dark:text-[#444444] truncate">{f.mimeType}</p>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <p className="text-[#0A0A0A] dark:text-[#F5F5F5]">{f.uploaderName}</p>
                      <p className="text-[#AAAAAA] dark:text-[#444444]">{f.uploaderEmail}</p>
                    </td>
                    <td className="px-5 py-3 text-[#6B6B6B] dark:text-[#888888]">{formatFileSize(f.size)}</td>
                    <td className="px-5 py-3 text-[#AAAAAA] dark:text-[#444444] hidden sm:table-cell">{formatDate(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
            <div className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
              {activities.map(a => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]/50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#F0F0F0] dark:bg-[#252525] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#6B6B6B] dark:text-[#888888]">
                      {a.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5]">
                      <span className="font-medium">{a.displayName}</span>{' '}
                      <span className="text-[#6B6B6B] dark:text-[#888888]">{a.action}</span>{' '}
                      <span className="font-medium truncate">{a.target}</span>
                    </p>
                    <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{a.email} · {formatDate(a.createdAt)}</p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="px-5 py-10 text-center text-xs text-[#AAAAAA] dark:text-[#444444]">No activity yet</div>
              )}
            </div>
          </div>
        )}

        {/* Payments tab */}
        {tab === 'payments' && (
          <div className="space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Clock}
                label="Pending requests"
                value={pendingCount}
                color={`bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600${pendingCount > 0 ? ' ring-2 ring-yellow-200 dark:ring-yellow-700' : ''}`}
              />
              <StatCard icon={CheckCircle} label="Approved this month" value={approvedThisMonth} color="bg-green-50 dark:bg-green-900/20 text-green-600" />
              <StatCard icon={CreditCard} label="Revenue this month" value={revenueStr} color="bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5]" />
              <StatCard icon={TrendingUp} label="Total donations" value={totalDonations} color="bg-amber-50 dark:bg-amber-900/20 text-amber-600" />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1">
              {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as PaymentsFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setPaymentsFilter(f)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors capitalize ${
                    paymentsFilter === f
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
              {displayedPayments.length === 0 ? (
                <div className="px-5 py-12 text-center text-xs text-[#AAAAAA] dark:text-[#444444]">No payment requests yet</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] dark:border-[#2A2A2A] text-left">
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">User</th>
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Type</th>
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden md:table-cell">Plan</th>
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Amount</th>
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden lg:table-cell">Note</th>
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444] hidden sm:table-cell">Date</th>
                      <th className="px-5 py-3 font-medium text-[#AAAAAA] dark:text-[#444444]">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#1E1E1E]">
                    {displayedPayments.map(r => {
                      const sym = ({ TRY: '₺', USD: '$', EUR: '€' } as Record<string, string>)[r.currency] ?? '';
                      const planLabel = r.type === 'UPGRADE' && r.plan
                        ? `${r.plan.charAt(0).toUpperCase() + r.plan.slice(1)}${r.storageGB ? ` · ${r.storageGB} GB` : ''}`
                        : '—';
                      return (
                        <tr
                          key={r.id}
                          className={`transition-colors ${
                            r.status === 'PENDING'
                              ? 'bg-yellow-50/40 dark:bg-yellow-900/5 hover:bg-yellow-50/60 dark:hover:bg-yellow-900/10'
                              : 'hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]/50'
                          }`}
                        >
                          {/* User */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: r.user.avatarColor }}>
                                {r.user.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{r.user.displayName}</p>
                                <p className="text-[#AAAAAA] dark:text-[#444444] truncate">@{r.user.username}</p>
                              </div>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              r.type === 'UPGRADE'
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                            }`}>
                              {r.type === 'UPGRADE' ? 'Upgrade' : 'Donate'}
                            </span>
                          </td>
                          {/* Plan */}
                          <td className="px-5 py-3 text-[#6B6B6B] dark:text-[#888888] hidden md:table-cell">{planLabel}</td>
                          {/* Amount */}
                          <td className="px-5 py-3 font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{sym}{r.amount} {r.currency}</td>
                          {/* Note */}
                          <td className="px-5 py-3 hidden lg:table-cell">
                            {r.note ? (
                              <span className="block max-w-[140px] truncate text-[#6B6B6B] dark:text-[#888888]" title={r.note}>{r.note}</span>
                            ) : <span className="text-[#AAAAAA] dark:text-[#555555]">—</span>}
                          </td>
                          {/* Date */}
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <p className="text-[#0A0A0A] dark:text-[#F5F5F5]">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-[#AAAAAA] dark:text-[#555555]">{formatDate(r.createdAt)}</p>
                          </td>
                          {/* Status */}
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              r.status === 'PENDING'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                                : r.status === 'APPROVED'
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                            }`}>
                              {r.status === 'PENDING' ? '⏳ Pending' : r.status === 'APPROVED' ? '✓ Approved' : '✗ Rejected'}
                            </span>
                            {r.status === 'REJECTED' && r.adminNote && (
                              <p className="mt-1 text-[10px] text-red-400 max-w-[100px] truncate" title={r.adminNote}>{r.adminNote}</p>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-3">
                            {r.status === 'PENDING' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => approveMut.mutate(r.id)}
                                  disabled={approveMut.isPending}
                                  className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-40"
                                >
                                  {approveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => setRejectModal({ id: r.id, note: '' })}
                                  disabled={rejectMut.isPending}
                                  className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40"
                                >
                                  <X className="w-3 h-3" strokeWidth={2.5} />
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">Reject Payment Request</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#555555] mb-4">Reason for rejection (optional, will be sent to user)</p>
            <textarea
              value={rejectModal.note}
              onChange={e => setRejectModal({ ...rejectModal, note: e.target.value })}
              rows={4}
              placeholder="Enter rejection reason..."
              className="w-full px-3 py-2 text-sm bg-[#F8F8F8] dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#AAAAAA] outline-none focus:border-[#4F46E5] resize-none transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 h-9 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMut.mutate({ id: rejectModal.id, note: rejectModal.note })}
                disabled={rejectMut.isPending}
                className="flex-1 h-9 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {rejectMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting…</> : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
