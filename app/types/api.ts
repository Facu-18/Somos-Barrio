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
  role: 'VECINO' | 'NEGOCIO' | 'EDITOR' | 'ADMIN';
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

export interface MarketplaceAssetUpload {
  id: string;
  status: 'QUARANTINED' | 'APPROVED' | 'REJECTED';
  url: string | null;
  createdAt: string;
  scannedAt: string | null;
}

export type MarketplaceReasonCode =
  | 'POLICY_COMPLIANT'
  | 'PROHIBITED_ITEM'
  | 'REGULATED_ITEM'
  | 'FRAUD_OR_MISLEADING'
  | 'SPAM_OR_DUPLICATE'
  | 'INAPPROPRIATE_CONTENT'
  | 'IMAGE_POLICY'
  | 'REPORT_REVIEW'
  | 'CONTENT_CORRECTED'
  | 'OTHER_POLICY';

export type MarketplaceAssetStatus = MarketplaceAssetUpload['status'] | 'PROMOTION_PENDING' | 'REJECTION_PENDING' | 'DELETE_PENDING';

export interface MarketplaceManagedAsset {
  id: string;
  status: MarketplaceAssetStatus;
  url: string | null;
}

export interface MarketplaceAppeal {
  id: string;
  statement: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';
  createdAt: string;
}

export interface MarketplacePost {
  id: string;
  title: string;
  description: string;
  price: number | null;
  category: 'ELECTRONICA' | 'ROPA' | 'MUEBLES' | 'DEPORTES' | 'SE_BUSCA' | 'SE_REGALA' | 'OTROS';
  availability: 'AVAILABLE' | 'SOLD' | 'PAUSED';
  location: string | null;
  whatsapp: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  images: string[];
  assetIds: string[];
  managedAssets?: MarketplaceManagedAsset[];
  currentAppeal?: MarketplaceAppeal | null;
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REMOVED';
  moderationReasonCode: string | null;
  moderationVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
