export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  pages: number;
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
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  barrioSlug?: string;
  barrio?: Barrio;
}
