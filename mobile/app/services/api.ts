import axios, { AxiosInstance, AxiosError } from 'axios';
import { getStoredToken, removeStoredToken } from './auth';

const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.nftfanclub.com/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await removeStoredToken();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  async uploadFile<T>(url: string, fileUri: string, fieldName = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, {
      uri: fileUri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    } as any);
    const response = await this.client.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  contentType: 'image' | 'video' | 'article';
  isLocked: boolean;
  requiredTier: string;
  createdAt: string;
}

export interface MembershipTier {
  id: string;
  name: string;
  price: string;
  benefits: string[];
  color: string;
  tokenId?: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  walletAddress: string;
  email: string;
  membershipTier: string;
  subscriptionStatus: 'active' | 'expired' | 'none';
  subscriptionExpiry: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface VerificationStatus {
  isVerified: boolean;
  method: 'zk_proof' | 'document' | null;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface ComplianceAuditEntry {
  id: string;
  action: string;
  timestamp: string;
  status: 'passed' | 'failed' | 'pending';
  details: string;
}

export interface PlatformMetrics {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  totalContent: number;
  dailyActiveUsers: number;
}

export const contentApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<{ items: ContentItem[]; total: number }>('/content', { page, limit }),
  getById: (id: string) =>
    apiClient.get<ContentItem>(`/content/${id}`),
  unlock: (id: string) =>
    apiClient.post<{ accessToken: string }>(`/content/${id}/unlock`),
};

export const membershipApi = {
  getTiers: () =>
    apiClient.get<MembershipTier[]>('/membership/tiers'),
  purchase: (tierId: string, transactionHash: string) =>
    apiClient.post<{ subscriptionId: string }>('/membership/purchase', { tierId, transactionHash }),
  cancel: () =>
    apiClient.post<void>('/membership/cancel'),
  getStatus: () =>
    apiClient.get<{ tier: string; status: string; expiry: string | null }>('/membership/status'),
};

export const verificationApi = {
  submitZkProof: (proof: string, publicSignals: string[]) =>
    apiClient.post<VerificationStatus>('/verify/zk-proof', { proof, publicSignals }),
  uploadDocument: (fileUri: string) =>
    apiClient.uploadFile<VerificationStatus>('/verify/document', fileUri),
  getStatus: () =>
    apiClient.get<VerificationStatus>('/verify/status'),
};

export const profileApi = {
  get: () =>
    apiClient.get<UserProfile>('/profile'),
  update: (data: Partial<Pick<UserProfile, 'displayName' | 'email'>>) =>
    apiClient.put<UserProfile>('/profile', data),
  getComplianceLog: () =>
    apiClient.get<ComplianceAuditEntry[]>('/profile/compliance-log'),
};

export const adminApi = {
  searchUsers: (query: string) =>
    apiClient.get<UserProfile[]>('/admin/users', { q: query }),
  getMetrics: () =>
    apiClient.get<PlatformMetrics>('/admin/metrics'),
  getComplianceSummary: () =>
    apiClient.get<{ totalChecks: number; passRate: number; recentFlags: number }>(
      '/admin/compliance-summary'
    ),
};
