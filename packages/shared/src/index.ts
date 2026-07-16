// Shared types used across backend and frontend

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  tenantId: string; // agency ID
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Product {
  id: string;
  agencyId: string;
  sku: string;
  name: string;
  basePrice: number;
  description?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Order {
  id: string;
  agencyId: string;
  orderNumber: string;
  customerName: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  createdAt: Date;
}

export type ApiError = {
  statusCode: number;
  message: string;
  error?: string;
};
