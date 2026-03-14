
import type {
  PlayerInfo,
  ShipStatus,
  PlayerJoinInput,
  PlayerLeaveInput,
  PlayerListInput,
  ShipMoveInput,
  ShipToggleShieldInput,
  ShipVentInput,
  ShipGetStatusInput,
} from "@vt/shared/trpc";
import { websocketService, WebSocketService } from "./websocket";

// WebSocket客户端适配器，提供与tRPC兼容的API
export class WebSocketTRPCClient {
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  // 玩家相关操作
  async playerJoin(input: PlayerJoinInput): Promise<PlayerInfo> {
    return this.wsService.joinPlayer(input.id, input.name, input.roomId);
  }

  async playerLeave(input: PlayerLeaveInput): Promise<void> {
    return this.wsService.leavePlayer(input.playerId, input.roomId);
  }

  async playerList(input: PlayerListInput): Promise<PlayerInfo[]> {
    return this.wsService.listPlayers(input.roomId);
  }

  // 舰船相关操作
  async shipMove(input: ShipMoveInput): Promise<ShipStatus | null> {
    return this.wsService.moveShip(
      input.shipId,
      input.phase,
      input.type,
      input.distance,
      input.angle
    );
  }

  async shipToggleShield(input: ShipToggleShieldInput): Promise<ShipStatus | null> {
    return this.wsService.toggleShield(input.shipId);
  }

  async shipVent(input: ShipVentInput): Promise<ShipStatus | null> {
    return this.wsService.ventShip(input.shipId);
  }

  async shipGetStatus(input: ShipGetStatusInput): Promise<ShipStatus | null> {
    return this.wsService.getShipStatus(input.shipId);
  }

  // 通用请求方法
  async request<T = any>(operation: string, data: any): Promise<T> {
    return this.wsService.sendRequest(operation, data);
  }

  // 连接管理
  connect(url: string): Promise<void> {
    return this.wsService.connect(url);
  }

  disconnect(): void {
    this.wsService.disconnect();
  }

  isConnected(): boolean {
    return this.wsService.isConnected();
  }
}

// 默认客户端实例
export const wsClient = new WebSocketTRPCClient(websocketService);

// React Hook友好的包装器
export function useWebSocketClient(): WebSocketTRPCClient {
  return wsClient;
}

// 向后兼容导出别名
export const trpcClient = wsClient;

// 导出类型
export type {
  PlayerInfo,
  ShipStatus,
  PlayerJoinInput,
  PlayerLeaveInput,
  PlayerListInput,
  ShipMoveInput,
  ShipToggleShieldInput,
  ShipVentInput,
  ShipGetStatusInput,
};

// 工具函数：创建类型安全的WebSocket调用
export function createWSCaller() {
  return {
    player: {
      join: (input: PlayerJoinInput) => wsClient.playerJoin(input),
      leave: (input: PlayerLeaveInput) => wsClient.playerLeave(input),
      list: (input: PlayerListInput) => wsClient.playerList(input),
    },
    ship: {
      move: (input: ShipMoveInput) => wsClient.shipMove(input),
      toggleShield: (input: ShipToggleShieldInput) => wsClient.shipToggleShield(input),
      vent: (input: ShipVentInput) => wsClient.shipVent(input),
      getStatus: (input: ShipGetStatusInput) => wsClient.shipGetStatus(input),
    },
  };
}

// 默认导出
export default wsClient;
