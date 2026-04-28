/**
 * room namespace handlers — 房间创建/列表/加入/离开/操作/删除
 */
import { err } from "./err.js";
import { ErrorCodes, PlayerRole, TURN_ORDER, createBattleLogEvent } from "@vt/data";
import type { WsPayload } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import { playerInfoService } from "./services.js";
import { assetService } from "./services.js";

export const roomHandlers = {
    create: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"room:create">;

        const existingRooms = ctx.roomManager.getAllRooms().filter(r => r.creatorId === ctx.playerId);
        if (existingRooms.length > 0) {
            throw err("你已拥有一个房间，请先删除现有房间", ErrorCodes.ALREADY_HAS_ROOM);
        }

        const room = ctx.roomManager.createRoom({
            roomName: p.name,
            maxPlayers: p.maxPlayers ?? 4,
            mapWidth: p.mapWidth ?? 2000,
            mapHeight: p.mapHeight ?? 2000,
            creatorSessionId: ctx.playerId,
            creatorName: ctx.playerName,
        });
        if (!room) throw err("创建房间失败", ErrorCodes.ROOM_CREATE_FAILED);

        ctx.io.emit("room:list_updated", {
            action: "created",
            room: {
                roomId: room.id,
                name: room.name,
                ownerId: ctx.playerId,
                ownerName: ctx.playerName,
                playerCount: 0,
                maxPlayers: room.maxPlayers,
                phase: room.phase,
            }
        });

        return { roomId: room.id, roomName: room.name, ownerId: ctx.playerId, isHost: true };
    },

    list: async (_: unknown, ctx: RpcContext) => {
        const rooms = ctx.roomManager.getAllRooms().map((r: any) => ({
            roomId: r.id,
            name: r.name,
            ownerId: r.creatorId,
            ownerName: r.creatorName ?? "未知",
            playerCount: r.playerCount,
            maxPlayers: r.maxPlayers,
            phase: r.phase,
            turnCount: r.gameState?.turnCount ?? 0,
            createdAt: r.createdAt,
        }));
        return { rooms };
    },

    join: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"room:join">;
        const room = ctx.roomManager.getRoom(p.roomId);
        if (!room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);

        const playerInfo = await playerInfoService.findByPlayerId(ctx.playerId);
        const avatar = playerInfo?.file.info.avatar ?? undefined;

        const joinSuccess = ctx.roomManager.joinRoom(p.roomId, ctx.socket.id, ctx.playerId, ctx.playerName, avatar);
        if (!joinSuccess) throw err("无法加入房间（可能已在房间中或房间已满）", ErrorCodes.JOIN_FAILED);

        ctx.socket.join(p.roomId);
        // 广播全量状态给房间内已有玩家（排除刚加入者，他已有 state）
        ctx.socket.to(p.roomId).emit("sync:full", room.getGameState());
        ctx.socket.data.roomId = p.roomId;
        const isHost = room.creatorId === ctx.playerId;
        const role = isHost ? PlayerRole.HOST : PlayerRole.PLAYER;
        ctx.socket.data.role = role;

        ctx.io.emit("room:list_updated", {
            action: "updated",
            room: {
                roomId: p.roomId,
                name: room.name,
                ownerId: room.creatorId,
                ownerName: room.creatorName,
                playerCount: room.getPlayerCount(),
                maxPlayers: room.maxPlayers,
                phase: room.phase,
            }
        });

        return {
            roomId: p.roomId,
            roomName: room.name,
            ownerId: room.creatorId,
            isHost,
            role,
            state: room.getGameState(),
        };
    },

    leave: async (_: unknown, ctx: RpcContext) => {
        ctx.requireRoom();
        const room = ctx.roomManager.getRoom(ctx.roomId);

        const leaveSuccess = ctx.roomManager.leaveRoom(ctx.roomId, ctx.playerId);

        ctx.socket.leave(ctx.roomId);
        ctx.socket.data.roomId = undefined;
        ctx.socket.data.role = undefined;

        if (room) {
            const playerCountAfter = room.getPlayerCount();
            ctx.io.emit("room:list_updated", {
                action: "updated",
                room: {
                    roomId: ctx.roomId,
                    name: room.name,
                    ownerId: room.creatorId,
                    ownerName: room.creatorName,
                    playerCount: playerCountAfter,
                    maxPlayers: room.maxPlayers,
                    phase: room.phase,
                }
            });
        }

        if (!leaveSuccess) {
            console.warn(`leaveRoom returned false for player ${ctx.playerId} in room ${ctx.roomId}`);
        }
    },

    rejoin: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"room:rejoin">;
        const room = ctx.roomManager.getRoom(p.roomId);
        if (!room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);

        if (!room.wasPlayerInRoom(ctx.playerId)) {
            throw err("您不在此房间中", ErrorCodes.NOT_IN_ROOM);
        }

        const playerInfo = await playerInfoService.findByPlayerId(ctx.playerId);
        const avatar = playerInfo?.file.info.avatar ?? undefined;

        const reconnectSuccess = room.reconnectPlayer(ctx.socket.id, ctx.playerId, ctx.playerName, avatar);
        if (!reconnectSuccess) throw err("重连失败", ErrorCodes.JOIN_FAILED);

        ctx.socket.join(p.roomId);
        ctx.socket.data.roomId = p.roomId;
        const isHost = room.creatorId === ctx.playerId;
        const role = isHost ? PlayerRole.HOST : PlayerRole.PLAYER;
        ctx.socket.data.role = role;

        ctx.io.emit("room:list_updated", {
            action: "updated",
            room: {
                roomId: p.roomId,
                name: room.name,
                ownerId: room.creatorId,
                ownerName: room.creatorName,
                playerCount: room.getPlayerCount(),
                maxPlayers: room.maxPlayers,
                phase: room.phase,
            }
        });

        return {
            success: true,
            state: room.getGameState(),
            role,
        };
    },

    action: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireRoom();
        const p = payload as WsPayload<"room:action">;
        const room = ctx.roomManager.getRoom(ctx.roomId);
        if (!room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);
        switch (p.action) {
            case "ready":
                room.togglePlayerReady(ctx.playerId);
                return;
            case "start":
                ctx.requireHost();
                ctx.state.startGame();
                ctx.state.resetAllPlayersReady();
                ctx.state.appendLog(createBattleLogEvent("game_started", {
                    firstFaction: TURN_ORDER[0],
                }));
                return;
            case "kick":
                ctx.requireHost();
                if (!p.targetId) throw err("需要 targetId", ErrorCodes.TARGET_REQUIRED);
                room.leavePlayer(p.targetId);
                ctx.state.removePlayer(p.targetId);
                return;
            case "transfer_host":
                ctx.requireHost();
                if (!p.targetId) throw err("需要 targetId", ErrorCodes.TARGET_REQUIRED);
                room.creatorId = p.targetId;
                ctx.socket.data.role = PlayerRole.PLAYER;
                ctx.state.changeHost(p.targetId);
                return;
        }
    },

    get_assets: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireRoom();
        const p = payload as WsPayload<"room:get_assets">;
        const room = ctx.roomManager.getRoom(ctx.roomId);
        if (!room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);
        const assetIds: string[] = [];
        const tokens = room.getCombatTokens();
        for (const token of tokens) {
            const texture = token.spec.texture;
            if (texture?.assetId) assetIds.push(texture.assetId);
            for (const mount of token.spec.mounts ?? []) {
                if (typeof mount.weapon !== "string" && mount.weapon?.spec?.texture?.assetId) {
                    assetIds.push(mount.weapon.spec.texture.assetId);
                }
            }
        }
        const assets = await assetService.batchGetAssets([...new Set(assetIds)], p.includeData);
        return { assets };
    },

    delete: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"room:delete">;
        const room = ctx.roomManager.getRoom(p.roomId);
        if (!room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);
        if (room.creatorId !== ctx.playerId) throw err("只有房主可以删除房间", ErrorCodes.NOT_HOST);
        await ctx.roomManager.removeRoom(p.roomId);
        return;
    },
};
