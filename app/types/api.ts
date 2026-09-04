export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface Barrio {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  nickname: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarPublicId: string | null;
  barrioSlug: string | null;
  barrio: Barrio | null;
}

export interface UploadResult {
  url: string;
  publicId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
