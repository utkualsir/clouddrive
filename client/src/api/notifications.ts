import api from './axios';
import { ApiResponse, AppNotification } from '@/types';

export interface NotificationsPage {
  notifications: AppNotification[];
  total: number;
  page: number;
  pages: number;
}

export const notificationsApi = {
  getAll: (params?: { unread?: boolean; page?: number; limit?: number }) =>
    api.get<ApiResponse<NotificationsPage>>('/api/notifications', { params }).then(r => r.data),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/api/notifications/unread-count').then(r => r.data),

  markRead: (id: string) =>
    api.put<ApiResponse<null>>(`/api/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    api.put<ApiResponse<null>>('/api/notifications/read-all').then(r => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/notifications/${id}`).then(r => r.data),

  deleteAllRead: () =>
    api.delete<ApiResponse<null>>('/api/notifications/read').then(r => r.data),
};
