/**
 * 用户认证类型定义
 */

export interface User {
  id: string;
  username: string;
  password: string; // 注意：生产环境应该使用哈希
  createdAt: number;
  lastLoginAt?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  user?: Omit<User, 'password'>;
  token?: string;
  message?: string;
}
