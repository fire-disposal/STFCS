/**
 * 内存用户存储服务
 * 
 * 简单的内存存储，用于开发和测试
 * 生产环境应替换为数据库
 */

import type { User, LoginRequest, RegisterRequest } from '../types/auth';

export class InMemoryUserStore {
  private users: Map<string, User> = new Map();
  private tokens: Map<string, string> = new Map(); // token -> userId

  /**
   * 生成简单 token
   */
  private generateToken(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成用户 ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 注册用户
   */
  async register(request: RegisterRequest): Promise<{ success: boolean; user?: Omit<User, 'password'>; message?: string }> {
    // 验证密码匹配
    if (request.password !== request.confirmPassword) {
      return { success: false, message: '两次输入的密码不一致' };
    }

    // 验证用户名长度
    if (request.username.length < 3 || request.username.length > 32) {
      return { success: false, message: '用户名长度必须在 3-32 个字符之间' };
    }

    // 验证密码长度
    if (request.password.length < 6) {
      return { success: false, message: '密码长度必须至少 6 个字符' };
    }

    // 检查用户名是否已存在
    const existingUser = Array.from(this.users.values()).find(
      u => u.username.toLowerCase() === request.username.toLowerCase()
    );

    if (existingUser) {
      return { success: false, message: '用户名已被使用' };
    }

    // 创建用户
    const user: User = {
      id: this.generateUserId(),
      username: request.username,
      password: request.password, // 注意：生产环境应该哈希
      createdAt: Date.now(),
    };

    this.users.set(user.id, user);
    console.log(`[Auth] User registered: ${user.username} (${user.id})`);

    return {
      success: true,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 登录
   */
  async login(request: LoginRequest): Promise<{ success: boolean; user?: Omit<User, 'password'>; token?: string; message?: string }> {
    // 查找用户
    const user = Array.from(this.users.values()).find(
      u => u.username.toLowerCase() === request.username.toLowerCase()
    );

    if (!user) {
      return { success: false, message: '用户名或密码错误' };
    }

    // 验证密码
    if (user.password !== request.password) {
      return { success: false, message: '用户名或密码错误' };
    }

    // 生成 token
    const token = this.generateToken();
    this.tokens.set(token, user.id);

    // 更新最后登录时间
    user.lastLoginAt = Date.now();
    this.users.set(user.id, user);

    console.log(`[Auth] User logged in: ${user.username} (${user.id})`);

    return {
      success: true,
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * 验证 token
   */
  async validateToken(token: string): Promise<{ valid: boolean; user?: Omit<User, 'password'> }> {
    const userId = this.tokens.get(token);
    if (!userId) {
      return { valid: false };
    }

    const user = this.users.get(userId);
    if (!user) {
      this.tokens.delete(token);
      return { valid: false };
    }

    return {
      valid: true,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 登出
   */
  async logout(token: string): Promise<void> {
    this.tokens.delete(token);
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  /**
   * 获取所有用户
   */
  getAllUsers(): Omit<User, 'password'>[] {
    return Array.from(this.users.values()).map(u => this.sanitizeUser(u));
  }

  /**
   * 移除敏感信息
   */
  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * 清理过期 token（简单实现，实际应该用定时任务）
   */
  cleanupExpiredTokens(): void {
    // 这里简单实现，实际应该根据 token 创建时间清理
    // 现在只是演示用
  }
}

// 单例实例
export const userStore = new InMemoryUserStore();
