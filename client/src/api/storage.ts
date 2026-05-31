import api from './axios';
import { ApiResponse, StorageStats } from '../types';

export const storageApi = {
  getStats: () =>
    api.get<ApiResponse<StorageStats>>('/api/storage/stats').then(r => r.data),
};
