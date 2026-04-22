/**
 * RPC Server - 类型安全的 handler 注册系统
 */

import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { WsEventName, WsPayload, WsResponseData, DeltaChange, CombatToken } from "@vt/data";
import { validateWsPayload, createWsResponse, createSyncDelta } from "@vt/data";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { Room } from "../rooms/Room.js";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";

export interface SocketData {
  playerId?: string;
  playerName?: string;
  roomId?: string;
  role?: "HOST" | "PLAYER";
}

export interface GameStateSnapshot {
  phase: string;
  turnCount: number;
  activeFaction?: string;
  tokens: Record<string, CombatToken>;
  players: Record<string, unknown>;
  modifiers: Record<string, number>;
}

export interface RpcContext {
  socket: Socket;
  io: IOServer;
  playerId: string;
  playerName: string;
  roomId: string;
  role: "HOST" | "PLAYER" | null;
  room: Room | null;
  roomManager: RoomManager;
  persistence: PersistenceManager;
  services: RpcServices;
  state: ObservableState;
  data: SocketData;

  requireAuth(): void;
  requireRoom(): void;
  requireHost(): void;
  requirePlayer(): void;
  requireTokenControl(tokenId: string): void;

  broadcast(event: string, data: unknown): void;
  broadcastTo(excludePlayerId: string, event: string, data: unknown): void;
}

export interface RpcServices {
  playerProfile: unknown;
  shipBuild: unknown;
  preset: unknown;
  asset: unknown;
  playerAvatar: unknown;
}

export class ObservableState {
  private changes: DeltaChange[] = [];
  private io: IOServer;
  private roomId: string;
  private stateRef: () => GameStateSnapshot | null;

  constructor(io: IOServer, roomId: string, stateRef: () => GameStateSnapshot | null) {
    this.io = io;
    this.roomId = roomId;
    this.stateRef = stateRef;
  }

  private add(change: DeltaChange): this {
    this.changes.push(change);
    return this;
  }

  addToken(tokenId: string, token: CombatToken): this {
    return this.add({ type: "token_add", id: tokenId, value: token });
  }

  removeToken(tokenId: string): this {
    return this.add({ type: "token_remove", id: tokenId });
  }

  destroyToken(tokenId: string): this {
    return this.add({ type: "token_destroyed", id: tokenId });
  }

  updateToken(tokenId: string, field: string, value: unknown, oldValue?: unknown): this {
    return this.add({ type: "token_update", id: tokenId, field, value, oldValue });
  }

  updateTokenRuntime(tokenId: string, runtimeUpdates: Record<string, unknown>): this {
    return this.add({ type: "token_update", id: tokenId, field: "runtime", value: runtimeUpdates });
  }

  addPlayer(playerId: string, player: unknown): this {
    return this.add({ type: "player_join", id: playerId, value: player });
  }

  updatePlayer(playerId: string, player: unknown): this {
    return this.add({ type: "player_update", id: playerId, value: player });
  }

  removePlayer(playerId: string): this {
    return this.add({ type: "player_leave", id: playerId });
  }

  changeHost(newHostId: string): this {
    return this.add({ type: "host_change", value: newHostId });
  }

  changePhase(phase: string): this {
    return this.add({ type: "phase_change", value: phase });
  }

  changeTurn(turn: number): this {
    return this.add({ type: "turn_change", value: turn });
  }

  changeFaction(faction: string): this {
    return this.add({ type: "faction_turn", value: faction });
  }

  addModifier(key: string, value: number): this {
    return this.add({ type: "modifier_add", field: key, value });
  }

  removeModifier(key: string): this {
    return this.add({ type: "modifier_remove", field: key });
  }

  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  commit(): void {
    if (this.changes.length > 0) {
      this.io.to(this.roomId).emit("sync:delta", createSyncDelta(this.changes));
      this.changes = [];
    }
  }

  broadcastFull(): void {
    const state = this.stateRef();
    if (state) this.io.to(this.roomId).emit("sync:full", state);
  }
}

type HandlerFn = (payload: WsPayload<WsEventName>, ctx: RpcContext) => WsResponseData<WsEventName> | void | Promise<WsResponseData<WsEventName> | void>;

export class RpcRegistry {
  private handlers = new Map<WsEventName, HandlerFn>();

  on<E extends WsEventName>(event: E, handler: (payload: WsPayload<E>, ctx: RpcContext) => WsResponseData<E> | void | Promise<WsResponseData<E> | void>): this {
    this.handlers.set(event, handler as HandlerFn);
    return this;
  }

  namespace(ns: string, handlers: Record<string, HandlerFn>): this {
    for (const [action, handler] of Object.entries(handlers)) {
      const event = `${ns}:${action}` as WsEventName;
      this.handlers.set(event, handler);
    }
    return this;
  }

  createMiddleware(): (socket: Socket, io: IOServer, roomManager: RoomManager, persistence: PersistenceManager, services: RpcServices) => void {
    return (socket, io, roomManager, persistence, services) => {
      socket.on("request", async (data: { event: WsEventName; requestId: string; payload: unknown }) => {
        const { event, requestId, payload } = data;
        const sd = socket.data as SocketData;

        const state = new ObservableState(io, sd.roomId ?? "", () => {
          const room = roomManager.getRoom(sd.roomId ?? "");
          return room?.getGameState() ?? null;
        });

        const room = roomManager.getRoom(sd.roomId ?? "") ?? null;

        const ctx: RpcContext = {
          socket,
          io,
          playerId: sd.playerId ?? "",
          playerName: sd.playerName ?? "",
          roomId: sd.roomId ?? "",
          role: sd.role ?? null,
          room,
          roomManager,
          persistence,
          services,
          state,
          data: sd,

          requireAuth() {
            if (!sd.playerId) throw Object.assign(new Error("请先登录"), { code: "NOT_AUTHED" });
          },
          requireRoom() {
            if (!sd.roomId) throw Object.assign(new Error("未在房间中"), { code: "NOT_IN_ROOM" });
            if (!room) throw Object.assign(new Error("房间不存在"), { code: "ROOM_NOT_FOUND" });
          },
          requireHost() {
            this.requireRoom();
            if (room && room.creatorId !== sd.playerId) throw Object.assign(new Error("需要房主权限"), { code: "NOT_HOST" });
          },
          requirePlayer() {
            this.requireRoom();
          },
          requireTokenControl(_tokenId: string) {
            this.requireRoom();
            this.requireHost();
          },
          broadcast(event: string, data: unknown) {
            if (sd.roomId) io.to(sd.roomId).emit(event, data);
          },
          broadcastTo(excludePlayerId: string, event: string, data: unknown) {
            if (sd.roomId) io.to(sd.roomId).emit(event, { excludePlayer: excludePlayerId, ...(data as Record<string, unknown>) });
          },
        };

        const validation = validateWsPayload(event, payload);
        if (!validation.success) {
          socket.emit("response", createWsResponse(requestId, false, undefined, { code: "VALIDATION_ERROR", message: validation.error }));
          return;
        }

        const handler = this.handlers.get(event);
        if (!handler) {
          socket.emit("response", createWsResponse(requestId, false, undefined, { code: "UNKNOWN_EVENT", message: `Unknown event: ${event}` }));
          return;
        }

        try {
          const result = await handler(validation.data, ctx);
          ctx.state.commit();
          socket.emit("response", createWsResponse(requestId, true, result ?? undefined));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Internal error";
          const code = (error as { code?: string })?.code ?? "INTERNAL_ERROR";
          socket.emit("response", createWsResponse(requestId, false, undefined, { code, message }));
        }
      });
    };
  }
}

export function createRpcRegistry(): RpcRegistry {
  return new RpcRegistry();
}