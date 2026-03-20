/**
 * 移动交互服务
 *
 * 处理三阶段移动的交互逻辑：
 * - 鼠标/键盘输入处理
 * - 移动验证
 * - 移动预览计算
 * - 与服务器通信
 */

import type { MovementState, MovementPhase, MovementType, MovementAction } from '@vt/shared/types';
import type { Point } from '@vt/shared/core-types';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';

/**
 * 移动输入类型
 */
export type MovementInputType = 'mouse' | 'keyboard' | 'touch';

/**
 * 移动输入事件
 */
export interface MovementInputEvent {
  type: MovementInputType;
  action: 'start' | 'move' | 'end' | 'cancel';
  position?: Point;
  distance?: number;
  angle?: number;
  key?: string;
}

/**
 * 移动预览结果
 */
export interface MovementPreviewResult {
  isValid: boolean;
  position: Point;
  heading: number;
  distance: number;
  angle: number;
  reason?: string;
}

/**
 * 移动交互服务配置
 */
export interface MovementInteractionConfig {
  shipId: string;
  initialState: MovementState;
  initialPosition: Point;
  initialHeading: number;
  onPreviewUpdate?: (preview: MovementPreviewResult | null) => void;
  onMoveComplete?: (action: MovementAction) => void;
  onError?: (error: string) => void;
}

/**
 * 移动交互服务
 */
export class MovementInteractionService {
  private shipId: string;
  private movementState: MovementState;
  private currentPosition: Point;
  private currentHeading: number;
  private previewPosition: Point | null = null;
  private previewHeading: number | null = null;
  private isDragging: boolean = false;
  private dragStartPosition: Point | null = null;

  private config: MovementInteractionConfig;

  constructor(config: MovementInteractionConfig) {
    this.config = config;
    this.shipId = config.shipId;
    this.movementState = { ...config.initialState };
    this.currentPosition = { ...config.initialPosition };
    this.currentHeading = config.initialHeading;
  }

  /**
   * 获取当前移动状态
   */
  getMovementState(): MovementState {
    return { ...this.movementState };
  }

  /**
   * 获取当前位置
   */
  getCurrentPosition(): Point {
    return { ...this.currentPosition };
  }

  /**
   * 获取当前朝向
   */
  getCurrentHeading(): number {
    return this.currentHeading;
  }

  /**
   * 获取预览位置
   */
  getPreviewPosition(): Point | null {
    return this.previewPosition ? { ...this.previewPosition } : null;
  }

  /**
   * 获取预览朝向
   */
  getPreviewHeading(): number | null {
    return this.previewHeading;
  }

  /**
   * 更新移动状态
   */
  updateMovementState(state: Partial<MovementState>): void {
    this.movementState = { ...this.movementState, ...state };
  }

  /**
   * 重置移动状态（新回合）
   */
  resetMovementState(): void {
    this.movementState = {
      ...this.movementState,
      currentPhase: 1,
      phase1Complete: false,
      phase2Complete: false,
      phase3Complete: false,
      remainingSpeed: this.movementState.maxSpeed,
      remainingTurn: this.movementState.maxTurnRate,
      movementHistory: [],
    };
    this.previewPosition = null;
    this.previewHeading = null;
  }

  /**
   * 处理输入事件
   */
  handleInput(event: MovementInputEvent): MovementPreviewResult | null {
    const phase = this.movementState.currentPhase;

    switch (event.type) {
      case 'mouse':
        return this.handleMouseInput(event, phase);
      case 'keyboard':
        return this.handleKeyboardInput(event, phase);
      case 'touch':
        return this.handleTouchInput(event, phase);
      default:
        return null;
    }
  }

  /**
   * 处理鼠标输入
   */
  private handleMouseInput(event: MovementInputEvent, phase: MovementPhase): MovementPreviewResult | null {
    if (phase === 2) {
      // 转向阶段：鼠标控制旋转
      return this.handleRotationMouseInput(event);
    } else {
      // 平移阶段：鼠标控制移动
      return this.handleTranslationMouseInput(event);
    }
  }

  /**
   * 处理平移阶段鼠标输入
   */
  private handleTranslationMouseInput(event: MovementInputEvent): MovementPreviewResult | null {
    switch (event.action) {
      case 'start':
        if (event.position) {
          this.isDragging = true;
          this.dragStartPosition = { ...this.currentPosition };
          return null;
        }
        break;

      case 'move':
        if (this.isDragging && event.position) {
          const preview = this.calculateTranslationPreview(event.position);
          this.previewPosition = preview.position;
          this.config.onPreviewUpdate?.(preview);
          return preview;
        }
        break;

      case 'end':
        if (this.isDragging && this.previewPosition) {
          this.isDragging = false;
          return this.confirmTranslation(this.previewPosition);
        }
        break;

      case 'cancel':
        this.isDragging = false;
        this.previewPosition = null;
        this.config.onPreviewUpdate?.(null);
        break;
    }

    return null;
  }

  /**
   * 处理转向阶段鼠标输入
   */
  private handleRotationMouseInput(event: MovementInputEvent): MovementPreviewResult | null {
    if (!event.position) return null;

    // 计算从舰船中心到鼠标位置的角度
    const dx = event.position.x - this.currentPosition.x;
    const dy = event.position.y - this.currentPosition.y;
    const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

    switch (event.action) {
      case 'start':
      case 'move':
        const preview = this.calculateRotationPreview(targetAngle);
        this.previewHeading = preview.heading;
        this.config.onPreviewUpdate?.(preview);
        return preview;

      case 'end':
        if (this.previewHeading !== null) {
          return this.confirmRotation(this.previewHeading);
        }
        break;

      case 'cancel':
        this.previewHeading = null;
        this.config.onPreviewUpdate?.(null);
        break;
    }

    return null;
  }

  /**
   * 处理键盘输入
   */
  private handleKeyboardInput(event: MovementInputEvent, phase: MovementPhase): MovementPreviewResult | null {
    if (event.action !== 'start' || !event.key) return null;

    const key = event.key.toLowerCase();

    if (phase === 2) {
      // 转向阶段
      return this.handleRotationKeyboardInput(key, event.angle ?? 15);
    } else {
      // 平移阶段
      return this.handleTranslationKeyboardInput(key, event.distance ?? 50);
    }
  }

  /**
   * 处理平移阶段键盘输入
   */
  private handleTranslationKeyboardInput(key: string, distance: number): MovementPreviewResult | null {
    const headingRad = (this.currentHeading * Math.PI) / 180;
    let dx = 0;
    let dy = 0;

    switch (key) {
      case 'w':
      case 'arrowup':
        // 前进
        dx = Math.cos(headingRad) * distance;
        dy = Math.sin(headingRad) * distance;
        break;
      case 's':
      case 'arrowdown':
        // 后退
        dx = -Math.cos(headingRad) * distance;
        dy = -Math.sin(headingRad) * distance;
        break;
      case 'a':
      case 'arrowleft':
        // 左横移
        dx = Math.cos(headingRad + Math.PI / 2) * distance;
        dy = Math.sin(headingRad + Math.PI / 2) * distance;
        break;
      case 'd':
      case 'arrowright':
        // 右横移
        dx = Math.cos(headingRad - Math.PI / 2) * distance;
        dy = Math.sin(headingRad - Math.PI / 2) * distance;
        break;
      case 'enter':
      case ' ':
        // 确认移动
        if (this.previewPosition) {
          return this.confirmTranslation(this.previewPosition);
        }
        break;
      case 'escape':
        // 取消移动
        this.previewPosition = null;
        this.config.onPreviewUpdate?.(null);
        break;
      default:
        return null;
    }

    if (dx !== 0 || dy !== 0) {
      const newPosition = {
        x: this.currentPosition.x + dx,
        y: this.currentPosition.y + dy,
      };

      const preview = this.calculateTranslationPreview(newPosition);
      this.previewPosition = preview.position;
      this.config.onPreviewUpdate?.(preview);

      // 自动确认键盘移动
      if (preview.isValid) {
        return this.confirmTranslation(preview.position);
      }
    }

    return null;
  }

  /**
   * 处理转向阶段键盘输入
   */
  private handleRotationKeyboardInput(key: string, angle: number): MovementPreviewResult | null {
    let rotation = 0;

    switch (key) {
      case 'q':
        // 左转
        rotation = -angle;
        break;
      case 'e':
        // 右转
        rotation = angle;
        break;
      case 'enter':
      case ' ':
        // 确认旋转
        if (this.previewHeading !== null) {
          return this.confirmRotation(this.previewHeading);
        }
        break;
      case 'escape':
        // 取消旋转
        this.previewHeading = null;
        this.config.onPreviewUpdate?.(null);
        break;
      default:
        return null;
    }

    if (rotation !== 0) {
      const newHeading = this.normalizeAngle(this.currentHeading + rotation);
      const preview = this.calculateRotationPreview(newHeading);
      this.previewHeading = preview.heading;
      this.config.onPreviewUpdate?.(preview);

      // 自动确认键盘旋转
      if (preview.isValid) {
        return this.confirmRotation(preview.heading);
      }
    }

    return null;
  }

  /**
   * 处理触摸输入
   */
  private handleTouchInput(event: MovementInputEvent, phase: MovementPhase): MovementPreviewResult | null {
    // 触摸输入与鼠标输入类似
    return this.handleMouseInput(event, phase);
  }

  /**
   * 计算平移预览
   */
  private calculateTranslationPreview(targetPosition: Point): MovementPreviewResult {
    const dx = targetPosition.x - this.currentPosition.x;
    const dy = targetPosition.y - this.currentPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 计算相对于当前朝向的分量
    const headingRad = (this.currentHeading * Math.PI) / 180;
    const forwardComponent = dx * Math.cos(headingRad) + dy * Math.sin(headingRad);
    const strafeComponent = -dx * Math.sin(headingRad) + dy * Math.cos(headingRad);

    // 验证移动
    const maxForward = this.movementState.maxSpeed * 2;
    const maxStrafe = this.movementState.maxSpeed;

    let isValid = true;
    let reason: string | undefined;

    if (Math.abs(forwardComponent) > maxForward) {
      isValid = false;
      reason = `前进距离超过最大值 ${maxForward}`;
    }

    if (Math.abs(strafeComponent) > maxStrafe) {
      isValid = false;
      reason = `横移距离超过最大值 ${maxStrafe}`;
    }

    if (distance > this.movementState.remainingSpeed) {
      isValid = false;
      reason = `剩余移动距离不足`;
    }

    return {
      isValid,
      position: targetPosition,
      heading: this.currentHeading,
      distance,
      angle: 0,
      reason,
    };
  }

  /**
   * 计算旋转预览
   */
  private calculateRotationPreview(targetHeading: number): MovementPreviewResult {
    const angleDiff = this.normalizeAngle(targetHeading - this.currentHeading);
    const absAngle = Math.abs(angleDiff);

    let isValid = true;
    let reason: string | undefined;

    if (absAngle > this.movementState.maxTurnRate) {
      isValid = false;
      reason = `旋转角度超过最大值 ${this.movementState.maxTurnRate}°`;
    }

    if (absAngle > this.movementState.remainingTurn) {
      isValid = false;
      reason = `剩余旋转角度不足`;
    }

    return {
      isValid,
      position: this.currentPosition,
      heading: targetHeading,
      distance: 0,
      angle: angleDiff,
      reason,
    };
  }

  /**
   * 确认平移
   */
  private confirmTranslation(position: Point): MovementPreviewResult {
    const preview = this.calculateTranslationPreview(position);

    if (!preview.isValid) {
      this.config.onError?.(preview.reason || '无效的移动');
      return preview;
    }

    // 执行移动
    const action: MovementAction = {
      type: 'straight',
      distance: preview.distance,
      newX: position.x,
      newY: position.y,
      newHeading: this.currentHeading,
      timestamp: Date.now(),
    };

    this.executeMove(action, preview);
    return preview;
  }

  /**
   * 确认旋转
   */
  private confirmRotation(heading: number): MovementPreviewResult {
    const preview = this.calculateRotationPreview(heading);

    if (!preview.isValid) {
      this.config.onError?.(preview.reason || '无效的旋转');
      return preview;
    }

    // 执行旋转
    const action: MovementAction = {
      type: 'rotate',
      angle: preview.angle,
      newX: this.currentPosition.x,
      newY: this.currentPosition.y,
      newHeading: heading,
      timestamp: Date.now(),
    };

    this.executeMove(action, preview);
    return preview;
  }

  /**
   * 执行移动
   */
  private executeMove(action: MovementAction, preview: MovementPreviewResult): void {
    // 更新本地状态
    this.currentPosition = { ...preview.position };
    this.currentHeading = preview.heading;

    // 更新移动状态
    const phase = this.movementState.currentPhase;
    if (phase === 1) {
      this.movementState.phase1Complete = true;
      this.movementState.currentPhase = 2;
      this.movementState.remainingSpeed -= preview.distance;
    } else if (phase === 3) {
      this.movementState.phase3Complete = true;
      this.movementState.remainingSpeed -= preview.distance;
    }

    // 添加到历史
    this.movementState.movementHistory.push(action);

    // 清除预览
    this.previewPosition = null;
    this.previewHeading = null;
    this.config.onPreviewUpdate?.(null);

    // 发送到服务器
    this.sendMoveToServer(action);

    // 回调
    this.config.onMoveComplete?.(action);
  }

  /**
   * 发送移动到服务器
   */
  private sendMoveToServer(action: MovementAction): void {
    websocketService.send({
      type: WS_MESSAGE_TYPES.SHIP_ACTION,
      payload: {
        shipId: this.shipId,
        actionType: 'move',
        actionData: {
          type: action.type,
          distance: action.distance,
          angle: action.angle,
          newPosition: { x: action.newX, y: action.newY },
          newHeading: action.newHeading,
          phase: this.movementState.currentPhase,
        },
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 跳过当前阶段
   */
  skipPhase(): boolean {
    const phase = this.movementState.currentPhase;

    if (phase === 1 && !this.movementState.phase1Complete) {
      this.movementState.phase1Complete = true;
      this.movementState.currentPhase = 2;
      return true;
    }

    if (phase === 2 && !this.movementState.phase2Complete) {
      this.movementState.phase2Complete = true;
      this.movementState.currentPhase = 3;
      return true;
    }

    if (phase === 3 && !this.movementState.phase3Complete) {
      this.movementState.phase3Complete = true;
      return true;
    }

    return false;
  }

  /**
   * 结束移动阶段
   */
  endMovement(): void {
    // 标记所有未完成的阶段为完成
    if (!this.movementState.phase1Complete) {
      this.movementState.phase1Complete = true;
    }
    if (!this.movementState.phase2Complete) {
      this.movementState.phase2Complete = true;
    }
    if (!this.movementState.phase3Complete) {
      this.movementState.phase3Complete = true;
    }

    // 发送结束移动消息
    websocketService.send({
      type: WS_MESSAGE_TYPES.SHIP_ACTION,
      payload: {
        shipId: this.shipId,
        actionType: 'end_movement',
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 标准化角度到 -180 到 180
   */
  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.previewPosition = null;
    this.previewHeading = null;
    this.config.onPreviewUpdate = undefined;
    this.config.onMoveComplete = undefined;
    this.config.onError = undefined;
  }
}

export default MovementInteractionService;