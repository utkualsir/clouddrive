import api from './axios';
import { ApiResponse, ShareInfo } from '@/types';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const shareApi = {
  getInfo: (token: string) =>
    api.get<ApiResponse<ShareInfo>>(`/api/share/${token}`).then(r => r.data),

  verify: (token: string, password: string) =>
    api.post<ApiResponse<{ verified: boolean; fileName: string; fileSize: string; mimeType: string }>>(`/api/share/${token}/verify`, { password }).then(r => r.data),

  getQR: (token: string) =>
    api.get<ApiResponse<{ qrCode: string; shareUrl: string }>>(`/api/share/${token}/qr`).then(r => r.data),

  createLink: (fileId: string, options: { expiresIn?: number; password?: string } = {}) =>
    api.put<ApiResponse<{ shareToken: string; shareExpires: string | null; shareUrl: string }>>(`/api/files/${fileId}/share`, options).then(r => r.data),

  removeLink: (fileId: string) =>
    api.delete<ApiResponse<null>>(`/api/files/${fileId}/share`).then(r => r.data),

  getDownloadUrl: (token: string) =>
    `${apiBase}/api/share/${token}/download`,
};
