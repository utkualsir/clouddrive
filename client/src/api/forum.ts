import api from './axios';
import {
  ApiResponse,
  ForumCategory,
  ForumThread,
  ForumPost,
  ForumStats,
  ForumUserStats,
  ForumThreadsPage,
  ForumPostsPage,
} from '@/types';

export const forumApi = {
  // Stats
  getStats: () =>
    api.get<ApiResponse<ForumStats>>('/api/forum/stats').then(r => r.data),

  getUserStats: (userId: string) =>
    api.get<ApiResponse<ForumUserStats>>(`/api/forum/users/${userId}/stats`).then(r => r.data),

  getTags: () =>
    api.get<ApiResponse<string[]>>('/api/forum/tags').then(r => r.data),

  // Categories
  getCategories: () =>
    api.get<ApiResponse<ForumCategory[]>>('/api/forum/categories').then(r => r.data),

  createCategory: (data: { name: string; description: string; icon?: string; color?: string; order?: number }) =>
    api.post<ApiResponse<ForumCategory>>('/api/forum/categories', data).then(r => r.data),

  // Threads
  getThreads: (params?: {
    categoryId?: string;
    sort?: 'latest' | 'popular' | 'unanswered';
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<ApiResponse<ForumThreadsPage>>('/api/forum/threads', { params }).then(r => r.data),

  getThread: (id: string) =>
    api.get<ApiResponse<ForumThread>>(`/api/forum/threads/${id}`).then(r => r.data),

  createThread: (data: { title: string; content: string; categoryId: string; tags?: string[] }) =>
    api.post<ApiResponse<ForumThread>>('/api/forum/threads', data).then(r => r.data),

  updateThread: (id: string, data: { title?: string; content?: string; categoryId?: string; tags?: string[] }) =>
    api.put<ApiResponse<ForumThread>>(`/api/forum/threads/${id}`, data).then(r => r.data),

  deleteThread: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/forum/threads/${id}`).then(r => r.data),

  pinThread: (id: string) =>
    api.put<ApiResponse<{ isPinned: boolean }>>(`/api/forum/threads/${id}/pin`).then(r => r.data),

  lockThread: (id: string) =>
    api.put<ApiResponse<{ isLocked: boolean }>>(`/api/forum/threads/${id}/lock`).then(r => r.data),

  solveThread: (id: string) =>
    api.put<ApiResponse<{ isSolved: boolean }>>(`/api/forum/threads/${id}/solve`).then(r => r.data),

  // Posts
  getPosts: (threadId: string, page?: number) =>
    api
      .get<ApiResponse<ForumPostsPage>>(`/api/forum/threads/${threadId}/posts`, { params: { page } })
      .then(r => r.data),

  createPost: (threadId: string, content: string) =>
    api.post<ApiResponse<ForumPost>>(`/api/forum/threads/${threadId}/posts`, { content }).then(r => r.data),

  updatePost: (id: string, content: string) =>
    api.put<ApiResponse<ForumPost>>(`/api/forum/posts/${id}`, { content }).then(r => r.data),

  deletePost: (id: string) =>
    api.delete<ApiResponse<null>>(`/api/forum/posts/${id}`).then(r => r.data),

  likePost: (id: string) =>
    api
      .post<ApiResponse<{ liked: boolean; likeCount: number }>>(`/api/forum/posts/${id}/like`)
      .then(r => r.data),

  markAnswer: (id: string) =>
    api.put<ApiResponse<{ isAnswer: boolean }>>(`/api/forum/posts/${id}/answer`).then(r => r.data),
};
