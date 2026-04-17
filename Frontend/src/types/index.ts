export type UserRole = 'VECINO' | 'NEGOCIO' | 'EDITOR' | 'ADMIN'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
  bio?: string
  barrioId?: string
  barrio?: Barrio
  createdAt: string
}

export interface Barrio {
  id: string
  slug: string
  name: string
  city: string
  province: string
  country: string
  description?: string
  imageUrl?: string
}

export type NewsCategory = 'GENERAL' | 'SEGURIDAD' | 'CULTURA' | 'DEPORTES' | 'POLITICA' | 'SALUD' | 'EDUCACION' | 'ECONOMIA'
export type NewsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface News {
  id: string
  slug: string
  title: string
  summary?: string
  content: string
  imageUrl?: string
  category: NewsCategory
  status: NewsStatus
  publishedAt?: string
  createdAt: string
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>
  barrio: Pick<Barrio, 'id' | 'name' | 'slug'>
}

export type BusinessCategory =
  | 'GASTRONOMIA'
  | 'SALUD'
  | 'EDUCACION'
  | 'SERVICIOS'
  | 'COMERCIO'
  | 'ENTRETENIMIENTO'
  | 'TRANSPORTE'
  | 'OTROS'

export interface Business {
  id: string
  slug: string
  name: string
  description?: string
  category: BusinessCategory
  address: string
  phone?: string
  email?: string
  website?: string
  imageUrl?: string
  verified: boolean
  createdAt: string
  owner: Pick<User, 'id' | 'name' | 'avatarUrl'>
  barrio: Pick<Barrio, 'id' | 'name' | 'slug'>
}

export type MarketplaceCategory = 'VENTA' | 'ALQUILER' | 'BUSCO' | 'REGALO' | 'INTERCAMBIO' | 'SERVICIO'
export type MarketplaceStatus = 'ACTIVE' | 'PAUSED' | 'SOLD'

export interface MarketplacePost {
  id: string
  title: string
  description: string
  price?: number
  currency?: string
  category: MarketplaceCategory
  status: MarketplaceStatus
  imageUrls: string[]
  views: number
  createdAt: string
  seller: Pick<User, 'id' | 'name' | 'avatarUrl'>
  barrio: Pick<Barrio, 'id' | 'name' | 'slug'>
}

export interface ForumSubforum {
  id: string
  slug: string
  name: string
  description?: string
  _count?: { threads: number }
}

export interface ForumThread {
  id: string
  title: string
  content: string
  isPinned: boolean
  isLocked: boolean
  upvotes: number
  downvotes: number
  createdAt: string
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>
  subforum: Pick<ForumSubforum, 'id' | 'slug' | 'name'>
  _count?: { replies: number }
}

export interface ForumReply {
  id: string
  content: string
  upvotes: number
  downvotes: number
  createdAt: string
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>
  parentId?: string
  children?: ForumReply[]
}

export type EventRsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING'

export interface Event {
  id: string
  title: string
  description: string
  imageUrl?: string
  startDate: string
  endDate?: string
  location?: string
  isOnline: boolean
  maxAttendees?: number
  createdAt: string
  organizer: Pick<User, 'id' | 'name' | 'avatarUrl'>
  barrio: Pick<Barrio, 'id' | 'name' | 'slug'>
  _count?: { rsvps: number }
}

export interface Message {
  id: string
  content: string
  readAt?: string
  createdAt: string
  sender: Pick<User, 'id' | 'name' | 'avatarUrl'>
  receiver: Pick<User, 'id' | 'name' | 'avatarUrl'>
  post?: { id: string; title: string }
}

export interface Review {
  id: string
  rating: number
  comment?: string
  createdAt: string
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}
