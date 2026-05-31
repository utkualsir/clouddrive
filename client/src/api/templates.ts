import api from './axios';
import { ApiResponse } from '@/types';

export interface TemplateInfo {
  id: string;
  name: string;
  icon: string;
  category: string;
  extension: string;
  mimeType: string;
}

export interface TemplateCreateResult {
  fileId: string;
  fileName: string;
  editorUrl: string;
}

export const templatesApi = {
  getAll: () =>
    api.get<ApiResponse<TemplateInfo[]>>('/api/templates').then(r => r.data),

  create: (id: string, options: { folderId?: string | null; fileName?: string }) =>
    api.post<ApiResponse<TemplateCreateResult>>(`/api/templates/${id}/create`, options).then(r => r.data),
};
