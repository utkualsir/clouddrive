import api from './axios';
import { ApiResponse, SearchResults } from '@/types';

export const searchApi = {
  search: (q: string, type?: string) =>
    api.get<ApiResponse<SearchResults>>('/api/search', { params: { q, ...(type ? { type } : {}) } }).then(r => r.data),
};
