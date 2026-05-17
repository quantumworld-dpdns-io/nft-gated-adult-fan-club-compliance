import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiError {
  detail: string;
  status_code: number;
}

export interface User {
  id: number;
  wallet_address: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Membership {
  id: number;
  user_id: number;
  token_id: number;
  tier: "basic" | "premium" | "vip";
  minted_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface ContentItem {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  content_url: string;
  required_tier: number;
  is_locked: boolean;
  created_at: string;
}

export interface AgeVerification {
  id: number;
  user_id: number;
  proof_hash: string;
  verified_at: string;
  expires_at: string;
  is_valid: boolean;
}

export interface ComplianceLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  created_at: string;
}

export interface PlatformMetrics {
  total_users: number;
  active_memberships: number;
  monthly_revenue: string;
  verified_users: number;
  total_content_items: number;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

export async function login(walletAddress: string, signature: string): Promise<{ access_token: string; token_type: string }> {
  const { data } = await apiClient.post("/api/v1/auth/login", { wallet_address: walletAddress, signature });
  return data;
}

export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get("/api/v1/users/me");
  return data;
}

export async function getMemberships(): Promise<Membership[]> {
  const { data } = await apiClient.get("/api/v1/memberships");
  return data;
}

export async function mintMembership(tier: string): Promise<Membership> {
  const { data } = await apiClient.post("/api/v1/memberships/mint", { tier });
  return data;
}

export async function getContentItems(): Promise<ContentItem[]> {
  const { data } = await apiClient.get("/api/v1/content");
  return data;
}

export async function getContentItem(id: number): Promise<ContentItem> {
  const { data } = await apiClient.get(`/api/v1/content/${id}`);
  return data;
}

export async function checkContentAccess(contentId: number): Promise<{ has_access: boolean }> {
  const { data } = await apiClient.get(`/api/v1/content/${contentId}/access`);
  return data;
}

export async function submitAgeVerification(proofHash: string): Promise<AgeVerification> {
  const { data } = await apiClient.post("/api/v1/verify/age", { proof_hash: proofHash });
  return data;
}

export async function getVerificationStatus(): Promise<AgeVerification | null> {
  try {
    const { data } = await apiClient.get("/api/v1/verify/status");
    return data;
  } catch {
    return null;
  }
}

export async function getComplianceLogs(): Promise<ComplianceLog[]> {
  const { data } = await apiClient.get("/api/v1/admin/compliance-logs");
  return data;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const { data } = await apiClient.get("/api/v1/admin/metrics");
  return data;
}

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get("/api/v1/admin/users");
  return data;
}

export async function updateUserRole(userId: number, isAdmin: boolean): Promise<User> {
  const { data } = await apiClient.patch(`/api/v1/admin/users/${userId}`, { is_admin: isAdmin });
  return data;
}

export async function uploadKycDocument(file: File): Promise<{ document_id: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post("/api/v1/verify/kyc", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export default apiClient;
