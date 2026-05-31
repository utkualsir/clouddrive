import api from './axios';
import { ApiResponse, StatsData } from '@/types';

export const statsApi = {
  getStats: () =>
    api.get<ApiResponse<StatsData>>('/api/stats').then(r => r.data),
};
