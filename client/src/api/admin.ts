import api from './axios';
import { ApiResponse, AdminStats, AdminUser } from '@/types';

export const adminApi = {
  getStats: () =>
    api.get<ApiResponse<AdminStats>>('/api/admin/stats').then(r => r.data),

  getUsers: () =>
    api.get<ApiResponse<AdminUser[]>>('/api/admin/users').then(r => r.data),

  updateStorage: (userId: string, storageLimit: number) =>
    api.put<ApiResponse<null>>(`/api/admin/users/${userId}/storage`, { storageLimit }).then(r => r.data),

  updateRole: (userId: string, role: string) =>
    api.put<ApiResponse<null>>(`/api/admin/users/${userId}/role`, { role }).then(r => r.data),

  deleteUser: (userId: string) =>
    api.delete<ApiResponse<null>>(`/api/admin/users/${userId}`).then(r => r.data),

  getFiles: () =>
    api.get<ApiResponse<{ id: string; name: string; mimeType: string; size: string; uploaderName: string; uploaderEmail: string; createdAt: string }[]>>('/api/admin/files').then(r => r.data),

  getActivity: () =>
    api.get<ApiResponse<{ id: string; userId: string; displayName: string; email: string; action: string; target: string; createdAt: string }[]>>('/api/admin/activity').then(r => r.data),
};
