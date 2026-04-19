/**
 * 游戏命令处理器
 * 处理游戏内的各种命令（移动、攻击、技能等）
 */

import { createLogger } from "../../../infra/simple-logger.js";
import type { ConnectionManager } from "../connection.js";
import type { RoomManager } from "../../rooms/RoomManager.js";
import type { Room } from "../../rooms/Room.js";

import type {
  Message,
  GameCommandMessage,
  createMessage,
  createErrorMessage,
} from "../protocol.js";



/**
 * 游戏命令处理器
 */
export class GameCommandHandler {
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private logger = createLogger("game-command-handler");

  constructor(connectionManager: ConnectionManager, roomManager: RoomManager) {
    this.connectionManager = connectionManager;
    this.roomManager = roomManager;
  }

  /**
   * 处理游戏命令
   */
  async handleCommand(userId: string, roomId: string, message: GameCommandMessage): Promise<void> {
    const { payload, id: requestId } = message;
    
    // 简化：直接处理命令，不进行验证

    const { command, params } = payload;
    
    try {
      // 根据命令类型路由处理
      switch (command) {
        case "move":
          await this.handleMoveCommand(userId, roomId, params, requestId);
          break;
        case "rotate":
          await this.handleRotateCommand(userId, roomId, params, requestId);
          break;
        case "attack":
          await this.handleAttackCommand(userId, roomId, params, requestId);
          break;
        case "toggle_shield":
          await this.handleToggleShieldCommand(userId, roomId, params, requestId);
          break;
        case "vent_flux":
          await this.handleVentFluxCommand(userId, roomId, params, requestId);
          break;
        case "end_turn":
          await this.handleEndTurnCommand(userId, roomId, params, requestId);
          break;
        case "apply_modifier":
          await this.handleApplyModifierCommand(userId, roomId, params, requestId);
          break;
        default:
          this.sendError(userId, "UNKNOWN_COMMAND", `未知的命令: ${command}`, requestId);
      }
    } catch (error) {
      this.logger.error("Error handling game command", error, {
        userId,
        roomId,
        command,
      });
      
      this.sendError(userId, "COMMAND_ERROR", "命令执行失败", requestId);
    }
  }

  // ==================== 命令处理 ====================

  /**
   * 处理移动命令
   */
  private async handleMoveCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 验证参数
    const required = ["tokenId", "distance", "direction", "phase"];
    for (const field of required) {
      if (!(field in params)) {
        this.sendError(userId, "INVALID_PARAMS", `缺少参数: ${field}`, requestId);
        return;
      }
    }

    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的移动处理逻辑
    // 这里应该调用房间的handlePlayerMessage或直接调用游戏引擎
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "move",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新
    this.broadcastGameStateUpdate(roomId);
  }

  /**
   * 处理旋转命令
   */
  private async handleRotateCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 验证参数
    const required = ["tokenId", "angle", "phase"];
    for (const field of required) {
      if (!(field in params)) {
        this.sendError(userId, "INVALID_PARAMS", `缺少参数: ${field}`, requestId);
        return;
      }
    }

    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的旋转处理逻辑
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "rotate",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新
    this.broadcastGameStateUpdate(roomId);
  }

  /**
   * 处理攻击命令
   */
  private async handleAttackCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 验证参数
    const required = ["attackerId", "targetId", "weaponId"];
    for (const field of required) {
      if (!(field in params)) {
        this.sendError(userId, "INVALID_PARAMS", `缺少参数: ${field}`, requestId);
        return;
      }
    }

    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的攻击处理逻辑
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "attack",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新和事件
    this.broadcastGameStateUpdate(roomId);
    this.broadcastGameEvent(roomId, {
      type: "attack",
      source: params.attackerId,
      target: params.targetId,
      data: params,
    });
  }

  /**
   * 处理切换护盾命令
   */
  private async handleToggleShieldCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 验证参数
    const required = ["tokenId", "active"];
    for (const field of required) {
      if (!(field in params)) {
        this.sendError(userId, "INVALID_PARAMS", `缺少参数: ${field}`, requestId);
        return;
      }
    }

    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的护盾处理逻辑
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "toggle_shield",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新
    this.broadcastGameStateUpdate(roomId);
  }

  /**
   * 处理排散辐能命令
   */
  private async handleVentFluxCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 验证参数
    const required = ["tokenId"];
    for (const field of required) {
      if (!(field in params)) {
        this.sendError(userId, "INVALID_PARAMS", `缺少参数: ${field}`, requestId);
        return;
      }
    }

    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的辐能处理逻辑
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "vent_flux",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新
    this.broadcastGameStateUpdate(roomId);
  }

  /**
   * 处理结束回合命令
   */
  private async handleEndTurnCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的回合结束处理逻辑
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "end_turn",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新和回合变化事件
    this.broadcastGameStateUpdate(roomId);
    this.broadcastGameEvent(roomId, {
      type: "turn_end",
      source: userId,
      data: { endedAt: Date.now() },
    });
  }

  /**
   * 处理应用修正命令
   */
  private async handleApplyModifierCommand(
    userId: string,
    roomId: string,
    params: any,
    requestId?: string
  ): Promise<void> {
    // 验证参数
    const required = ["targetType", "modifier"];
    for (const field of required) {
      if (!(field in params)) {
        this.sendError(userId, "INVALID_PARAMS", `缺少参数: ${field}`, requestId);
        return;
      }
    }

    // 获取房间
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(userId, "ROOM_NOT_FOUND", "房间不存在", requestId);
      return;
    }

    // TODO: 调用房间的修正处理逻辑
    
    // 发送命令确认
    this.sendResponse(userId, {
      type: "game_command_response",
      payload: {
        command: "apply_modifier",
        success: true,
        params,
        executedAt: Date.now(),
      },
    }, requestId);
    
    // 广播游戏状态更新
    this.broadcastGameStateUpdate(roomId);
  }

  // ==================== 消息发送 ====================

  /**
   * 发送响应消息
   */
  private sendResponse(userId: string, response: any, requestId?: string): void {
    const message = createMessage(response.type, response.payload, requestId);
    
    // 找到用户的连接并发送消息
    for (const [connectionId, connection] of this.connectionManager.getAllConnections()) {
      if (connection.userId === userId) {
        this.connectionManager.send(connectionId, {
          type: message.type,
          payload: message.payload,
          requestId: message.id,
        });
        break;
      }
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(userId: string, code: string, message: string, requestId?: string): void {
    const errorMessage = createErrorMessage(code, message, undefined, requestId);
    
    // 找到用户的连接并发送错误消息
    for (const [connectionId, connection] of this.connectionManager.getAllConnections()) {
      if (connection.userId === userId) {
        this.connectionManager.send(connectionId, {
          type: errorMessage.type,
          payload: errorMessage.payload,
          requestId: errorMessage.id,
        });
        break;
      }
    }
  }

  /**
   * 广播游戏状态更新
   */
  private broadcastGameStateUpdate(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // TODO: 获取实际的游戏状态
    const gameState = {
      phase: "BATTLE",
      turn: 1,
      activeFaction: "PLAYER",
    };

    const message = createMessage("game_state_update", {
      roomId,
      updateType: "partial",
      state: gameState,
    });

    this.connectionManager.broadcastToRoom(roomId, {
      type: message.type,
      payload: message.payload,
    });
  }

  /**
   * 广播游戏事件
   */
  private broadcastGameEvent(roomId: string, event: any): void {
    const message = createMessage("game_event", {
      roomId,
      events: [{
        type: event.type,
        timestamp: Date.now(),
        source: event.source,
        target: event.target,
        data: event.data,
      }],
    });

    this.connectionManager.broadcastToRoom(roomId, {
      type: message.type,
      payload: message.payload,
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 验证命令权限
   */
  private validateCommandPermission(
    userId: string,
    room: Room,
    command: string
  ): { valid: boolean; error?: string } {
    // TODO: 实现实际的权限验证逻辑
    // 检查用户是否在房间中
    // 检查用户是否有权限执行该命令
    // 检查游戏阶段是否允许该命令
    
    return { valid: true };
  }

  /**
   * 获取房间游戏状态
   */
  private getRoomGameState(roomId: string): any {
    // TODO: 从房间获取实际的游戏状态
    return {};
  }
}