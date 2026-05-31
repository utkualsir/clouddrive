import api from './axios';
import { ApiResponse, Review, ReviewsData } from '@/types';

export const reviewsApi = {
  getAll: (params: { sort?: string; page?: number; limit?: number; rating?: number } = {}) =>
    api.get<ApiResponse<ReviewsData>>('/api/reviews', { params }).then(r => r.data),

  getMine: () =>
    api.get<ApiResponse<Review | null>>('/api/reviews/mine').then(r => r.data),

  create: (data: { rating: number; comment: string }) =>
    api.post<ApiResponse<Review>>('/api/reviews', data).then(r => r.data),

  update: (id: string, data: { rating?: number; comment?: string }) =>
    api.put<ApiResponse<Review>>(`/api/reviews/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/reviews/${id}`).then(r => r.data),

  toggleLike: (id: string) =>
    api.post<ApiResponse<{ liked: boolean; likes: number }>>(`/api/reviews/${id}/like`).then(r => r.data),
};
