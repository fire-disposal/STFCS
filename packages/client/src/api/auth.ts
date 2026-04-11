/**
 * 认证 API 客户端
 */

import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@/types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:2567';

export class AuthAPI {
  /**
   * 注册
   */
  static async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.json();
  }

  /**
   * 登录
   */
  static async login(request: LoginRequest): Promise<AuthResponse & { user?: User; token?: string }> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.json();
  }

  /**
   * 登出
   */
  static async logout(token: string): Promise<void> {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  /**
   * 验证 token
   */
  static async validateToken(token: string): Promise<{ valid: boolean; user?: User }> {
    const response = await fetch(`${API_BASE}/api/auth/validate`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }
}
