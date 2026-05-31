import api from './axios';
import { ApiResponse, UserProfile, LoginHistoryEntry, PublicFile, FollowUser, SuggestedUser, ReferralInfo } from '@/types';
import { FriendUser } from '@/api/friends';

export interface UpdateProfilePayload {
  displayName?: string;
  username?: string;
  bio?: string;
  birthDate?: string | null;
  gender?: string;
  relationshipStatus?: string;
  website?: string;
  location?: string;
  currentCity?: string;
  hometown?: string;
  country?: string;
  occupation?: string;
  company?: string;
  school?: string;
  university?: string;
  hobbies?: string[];
  favoriteMusic?: string[];
  favoriteSports?: string[];
  favoriteTeam?: string;
  languages?: string[];
  showBirthDate?: boolean;
  showGender?: boolean;
  showRelationship?: boolean;
  showEmail?: boolean;
  emailNotifications?: boolean;
  newSigninAlerts?: boolean;
  storageWarnings?: boolean;
}

export const usersApi = {
  getProfile: (userId: string) =>
    api.get<ApiResponse<UserProfile>>(`/api/users/${userId}/profile`).then(r => r.data),

  checkUsername: (username: string) =>
    api.get<ApiResponse<{ available: boolean }>>(`/api/users/check-username?u=${encodeURIComponent(username)}`).then(r => r.data),

  updateProfile: (payload: UpdateProfilePayload) =>
    api.put<ApiResponse<UserProfile>>('/api/users/profile', payload).then(r => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post<ApiResponse<{ avatarUrl: string }>>('/api/users/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  uploadCover: (file: File) => {
    const form = new FormData();
    form.append('cover', file);
    return api.post<ApiResponse<{ coverPhotoUrl: string }>>('/api/users/cover', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  getFriendsList: (userId: string) =>
    api.get<ApiResponse<FriendUser[]>>(`/api/users/${userId}/friends-list`).then(r => r.data),

  getPublicFiles: (userId: string) =>
    api.get<ApiResponse<PublicFile[]>>(`/api/users/${userId}/public-files`).then(r => r.data),

  updateOnboarding: (data: { step?: number; completed?: boolean }) =>
    api.put<ApiResponse<null>>('/api/users/onboarding', data).then(r => r.data),

  updateEmailNotifications: (emailNotifications: boolean) =>
    api.put<ApiResponse<null>>('/api/users/email-notifications', { emailNotifications }).then(r => r.data),

  getLoginHistory: () =>
    api.get<ApiResponse<LoginHistoryEntry[]>>('/api/users/login-history').then(r => r.data),

  clearLoginHistory: () =>
    api.delete<ApiResponse<null>>('/api/users/login-history').then(r => r.data),

  getSearchHistory: () =>
    api.get<ApiResponse<string[]>>('/api/users/search-history').then(r => r.data),

  addSearchHistory: (query: string) =>
    api.put<ApiResponse<string[]>>('/api/users/search-history', { query }).then(r => r.data),

  clearSearchHistory: () =>
    api.delete<ApiResponse<string[]>>('/api/users/search-history').then(r => r.data),

  removeSearchHistoryItem: (query: string) =>
    api.delete<ApiResponse<string[]>>(`/api/users/search-history/${encodeURIComponent(query)}`).then(r => r.data),

  toggleFollow: (userId: string) =>
    api.post<ApiResponse<{ following: boolean; followerCount: number }>>(`/api/users/${userId}/follow`).then(r => r.data),

  getFollowers: (userId: string) =>
    api.get<ApiResponse<FollowUser[]>>(`/api/users/${userId}/followers`).then(r => r.data),

  getFollowing: (userId: string) =>
    api.get<ApiResponse<FollowUser[]>>(`/api/users/${userId}/following`).then(r => r.data),

  search: (q: string) =>
    api.get<ApiResponse<SuggestedUser[]>>('/api/users/search', { params: { q } }).then(r => r.data),

  getSuggested: () =>
    api.get<ApiResponse<SuggestedUser[]>>('/api/users/suggested').then(r => r.data),

  getReferral: () =>
    api.get<ApiResponse<ReferralInfo>>('/api/users/referral').then(r => r.data),
};
