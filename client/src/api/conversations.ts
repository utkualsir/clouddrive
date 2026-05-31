import api from './axios';
import { ApiResponse, Conversation, Message } from '@/types';

export const conversationsApi = {
  getAll: () =>
    api.get<ApiResponse<Conversation[]>>('/api/conversations').then(r => r.data),

  create: (userId: string) =>
    api.post<ApiResponse<{ id: string; participant: Conversation['participant'] }>>('/api/conversations', { userId }).then(r => r.data),

  getMessages: (conversationId: string, cursor?: string) =>
    api.get<ApiResponse<Message[]>>(`/api/conversations/${conversationId}/messages`, {
      params: cursor ? { cursor } : {},
    }).then(r => r.data),

  sendMessage: (conversationId: string, content: string, attachmentId?: string) =>
    api.post<ApiResponse<Message>>(`/api/conversations/${conversationId}/messages`, { content, attachmentId }).then(r => r.data),

  delete: (conversationId: string) =>
    api.delete<ApiResponse<null>>(`/api/conversations/${conversationId}`).then(r => r.data),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/api/conversations/unread-count').then(r => r.data),
};
