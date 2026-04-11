/**
 * 认证类型定义 - 简化版
 */

export interface User {
  id?: string;
  username: string;
  createdAt?: number;
  lastLoginAt?: number;
}

export interface LoginRequest {
  username: string;
  password?: string;
}

export interface RegisterRequest {
  username: string;
  password?: string;
  confirmPassword?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}
