import api from './axios';
import { ApiResponse, File, Activity, Folder, FileVersionsData, FileVisibility } from '@/types';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const filesApi = {
  getAll: (folderId?: string, params?: { q?: string; type?: string; sortBy?: string; dateRange?: string; tagId?: string; visibility?: string }) =>
    api.get<ApiResponse<File[]>>('/api/files', { params: { ...(folderId ? { folderId } : {}), ...params } }).then(r => r.data),

  getStarred: () =>
    api.get<ApiResponse<File[]>>('/api/files/starred').then(r => r.data),

  getRecent: () =>
    api.get<ApiResponse<File[]>>('/api/files/recent').then(r => r.data),

  getTrash: () =>
    api.get<ApiResponse<{ files: File[]; folders: Folder[] }>>('/api/files/trash').then(r => r.data),

  getActivity: () =>
    api.get<ApiResponse<Activity[]>>('/api/files/activity').then(r => r.data),

  markActivityRead: () =>
    api.post<ApiResponse<null>>('/api/files/activity/read').then(r => r.data),

  getVersions: (fileId: string) =>
    api.get<ApiResponse<FileVersionsData>>(`/api/files/${fileId}/versions`).then(r => r.data),

  downloadVersion: (fileId: string, versionId: string) => {
    const token = localStorage.getItem('token');
    const url = `${apiBase}/api/files/${fileId}/versions/${versionId}/download`;
    const a = document.createElement('a');
    a.href = url;
    // Trigger via fetch with auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  },

  deleteVersion: (fileId: string, versionId: string) =>
    api.delete<ApiResponse<null>>(`/api/files/${fileId}/versions/${versionId}`).then(r => r.data),

  restoreVersion: (fileId: string, versionId: string) =>
    api.post<ApiResponse<File>>(`/api/files/${fileId}/versions/${versionId}/restore`).then(r => r.data),

  getContent: (fileId: string) =>
    api.get<ApiResponse<{ content: string; encoding: string; name: string; mimeType: string }>>(`/api/files/${fileId}/content`).then(r => r.data),

  updateContent: (fileId: string, content: string) =>
    api.put<ApiResponse<{ newSize: number; updatedAt: string }>>(`/api/files/${fileId}/content`, { content }).then(r => r.data),

  star: (id: string) =>
    api.put<ApiResponse<File>>(`/api/files/${id}/star`).then(r => r.data),

  move: (id: string, folderId: string | null) =>
    api.put<ApiResponse<File>>(`/api/files/${id}/move`, { folderId }).then(r => r.data),

  trash: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/files/${id}`).then(r => r.data),

  deletePermanent: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/files/${id}/permanent`).then(r => r.data),

  createShareLink: (id: string, options: { expiresIn?: number; password?: string } = {}) =>
    api.put<ApiResponse<{ shareToken: string; shareExpires: string | null }>>(`/api/files/${id}/share`, options).then(r => r.data),

  removeShareLink: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/files/${id}/share`).then(r => r.data),

  bulkZip: async (ids: string[]) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/api/files/bulk/zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('ZIP failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clouddrive-files.zip';
    a.click();
    URL.revokeObjectURL(url);
  },

  bulkTrash: (ids: string[], folderIds: string[] = []) =>
    api.post<ApiResponse<null>>('/api/files/bulk/trash', { ids, folderIds }).then(r => r.data),

  bulkRestore: (ids: string[], folderIds: string[] = []) =>
    api.post<ApiResponse<null>>('/api/files/bulk/restore', { ids, folderIds }).then(r => r.data),

  bulkStar: (ids: string[], folderIds: string[] = []) =>
    api.post<ApiResponse<null>>('/api/files/bulk/star', { ids, folderIds }).then(r => r.data),

  bulkMove: (ids: string[], folderId: string | null, folderIds: string[] = []) =>
    api.post<ApiResponse<null>>('/api/files/bulk/move', { ids, folderIds, folderId }).then(r => r.data),

  updateVisibility: (id: string, visibility: FileVisibility) =>
    api.put<ApiResponse<File>>(`/api/files/${id}/visibility`, { visibility }).then(r => r.data),

  getDownloadUrl: (id: string) => `${apiBase}/api/files/${id}/download`,

  getThumbnailUrl: (id: string) => `${apiBase}/api/files/thumbnail/${id}`,

  toggleLike: (id: string) =>
    api.post<ApiResponse<{ liked: boolean; likeCount: number }>>(`/api/files/${id}/like`).then(r => r.data),

  getLikes: (id: string) =>
    api.get<ApiResponse<{ likeCount: number; isLiked: boolean }>>(`/api/files/${id}/likes`).then(r => r.data),

  incrementView: (id: string) =>
    api.put<ApiResponse<null>>(`/api/files/${id}/view`).then(r => r.data).catch(() => {}),

  getMyLikes: () =>
    api.get<ApiResponse<string[]>>('/api/files/my-likes').then(r => r.data),
};
