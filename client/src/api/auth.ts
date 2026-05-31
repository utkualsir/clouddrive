import api from './axios';
import { ApiResponse, User } from '../types';

interface AuthData {
  token: string;
  user: User;
}

interface LoginResponse {
  requiresTwoFactor?: boolean;
  tempToken?: string;
  token?: string;
  user?: User;
}

export const authApi = {
  register: (data: { email: string; username: string; password: string; displayName: string; referralCode?: string }) =>
    api.post<ApiResponse<AuthData>>('/api/auth/register', data).then(r => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/api/auth/login', data).then(r => r.data),

  twoFactorLogin: (data: { tempToken: string; code: string }) =>
    api.post<ApiResponse<AuthData>>('/api/auth/2fa/login', data).then(r => r.data),

  twoFactorSetup: () =>
    api.post<ApiResponse<{ qrCodeUrl: string; secret: string }>>('/api/auth/2fa/setup').then(r => r.data),

  twoFactorVerifySetup: (token: string) =>
    api.post<ApiResponse<{ backupCodes: string[] }>>('/api/auth/2fa/verify-setup', { token }).then(r => r.data),

  twoFactorDisable: (password: string) =>
    api.post<ApiResponse<null>>('/api/auth/2fa/disable', { password }).then(r => r.data),

  forgotPassword: (email: string) =>
    api.post<ApiResponse<null>>('/api/auth/forgot-password', { email }).then(r => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<ApiResponse<null>>('/api/auth/reset-password', { token, password }).then(r => r.data),

  me: () =>
    api.get<ApiResponse<User>>('/api/auth/me').then(r => r.data),
};
