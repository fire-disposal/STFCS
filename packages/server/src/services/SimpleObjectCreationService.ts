/**
 * 简化对象创建服务
 * 处理游戏中动态创建对象的逻辑
 */

export interface ObjectCreationRequest {
  objectType: string;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
  faction?: string;
  ownerId?: string;
}

export interface ObjectCreationResult {
  success: boolean;
  objectId?: string;
  object?: Record<string, unknown>;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface CreatorInfo {
  id: string;
  role: 'dm' | 'player';
  name: string;
}

export class SimpleObjectCreationService {
  /**
   * 验证对象创建请求
   */
  validateRequest(request: ObjectCreationRequest): ValidationResult {
    if (!request.objectType) {
      return { valid: false, error: 'Missing objectType' };
    }
    
    if (!request.data) {
      return { valid: false, error: 'Missing data' };
    }
    
    // 基本验证通过
    return { valid: true };
  }
  
  /**
   * 创建对象
   */
  createObject(
    request: ObjectCreationRequest,
    _gameState: any,
    creator: CreatorInfo
  ): ObjectCreationResult {
    try {
      // 生成对象ID
      const objectId = this.generateObjectId(request.objectType);
      
      // 创建基本对象结构
      const object = {
        $id: objectId,
        type: request.objectType,
        data: request.data,
        metadata: {
          name: (request.data as any).name || `New ${request.objectType}`,
          createdBy: creator.id,
          creatorName: creator.name,
          creatorRole: creator.role,
          createdAt: Date.now(),
          faction: request.faction || 'NEUTRAL'
        },
        ...(request.position && { position: request.position }),
        ...(request.faction && { faction: request.faction }),
        ...(request.ownerId && { ownerId: request.ownerId })
      };
      
      return {
        success: true,
        objectId,
        object
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create object'
      };
    }
  }
  
  /**
   * 检查创建权限
   * 规则：
   * 1. 所有玩家在第一回合部署阶段可以创建对象
   * 2. 后续回合中只有DM可以创建对象
   * 3. DM始终可以创建任何对象
   */
  checkCreationPermission(
    creator: CreatorInfo,
    gameState: any
  ): { allowed: boolean; reason?: string } {
    // DM始终可以创建
    if (creator.role === 'dm') {
      return { allowed: true };
    }
    
    // 检查游戏状态
    const turn = gameState.turn || 1;
    const phase = gameState.phase || 'DEPLOYMENT';
    
    // 玩家在第一回合部署阶段可以创建
    if (turn === 1 && phase === 'DEPLOYMENT') {
      return { allowed: true };
    }
    
    // 其他情况不允许
    return {
      allowed: false,
      reason: `Only DM can create objects after turn 1. Current: turn ${turn}, phase ${phase}`
    };
  }
  
  /**
   * 生成对象ID
   */
  private generateObjectId(objectType: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${objectType}:${timestamp}_${random}`;
  }
}