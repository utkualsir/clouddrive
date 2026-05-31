import api from './axios';
import { ApiResponse, Tag } from '@/types';

export const tagsApi = {
  getAll: () =>
    api.get<ApiResponse<Tag[]>>('/api/tags').then(r => r.data),

  create: (name: string, color: string) =>
    api.post<ApiResponse<Tag>>('/api/tags', { name, color }).then(r => r.data),

  update: (id: string, data: { name?: string; color?: string }) =>
    api.put<ApiResponse<Tag>>(`/api/tags/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/tags/${id}`).then(r => r.data),

  addToFile: (fileId: string, tagId: string) =>
    api.post<ApiResponse<null>>(`/api/files/${fileId}/tags`, { tagId }).then(r => r.data),

  removeFromFile: (fileId: string, tagId: string) =>
    api.delete<ApiResponse<null>>(`/api/files/${fileId}/tags/${tagId}`).then(r => r.data),
};
