import api from './axios';
import { ApiResponse, Folder } from '../types';

export const foldersApi = {
  getAll: (parentId?: string) =>
    api.get<ApiResponse<Folder[]>>('/api/folders', { params: parentId ? { parentId } : {} }).then(r => r.data),

  getStarred: () =>
    api.get<ApiResponse<Folder[]>>('/api/folders/starred').then(r => r.data),

  create: (data: { name: string; color?: string; parentId?: string }) =>
    api.post<ApiResponse<Folder>>('/api/folders', data).then(r => r.data),

  update: (id: string, data: { name?: string; color?: string }) =>
    api.put<ApiResponse<Folder>>(`/api/folders/${id}`, data).then(r => r.data),

  star: (id: string) =>
    api.put<ApiResponse<Folder>>(`/api/folders/${id}/star`).then(r => r.data),

  trash: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/folders/${id}`).then(r => r.data),

  deletePermanent: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/folders/${id}/permanent`).then(r => r.data),

  lock: (id: string, password: string) =>
    api.post<ApiResponse<Folder>>(`/api/folders/${id}/lock`, { password }).then(r => r.data),

  unlock: (id: string, password: string) =>
    api.post<ApiResponse<{ id: string }>>(`/api/folders/${id}/unlock`, { password }).then(r => r.data),

  move: (id: string, parentId: string | null) =>
    api.put<ApiResponse<Folder>>(`/api/folders/${id}/move`, { parentId }).then(r => r.data),
};
