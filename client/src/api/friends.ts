import api from './axios';
import { ApiResponse } from '../types';

export interface FriendUser {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  occupation: string | null;
}

export interface FriendEntry {
  friendshipId: string;
  user: FriendUser;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  fromUser?: FriendUser;
  toUser?: FriendUser;
}

export const friendsApi = {
  getAll: () =>
    api.get<ApiResponse<FriendEntry[]>>('/api/friends').then(r => r.data),

  getRequests: () =>
    api.get<ApiResponse<FriendRequest[]>>('/api/friends/requests').then(r => r.data),

  getSent: () =>
    api.get<ApiResponse<FriendRequest[]>>('/api/friends/sent').then(r => r.data),

  sendRequest: (userId: string) =>
    api.post<ApiResponse<FriendRequest>>(`/api/friends/request/${userId}`).then(r => r.data),

  acceptRequest: (friendshipId: string) =>
    api.put<ApiResponse<FriendRequest>>(`/api/friends/request/${friendshipId}/accept`).then(r => r.data),

  declineRequest: (friendshipId: string) =>
    api.put<ApiResponse<null>>(`/api/friends/request/${friendshipId}/decline`).then(r => r.data),

  removeFriend: (userId: string) =>
    api.delete<ApiResponse<null>>(`/api/friends/${userId}`).then(r => r.data),

  blockUser: (userId: string) =>
    api.post<ApiResponse<FriendRequest>>(`/api/friends/block/${userId}`).then(r => r.data),

  searchUsers: (q: string) =>
    api.get<ApiResponse<FriendUser[]>>('/api/users/search', { params: { q } }).then(r => r.data),
};
