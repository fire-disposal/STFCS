/**
 * RPC Server - 类型安全的 handler 注册系统（Mutative 版）
 */

import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { WsEventName, WsPayload, WsResponseData, EditLogContext } from "@vt/data";
import { validateWsPayload, createWsResponse } from "@vt/data";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { Room } from "../rooms/Room.js";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";
import { MutativeStateManager } from "../../core/state/MutativeStateManager.js";
export { MutativeStateManager };

export interface SocketData {
  playerId?: string;
  playerName?: string;
  roomId?: string;
  role?: "HOST" | "PLAYER";
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
  state: MutativeStateManager;
  data: SocketData;

  requireAuth(): void;
  requireRoom(): void;
  requireHost(): void;
  requirePlayer(): void;
  requireTokenControl(tokenId: string): void;

  broadcast(event: string, data: unknown): void;
  broadcastTo(excludePlayerId: string, event: string, data: unknown): void;
  
  editLogContext(reason?: string): EditLogContext;
}

export interface RpcServices {
  playerProfile: unknown;
  shipBuild: unknown;
  preset: unknown;
  asset: unknown;
  playerAvatar: unknown;
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

        const room = roomManager.getRoom(sd.roomId ?? "") ?? null;
        
        if (room) {
          room.setIo(io);
        }
        
        const state = room?.getStateManager() ?? new MutativeStateManager(sd.roomId ?? "");

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
requireTokenControl(tokenId: string): void {
			this.requireRoom();
			const token = this.room?.getCombatToken(tokenId);
			if (!token) throw Object.assign(new Error("舰船不存在"), { code: "TOKEN_NOT_FOUND" });
			
			if (this.room?.creatorId === this.playerId) return;
			
			if (token.runtime?.ownerId !== this.playerId) {
				throw Object.assign(new Error("无权操作此舰船"), { code: "NO_TOKEN_CONTROL" });
			}
		},
          broadcast(event: string, data: unknown) {
            if (sd.roomId) io.to(sd.roomId).emit(event, data);
          },
          broadcastTo(excludePlayerId: string, event: string, data: unknown) {
            if (sd.roomId) io.to(sd.roomId).emit(event, { excludePlayer: excludePlayerId, ...(data as Record<string, unknown>) });
          },
          editLogContext(reason?: string): EditLogContext {
            const ctx: EditLogContext = {
              playerId: this.playerId,
              playerName: this.playerName,
            };
            if (reason !== undefined) ctx.reason = reason;
            return ctx;
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