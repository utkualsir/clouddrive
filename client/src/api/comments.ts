import api from './axios';
import { ApiResponse, FileComment } from '@/types';

export const commentsApi = {
  getAll: (fileId: string) =>
    api.get<ApiResponse<FileComment[]>>(`/files/${fileId}/comments`).then(r => r.data),

  post: (fileId: string, content: string) =>
    api.post<ApiResponse<FileComment>>(`/files/${fileId}/comments`, { content }).then(r => r.data),

  delete: (fileId: string, commentId: string) =>
    api.delete<ApiResponse<void>>(`/files/${fileId}/comments/${commentId}`).then(r => r.data),
};
