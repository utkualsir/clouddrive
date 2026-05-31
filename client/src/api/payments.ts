import api from './axios';
import { ApiResponse } from '../types';

// ─── Payment status (current plan) ───────────────────────────────────────────

export interface PaymentStatus {
  plan: string;
  storageLimit: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface PlanPrices {
  TRY: number;
  USD: number;
  EUR: number;
}

export interface Plan {
  id: string;
  name: string;
  storageGB: number;
  prices: PlanPrices;
  originalPrices?: PlanPrices;
  badge?: string;
  paymentMethods: PaymentMethod[];
}

export interface PaymentMethod {
  currency: string;
  label: string;
  active: boolean;
  comingSoon: boolean;
}

// ─── Payment info (IBANs) ─────────────────────────────────────────────────────

export interface PaymentInfo {
  currency: string;
  symbol: string;
  label: string;
  iban: string;
  active: boolean;
  comingSoon: boolean;
}

// ─── Payment requests ─────────────────────────────────────────────────────────

export type PaymentRequestType = 'UPGRADE' | 'DONATE';
export type PaymentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentRequest {
  id: string;
  userId: string;
  type: PaymentRequestType;
  plan: string | null;
  storageGB: number | null;
  amount: number;
  currency: string;
  status: PaymentRequestStatus;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequestBody {
  type: PaymentRequestType;
  plan?: string;
  amount: number;
  currency: string;
  note?: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminPaymentRequest extends PaymentRequest {
  user: {
    id: string;
    displayName: string;
    username: string;
    email: string;
    avatarColor: string;
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const paymentsApi = {
  getStatus: () =>
    api.get<ApiResponse<PaymentStatus>>('/api/payments/status').then(r => r.data),

  getPlans: () =>
    api.get<ApiResponse<Plan[]>>('/api/payments/plans').then(r => r.data),

  getPaymentInfo: () =>
    api.get<ApiResponse<PaymentInfo[]>>('/api/payments/info').then(r => r.data),

  createRequest: (body: CreatePaymentRequestBody) =>
    api.post<ApiResponse<{ id: string; status: PaymentRequestStatus }>>('/api/payments/request', body).then(r => r.data),

  getMyRequests: () =>
    api.get<ApiResponse<PaymentRequest[]>>('/api/payments/requests').then(r => r.data),
};

export const adminPaymentsApi = {
  getAll: (status?: PaymentRequestStatus) =>
    api.get<ApiResponse<AdminPaymentRequest[]>>('/api/admin/payments', { params: status ? { status } : {} }).then(r => r.data),

  approve: (id: string) =>
    api.put<ApiResponse<null>>(`/api/admin/payments/${id}/approve`).then(r => r.data),

  reject: (id: string, adminNote?: string) =>
    api.put<ApiResponse<null>>(`/api/admin/payments/${id}/reject`, { adminNote }).then(r => r.data),
};

// ─── Folder share (unrelated to payments, kept here for co-location) ──────────

export const folderShareApi = {
  shareFolder: (folderId: string, userId: string, permission: string) =>
    api.post<ApiResponse<FolderShareEntry>>(`/api/folders/${folderId}/share`, { userId, permission }).then(r => r.data),

  getShares: (folderId: string) =>
    api.get<ApiResponse<FolderShareEntry[]>>(`/api/folders/${folderId}/shares`).then(r => r.data),

  removeShare: (folderId: string, userId: string) =>
    api.delete<ApiResponse<null>>(`/api/folders/${folderId}/shares/${userId}`).then(r => r.data),

  getSharedWithMe: () =>
    api.get<ApiResponse<SharedFolderEntry[]>>('/api/folders/shared-with-me').then(r => r.data),
};

export interface FolderShareEntry {
  id: string;
  folderId: string;
  sharedWithId: string;
  sharedById: string;
  permission: string;
  createdAt: string;
  sharedWith?: {
    id: string;
    displayName: string;
    username: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
}

export interface SharedFolderEntry {
  shareId: string;
  permission: string;
  folder: {
    id: string;
    name: string;
    color: string;
    userId: string;
    isEncrypted: boolean;
    isStarred: boolean;
    isTrashed: boolean;
    createdAt: string;
    updatedAt: string;
  };
  owner: {
    id: string;
    displayName: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
}
