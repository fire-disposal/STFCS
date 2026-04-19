/**
 * 简化的消息路由器
 *
 * 职责：将消息路由到对应的 handler
 */

import type { Connection } from "../connection.js";
import type { ConnectionManager } from "../connection.js";
import type { WSMessage } from "../protocol.js";
import { MsgType } from "../protocol.js";
import { createLogger } from "../../../infra/simple-logger.js";
import type { RoomManager } from "../../rooms/RoomManager.js";
import type { PlayerProfileService } from "../../../services/PlayerProfileService.js";
import { PlayerProfileHandler } from "./PlayerProfileHandler.js";
import { ObjectCreationHandler } from "./ObjectCreationHandler.js";

const logger = createLogger("msg-router");

/** 处理器函数类型 */
export type HandlerFn = (conn: Connection, msg: WSMessage) => void | Promise<void>;

/** 消息路由器 */
export class MessageRouter {
  private connMgr: ConnectionManager;
  private roomMgr: RoomManager;
  private profileHandler: PlayerProfileHandler | null = null;
  private objectCreationHandler: ObjectCreationHandler | null = null;
  private handlers = new Map<string, HandlerFn>();

  constructor(connMgr: ConnectionManager, roomMgr: RoomManager, profileService?: PlayerProfileService) {
    this.connMgr = connMgr;
    this.roomMgr = roomMgr;
    
    if (profileService) {
      this.profileHandler = new PlayerProfileHandler(connMgr, profileService);
    }
    
    // 初始化对象创建处理器
    this.objectCreationHandler = new ObjectCreationHandler(connMgr, roomMgr);
    
    this.registerDefaultHandlers();
  }

	/** 注册处理器 */
	register(type: string, handler: HandlerFn): void {
		this.handlers.set(type, handler);
	}

	/** 批量注册 */
	registerBatch(handlers: Record<string, HandlerFn>): void {
		for (const [type, handler] of Object.entries(handlers)) {
			this.handlers.set(type, handler);
		}
	}

	/** 路由消息 */
	route(conn: Connection, msg: WSMessage): void {
		const handler = this.handlers.get(msg.type);
		if (!handler) {
			this.connMgr.sendError(conn.id, "UNKNOWN_TYPE", `Unknown type: ${msg.type}`, msg.id);
			return;
		}

		try {
			const result = handler(conn, msg);
			if (result instanceof Promise) {
				result.catch((err) => {
					logger.error(`Handler error [${msg.type}]:`, err);
					this.connMgr.sendError(conn.id, "HANDLER_ERROR", "Internal error", msg.id);
				});
			}
		} catch (err) {
			logger.error(`Sync handler error [${msg.type}]:`, err);
			this.connMgr.sendError(conn.id, "HANDLER_ERROR", "Internal error", msg.id);
		}
	}

	// ==================== 房间处理器 ====================

  private registerDefaultHandlers(): void {
    this.register(MsgType.ROOM_LIST, this.handleRoomList.bind(this));
    this.register(MsgType.ROOM_CREATE, this.handleRoomCreate.bind(this));
    this.register(MsgType.ROOM_JOIN, this.handleRoomJoin.bind(this));
    this.register(MsgType.ROOM_LEAVE, this.handleRoomLeave.bind(this));
    this.register(MsgType.GAME_QUERY_TARGETS, this.handleQueryTargets.bind(this));

    // 数据修改接口
    this.register(MsgType.DATA_UPDATE, this.handleDataUpdate.bind(this));
    this.register(MsgType.DATA_CREATE, this.handleDataCreate.bind(this));
    this.register(MsgType.DATA_DELETE, this.handleDataDelete.bind(this));

    const gameTypes = [
      MsgType.GAME_MOVE,
      MsgType.GAME_ROTATE,
      MsgType.GAME_ATTACK,
      MsgType.GAME_TOGGLE_SHIELD,
      MsgType.GAME_VENT_FLUX,
      MsgType.GAME_END_TURN,
    ];
    for (const type of gameTypes) {
      this.register(type, this.handleGameCommand.bind(this));
    }

    // 玩家档案处理器
    if (this.profileHandler) {
      this.register('PLAYER_PROFILE', (conn, msg) => this.profileHandler!.handleGetProfile(conn, msg));
      this.register('PLAYER_SHIPS', (conn, msg) => this.profileHandler!.handleGetShips(conn, msg));
      this.register('PLAYER_WEAPONS', (conn, msg) => this.profileHandler!.handleGetWeapons(conn, msg));
      this.register('SHIP_DETAILS', (conn, msg) => this.profileHandler!.handleGetShip(conn, msg));
      this.register('CUSTOM_SHIP_CREATE', (conn, msg) => this.profileHandler!.handleCreateCustomShip(conn, msg));
      this.register('SHIP_UPDATE', (conn, msg) => this.profileHandler!.handleUpdateShip(conn, msg));
      this.register('PRESET_RESTORE', (conn, msg) => this.profileHandler!.handleRestorePresetShip(conn, msg));
      this.register('CUSTOM_WEAPON_CREATE', (conn, msg) => this.profileHandler!.handleCreateCustomWeapon(conn, msg));
      this.register('WEAPON_RESTORE', (conn, msg) => this.profileHandler!.handleRestorePresetWeapon(conn, msg));
      this.register('SAVE_CREATE', (conn, msg) => this.profileHandler!.handleCreateSave(conn, msg));
      this.register('SAVE_LOAD', (conn, msg) => this.profileHandler!.handleLoadSave(conn, msg));
      this.register('SAVE_LIST', (conn, msg) => this.profileHandler!.handleListSaves(conn, msg));
    }
    
    // 对象创建处理器
    if (this.objectCreationHandler) {
      this.register(MsgType.OBJECT_CREATE, (conn, msg) => this.objectCreationHandler!.handleObjectCreate(conn, msg));
      this.register(MsgType.OBJECT_CREATE_FROM_PROFILE, (conn, msg) => this.objectCreationHandler!.handleCreateFromProfile(conn, msg));
    }
  }

	private handleRoomList = (conn: Connection, msg: WSMessage): void => {
		const rooms = this.roomMgr.getAllRooms().map((r) => ({
			id: r.id,
			name: r.name,
			playerCount: r.playerCount,
			maxPlayers: r.maxPlayers,
			status: r.playerCount >= r.maxPlayers ? "full" : "open",
			phase: r.phase,
		}));

		this.connMgr.send(conn.id, {
			type: MsgType.ROOM_LIST_RESULT,
			payload: { rooms },
			...(msg.id ? { id: msg.id } : {}),
		});
	};

	private handleRoomCreate = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as { name?: string; maxPlayers?: number };
		if (!payload.name) {
			this.connMgr.sendError(conn.id, "INVALID_NAME", "Room name required", msg.id);
			return;
		}

		const roomOptions: { roomName: string; creatorSessionId: string; maxPlayers?: number } = {
			roomName: payload.name,
			creatorSessionId: conn.id,
		};
		if (payload.maxPlayers !== undefined) {
			roomOptions.maxPlayers = payload.maxPlayers;
		}
		const room = this.roomMgr.createRoom(roomOptions);

		if (!room) {
			this.connMgr.sendError(conn.id, "CREATE_FAILED", "Failed to create room", msg.id);
			return;
		}

		this.connMgr.send(conn.id, {
			type: MsgType.ROOM_CREATED,
			payload: {
				roomId: room.id,
				name: room.name,
			},
			...(msg.id ? { id: msg.id } : {}),
		});
	};

	private handleRoomJoin = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as { roomId?: string };
		if (!payload.roomId) {
			this.connMgr.sendError(conn.id, "INVALID_ROOM", "Room ID required", msg.id);
			return;
		}

		const success = this.roomMgr.joinRoom(payload.roomId, conn.id, conn.id, conn.playerName);

		if (!success) {
			this.connMgr.sendError(conn.id, "JOIN_FAILED", "Failed to join room", msg.id);
			return;
		}

		conn.roomId = payload.roomId;

		this.connMgr.send(conn.id, {
			type: MsgType.ROOM_JOINED,
			payload: {
				roomId: payload.roomId,
				playerId: conn.id,
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		this.connMgr.broadcastToRoom(payload.roomId, {
			type: MsgType.EVENT,
			payload: {
				eventType: "player_joined",
				data: { playerId: conn.id, playerName: conn.playerName },
			},
		},	conn.id);
	};

	private handleRoomLeave = (conn: Connection, msg: WSMessage): void => {
		if (!conn.roomId) {
			this.connMgr.sendError(conn.id, "NOT_IN_ROOM", "Not in any room", msg.id);
			return;
		}

		this.roomMgr.leaveRoom(conn.roomId, conn.id);

		this.connMgr.broadcastToRoom(conn.roomId, {
			type: MsgType.EVENT,
			payload: {
				eventType: "player_left",
				data: { playerId: conn.id, playerName: conn.playerName },
			},
		});

		conn.roomId = undefined;

		this.connMgr.send(conn.id, {
			type: MsgType.ROOM_LEFT,
			payload: {},
			...(msg.id ? { id: msg.id } : {}),
		});
	};

	// ==================== 武器目标查询处理器 ====================

	private handleQueryTargets = (conn: Connection, msg: WSMessage): void => {
		if (!conn.roomId) {
			this.connMgr.sendError(conn.id, "NOT_IN_ROOM", "Not in any room", msg.id);
			return;
		}

		const payload = msg.payload as { shipId?: string };
		if (!payload.shipId) {
			this.connMgr.sendError(conn.id, "INVALID_SHIP", "Ship ID required", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		const attacker = room.getShipToken(payload.shipId);
		if (!attacker) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Ship not found", msg.id);
			return;
		}

		// 导入目标计算模块
		const { calculateShipWeaponTargets } = require("../../core/engine/rules/targeting.js");
		const potentialTargets = room.getShipTokens();
		const result = calculateShipWeaponTargets(attacker, potentialTargets);

		this.connMgr.send(conn.id, {
			type: MsgType.GAME_TARGETS_RESULT,
			payload: result,
			...(msg.id ? { id: msg.id } : {}),
		});
	};

	// ==================== 攻击指令处理器 ====================

	private handleGameCommand = (conn: Connection, msg: WSMessage): void => {
		if (!conn.roomId) {
			this.connMgr.sendError(conn.id, "NOT_IN_ROOM", "Not in any room", msg.id);
			return;
		}

		// 根据消息类型分发到具体处理器
		switch (msg.type) {
			case MsgType.GAME_ATTACK:
				this.handleAttackCommand(conn, msg);
				break;
			case MsgType.GAME_MOVE:
				this.handleMoveCommand(conn, msg);
				break;
			case MsgType.GAME_ROTATE:
				this.handleRotateCommand(conn, msg);
				break;
			case MsgType.GAME_ADVANCE_PHASE:
				this.handleAdvancePhaseCommand(conn, msg);
				break;
			case MsgType.GAME_TOGGLE_SHIELD:
				this.handleToggleShieldCommand(conn, msg);
				break;
			case MsgType.GAME_VENT_FLUX:
				this.handleVentFluxCommand(conn, msg);
				break;
			case MsgType.GAME_END_TURN:
				// 其他命令的占位处理
				this.handleGenericCommand(conn, msg);
				break;
			default:
				this.connMgr.sendError(conn.id, "UNKNOWN_COMMAND", `Unknown command: ${msg.type}`, msg.id);
		}
	};

	/**
	 * 处理攻击指令
	 */
	private handleAttackCommand = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as {
			attackerId?: string;
			weaponAllocations?: Array<{
				mountId: string;
				targets: Array<{
					targetId: string;
					shotCount: number;
					targetQuadrant?: number;
				}>;
			}>;
		};

		// 验证基本参数
		if (!payload.attackerId || !payload.weaponAllocations || payload.weaponAllocations.length === 0) {
			this.connMgr.sendError(conn.id, "INVALID_ATTACK", "Invalid attack payload", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId!);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		// 获取攻击者
		const attacker = room.getShipToken(payload.attackerId);
		if (!attacker) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Attacker ship not found", msg.id);
			return;
		}

		// 导入验证和计算模块
		const { validateAttackAllocations } = require("../../core/engine/rules/targeting.js");
		const { calculateWeaponAttack } = require("../../core/engine/rules/weapon.js");
		const { setWeaponFired } = require("../../core/engine/rules/weapon.js");
		const { isShieldHit, calculateShieldFlux } = require("../../core/engine/modules/shield.js");

		// 验证攻击分配
		const validation = validateAttackAllocations(attacker, payload.weaponAllocations);
		if (!validation.valid) {
			this.connMgr.send(conn.id, {
				type: MsgType.GAME_COMMAND_RESULT,
				payload: {
					success: false,
					command: MsgType.GAME_ATTACK,
					error: {
						code: "ATTACK_VALIDATION_FAILED",
						message: validation.errors.join("; "),
					},
				},
				...(msg.id ? { id: msg.id } : {}),
			});
			return;
		}

		// 执行攻击
		const attackResults: Array<{
			mountId: string;
			targetId: string;
			hit: boolean;
			damage: number;
			shieldHit: boolean;
			shieldDamage?: number;
			armorHit: boolean;
			armorQuadrant?: number;
			targetDestroyed: boolean;
			fluxGenerated: number;
		}> = [];

		// 收集需要更新的状态
		const updatedWeapons = [...(attacker.runtime.weapons || [])];
		const targetUpdates = new Map<string, any>();
		let totalDamage = 0;
		let attackerFluxGenerated = 0;

		for (const allocation of payload.weaponAllocations) {
			const weaponRuntime = updatedWeapons.find(w => w.mountId === allocation.mountId);
			if (!weaponRuntime || !weaponRuntime.weapon) continue;

			// 将武器设为已开火状态
			const weaponIdx = updatedWeapons.findIndex(w => w.mountId === allocation.mountId);
			if (weaponIdx >= 0) {
				updatedWeapons[weaponIdx] = setWeaponFired(updatedWeapons[weaponIdx]);
			}

			// 武器开火产生软辐能
			const weaponFluxCost = weaponRuntime.weapon.fluxCostPerShot || 0;
			attackerFluxGenerated += weaponFluxCost;

			// 对每个目标执行攻击
			for (const targetAlloc of allocation.targets) {
				const target = room.getShipToken(targetAlloc.targetId);
				if (!target || target.runtime.destroyed) continue;

				// 计算攻击
				const attackResult = calculateWeaponAttack(
					weaponRuntime.weapon,
					weaponRuntime,
					attacker.shipJson.ship,
					attacker.runtime,
					target.shipJson.ship,
					target.runtime,
					attacker.runtime.position,
					target.runtime.position,
					targetAlloc.targetQuadrant
				);

				// 检查护盾命中
				const shieldCheck = isShieldHit(target, attacker.runtime.position);
				let actualDamage = attackResult.damage;
				let shieldDamage = 0;
				let targetFluxGenerated = 0;

				if (shieldCheck.hit && attackResult.hit && attackResult.damage > 0) {
					// 计算护盾伤害
					const shieldSpec = target.shipJson.ship.shield;
					if (shieldSpec) {
						const efficiency = shieldSpec.efficiency || 1.0;
						shieldDamage = attackResult.damage * efficiency;
						targetFluxGenerated = calculateShieldFlux(attackResult.damage, efficiency);
						actualDamage = 0; // 护盾完全吸收
					}
				}

				attackResults.push({
					mountId: allocation.mountId,
					targetId: targetAlloc.targetId,
					hit: attackResult.hit,
					damage: actualDamage,
					shieldHit: shieldCheck.hit,
					shieldDamage,
					armorHit: attackResult.armorHit,
					armorQuadrant: attackResult.armorQuadrant,
					targetDestroyed: attackResult.targetDestroyed,
					fluxGenerated: targetFluxGenerated,
				});

				if (attackResult.hit && (actualDamage > 0 || shieldDamage > 0)) {
					totalDamage += actualDamage;

					// 收集目标状态更新
					if (!targetUpdates.has(targetAlloc.targetId)) {
						targetUpdates.set(targetAlloc.targetId, {
							hull: target.runtime.hull,
							armor: [...target.runtime.armor],
							fluxSoft: target.runtime.fluxSoft || 0,
							fluxHard: target.runtime.fluxHard || 0,
							destroyed: target.runtime.destroyed,
							overloaded: target.runtime.overloaded,
							shield: target.runtime.shield ? { ...target.runtime.shield } : undefined,
						});
					}

					const updates = targetUpdates.get(targetAlloc.targetId);

					// 应用护盾伤害
					if (shieldDamage > 0 && updates.shield) {
						updates.shield.value = Math.max(0, updates.shield.value - shieldDamage);
						if (updates.shield.value <= 0) {
							updates.shield.active = false;
						}
					}

					// 应用结构伤害（如果穿透护盾）
					if (actualDamage > 0) {
						updates.hull = Math.max(0, updates.hull - actualDamage);
						if (updates.hull <= 0) {
							updates.destroyed = true;
						}
					}

					// 更新护甲
					if (attackResult.armorHit && attackResult.armorQuadrant >= 0) {
						const armorDamage = actualDamage * 0.5;
						updates.armor[attackResult.armorQuadrant] = Math.max(
							0,
							updates.armor[attackResult.armorQuadrant] - armorDamage
						);
					}

					// 更新辐能（护盾命中产生硬辐能）
					if (targetFluxGenerated > 0) {
						updates.fluxHard += targetFluxGenerated;
					}

					// 检查过载
					const totalFlux = updates.fluxSoft + updates.fluxHard;
					const fluxCapacity = target.shipJson.ship.fluxCapacity || 100;
					if (totalFlux > fluxCapacity && !updates.overloaded) {
						updates.overloaded = true;
					}
				}
			}
		}

		// 应用攻击者武器状态更新和辐能
		const { addSoftFlux } = require("../../core/engine/modules/flux.js");
		const attackerFluxResult = addSoftFlux(attacker, attackerFluxGenerated);
		
		room.updateShipTokenRuntime(payload.attackerId, {
			weapons: updatedWeapons,
			hasFired: true,
			fluxSoft: attackerFluxResult.newFluxSoft,
			overloaded: attackerFluxResult.newFluxSoft + (attacker.runtime.fluxHard || 0) >= (attacker.shipJson.ship.fluxCapacity || 100),
		});

		// 应用目标状态更新
		for (const [targetId, updates] of targetUpdates) {
			room.updateShipTokenRuntime(targetId, updates);
		}

		// 发送成功响应
		this.connMgr.send(conn.id, {
			type: MsgType.GAME_COMMAND_RESULT,
			payload: {
				success: true,
				command: MsgType.GAME_ATTACK,
				data: {
					attackerId: payload.attackerId,
					results: attackResults,
					totalDamage,
					weaponCount: payload.weaponAllocations.length,
				},
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播攻击事件给房间内所有玩家
		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "attack_executed",
				data: {
					attackerId: payload.attackerId,
					results: attackResults,
					totalDamage,
					targetUpdates: Array.from(targetUpdates.entries()).map(([id, u]) => ({ targetId: id, ...u })),
				},
			},
		}, conn.id);
	};

	/**
	 * 处理数据修改指令
	 */
	private handleDataUpdate = (conn: Connection, msg: WSMessage): void => {
		if (!conn.roomId) {
			this.connMgr.sendError(conn.id, "NOT_IN_ROOM", "Not in any room", msg.id);
			return;
		}

		const payload = msg.payload as {
			objectType?: string;
			objectId?: string;
			updates?: Record<string, unknown>;
		};

		if (!payload.objectType || !payload.objectId || !payload.updates) {
			this.connMgr.sendError(conn.id, "INVALID_DATA", "Missing objectType, objectId or updates", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		// 获取玩家信息
		const stateManager = room.getStateManager();
		const player = stateManager.getPlayer(conn.id) || stateManager.getPlayer(conn.userId || "");
		if (!player) {
			this.connMgr.sendError(conn.id, "PLAYER_NOT_FOUND", "Player not found", msg.id);
			return;
		}

		// 导入权限和数据服务
		const { checkPermission, validateUpdate, applyShipUpdate, applyPlayerUpdate, createLogEntry } =
			require("../../services/DataUpdateService.js");

		// 权限检查
		let objectOwnerId: string | undefined;
		if (payload.objectType === "ship" || payload.objectType === "token") {
			const ship = room.getShipToken(payload.objectId);
			objectOwnerId = ship?.runtime?.ownerId;
		}

		const permission = checkPermission(player, payload.objectType, payload.objectId, objectOwnerId);
		if (!permission.allowed) {
			this.connMgr.sendError(conn.id, "FORBIDDEN", permission.reason || "Permission denied", msg.id);
			return;
		}

		// 验证更新
		const validation = validateUpdate(payload.objectType, payload.updates, permission.isDM);
		if (!validation.valid) {
			this.connMgr.sendError(conn.id, "INVALID_UPDATE", validation.error || "Invalid updates", msg.id);
			return;
		}

		// 应用更新
		let result: any;
		if (payload.objectType === "ship" || payload.objectType === "token") {
			const ship = room.getShipToken(payload.objectId);
			if (!ship) {
				this.connMgr.sendError(conn.id, "OBJECT_NOT_FOUND", "Ship not found", msg.id);
				return;
			}
			result = applyShipUpdate(ship, validation.filteredUpdates);
			// 应用状态更新到房间
			room.updateShipTokenRuntime(payload.objectId, ship.runtime as unknown as Record<string, unknown>);
		} else if (payload.objectType === "player") {
			const targetPlayer = stateManager.getPlayer(payload.objectId);
			if (!targetPlayer) {
				this.connMgr.sendError(conn.id, "OBJECT_NOT_FOUND", "Player not found", msg.id);
				return;
			}
			result = applyPlayerUpdate(targetPlayer, validation.filteredUpdates);
		} else {
			this.connMgr.sendError(conn.id, "UNSUPPORTED_TYPE", `Unsupported object type: ${payload.objectType}`, msg.id);
			return;
		}

		if (!result.success) {
			this.connMgr.sendError(conn.id, "UPDATE_FAILED", result.error || "Update failed", msg.id);
			return;
		}

		// 发送成功响应
		this.connMgr.send(conn.id, {
			type: MsgType.DATA_UPDATE_RESULT,
			payload: {
				success: true,
				objectType: payload.objectType,
				objectId: payload.objectId,
				changes: result.changes.map((c: any) => ({
					path: c.path,
					oldValue: c.oldValue,
					newValue: c.newValue,
				})),
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播变更给所有玩家（包括发起者，用于确认）
		const objectName = payload.objectType === "ship" || payload.objectType === "token"
			? room.getShipToken(payload.objectId)?.metadata?.name || payload.objectId
			: payload.objectId;

		const logEntry = createLogEntry(
			player.name,
			player.role,
			payload.objectType,
			payload.objectId,
			objectName,
			result.changes
		);

		this.connMgr.broadcastToRoom(conn.roomId, {
			type: MsgType.DATA_CHANGES,
			payload: {
				source: player.name,
				role: player.role,
				objectType: payload.objectType,
				objectId: payload.objectId,
				objectName,
				changes: result.changes.map((c: any) => ({
					path: c.path,
					oldValue: c.oldValue,
					newValue: c.newValue,
					description: `${c.path}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`,
				})),
				timestamp: Date.now(),
				logEntry,
			},
		});
	};

	/**
	 * 处理数据创建指令（DM 专用）
	 */
	private handleDataCreate = (conn: Connection, msg: WSMessage): void => {
		if (!conn.roomId) {
			this.connMgr.sendError(conn.id, "NOT_IN_ROOM", "Not in any room", msg.id);
			return;
		}

		const payload = msg.payload as {
			objectType?: string;
			data?: Record<string, unknown>;
			position?: { x: number; y: number };
			faction?: string;
			ownerId?: string;
		};

		if (!payload.objectType || !payload.data) {
			this.connMgr.sendError(conn.id, "INVALID_DATA", "Missing objectType or data", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		// 获取玩家信息
		const stateManager = room.getStateManager();
		const player = stateManager.getPlayer(conn.id) || stateManager.getPlayer(conn.userId || "");
		if (!player) {
			this.connMgr.sendError(conn.id, "PLAYER_NOT_FOUND", "Player not found", msg.id);
			return;
		}

		// 只有 DM 可以创建对象
		if (player.role !== "DM") {
			this.connMgr.sendError(conn.id, "FORBIDDEN", "Only DM can create objects", msg.id);
			return;
		}

		// TODO: 实现对象创建逻辑
		// 这里需要根据 objectType 创建不同的对象
		this.connMgr.send(conn.id, {
			type: MsgType.DATA_CREATE,
			payload: {
				success: false,
				error: "Object creation not yet implemented",
			},
			...(msg.id ? { id: msg.id } : {}),
		});
	};

	/**
	 * 处理数据删除指令（DM 专用）
	 */
	private handleDataDelete = (conn: Connection, msg: WSMessage): void => {
		if (!conn.roomId) {
			this.connMgr.sendError(conn.id, "NOT_IN_ROOM", "Not in any room", msg.id);
			return;
		}

		const payload = msg.payload as {
			objectType?: string;
			objectId?: string;
		};

		if (!payload.objectType || !payload.objectId) {
			this.connMgr.sendError(conn.id, "INVALID_DATA", "Missing objectType or objectId", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		// 获取玩家信息
		const stateManager = room.getStateManager();
		const player = stateManager.getPlayer(conn.id) || stateManager.getPlayer(conn.userId || "");
		if (!player) {
			this.connMgr.sendError(conn.id, "PLAYER_NOT_FOUND", "Player not found", msg.id);
			return;
		}

		// 只有 DM 可以删除对象（或玩家删除自己的对象）
		if (player.role !== "DM") {
			this.connMgr.sendError(conn.id, "FORBIDDEN", "Only DM can delete objects", msg.id);
			return;
		}

		// TODO: 实现对象删除逻辑
		this.connMgr.send(conn.id, {
			type: MsgType.DATA_DELETE,
			payload: {
				success: false,
				error: "Object deletion not yet implemented",
			},
			...(msg.id ? { id: msg.id } : {}),
		});
	};

	/**
	 * 处理移动指令
	 */
	private handleMoveCommand = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as {
			shipId?: string;
			forwardDistance?: number;
			strafeDistance?: number;
		};

		if (!payload.shipId) {
			this.connMgr.sendError(conn.id, "INVALID_MOVE", "Ship ID required", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId!);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		const ship = room.getShipToken(payload.shipId);
		if (!ship) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Ship not found", msg.id);
			return;
		}

		const { validateMovement } = require("../../core/engine/modules/movement.js");
		const validation = validateMovement(
			ship,
			payload.forwardDistance || 0,
			payload.strafeDistance || 0
		);

		if (!validation.valid) {
			this.connMgr.sendError(conn.id, "INVALID_MOVE", validation.error || "Invalid move", msg.id);
			return;
		}

		// 执行移动
		const { processMovement } = require("../../core/engine/modules/movement.js");
		const result = processMovement(ship, payload);

		// 更新状态
		room.updateShipTokenRuntime(payload.shipId, {
			position: result.newPosition,
			movement: result.newMovementState,
		});

		this.connMgr.send(conn.id, {
			type: MsgType.GAME_COMMAND_RESULT,
			payload: {
				success: true,
				command: MsgType.GAME_MOVE,
				data: {
					shipId: payload.shipId,
					newPosition: result.newPosition,
					movement: result.newMovementState,
				},
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播移动事件
		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "ship_moved",
				data: {
					shipId: payload.shipId,
					newPosition: result.newPosition,
					forwardDistance: payload.forwardDistance || 0,
					strafeDistance: payload.strafeDistance || 0,
				},
			},
		}, conn.id);
	};

	/**
	 * 处理旋转指令
	 */
	private handleRotateCommand = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as {
			shipId?: string;
			angle?: number;
		};

		if (!payload.shipId || payload.angle === undefined) {
			this.connMgr.sendError(conn.id, "INVALID_ROTATE", "Ship ID and angle required", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId!);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		const ship = room.getShipToken(payload.shipId);
		if (!ship) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Ship not found", msg.id);
			return;
		}

		const { validateRotation } = require("../../core/engine/modules/movement.js");
		const validation = validateRotation(ship, payload.angle);

		if (!validation.valid) {
			this.connMgr.sendError(conn.id, "INVALID_ROTATE", validation.error || "Invalid rotation", msg.id);
			return;
		}

		// 执行旋转
		const { processRotation } = require("../../core/engine/modules/movement.js");
		const result = processRotation(ship, payload);

		// 更新状态
		room.updateShipTokenRuntime(payload.shipId, {
			heading: result.newHeading,
			movement: result.newMovementState,
		});

		this.connMgr.send(conn.id, {
			type: MsgType.GAME_COMMAND_RESULT,
			payload: {
				success: true,
				command: MsgType.GAME_ROTATE,
				data: {
					shipId: payload.shipId,
					newHeading: result.newHeading,
					angle: payload.angle,
				},
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播旋转事件
		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "ship_rotated",
				data: {
					shipId: payload.shipId,
					newHeading: result.newHeading,
					angle: payload.angle,
				},
			},
		}, conn.id);
	};

	/**
	 * 处理阶段推进指令
	 */
	private handleAdvancePhaseCommand = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as {
			shipId?: string;
		};

		if (!payload.shipId) {
			this.connMgr.sendError(conn.id, "INVALID_PHASE", "Ship ID required", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId!);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		const ship = room.getShipToken(payload.shipId);
		if (!ship) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Ship not found", msg.id);
			return;
		}

		const { validatePhaseAdvance, advancePhase } = require("../../core/engine/modules/movement.js");
		const validation = validatePhaseAdvance(ship);

		if (!validation.valid) {
			this.connMgr.sendError(conn.id, "INVALID_PHASE", validation.error || "Cannot advance phase", msg.id);
			return;
		}

		// 执行阶段推进
		const result = advancePhase(ship);

		// 更新状态
		room.updateShipTokenRuntime(payload.shipId, {
			movement: result.newMovementState,
		});

		this.connMgr.send(conn.id, {
			type: MsgType.GAME_PHASE_ADVANCED,
			payload: {
				success: true,
				shipId: payload.shipId,
				fromPhase: result.fromPhase,
				toPhase: result.toPhase,
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播阶段推进事件
		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "phase_advanced",
				data: {
					shipId: payload.shipId,
					fromPhase: result.fromPhase,
					toPhase: result.toPhase,
				},
			},
		}, conn.id);
	};

	/**
	 * 处理护盾切换指令
	 */
	private handleToggleShieldCommand = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as {
			shipId?: string;
			active?: boolean;
		};

		if (!payload.shipId) {
			this.connMgr.sendError(conn.id, "INVALID_SHIELD", "Ship ID required", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId!);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		const ship = room.getShipToken(payload.shipId);
		if (!ship) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Ship not found", msg.id);
			return;
		}

		// 检查舰船是否有护盾
		if (!ship.shipJson.ship.shield) {
			this.connMgr.sendError(conn.id, "NO_SHIELD", "Ship has no shield", msg.id);
			return;
		}

		// 检查过载状态
		if (ship.runtime.overloaded) {
			this.connMgr.sendError(conn.id, "OVERLOADED", "Cannot toggle shield while overloaded", msg.id);
			return;
		}

		// 检查是否已开火
		if (ship.runtime.hasFired) {
			this.connMgr.sendError(conn.id, "ALREADY_FIRED", "Cannot toggle shield after firing weapons", msg.id);
			return;
		}

		const { toggleShield } = require("../../core/engine/modules/shield.js");
		const result = toggleShield(ship, payload.active);

		if (!result.success) {
			this.connMgr.sendError(conn.id, "SHIELD_ERROR", result.reason || "Failed to toggle shield", msg.id);
			return;
		}

		// 更新状态
		room.updateShipTokenRuntime(payload.shipId, {
			shield: result.newShieldState,
		});

		this.connMgr.send(conn.id, {
			type: MsgType.GAME_COMMAND_RESULT,
			payload: {
				success: true,
				command: MsgType.GAME_TOGGLE_SHIELD,
				data: {
					shipId: payload.shipId,
					shieldActive: result.newShieldState.active,
					shieldValue: result.newShieldState.value,
				},
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播护盾切换事件
		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "shield_toggled",
				data: {
					shipId: payload.shipId,
					shieldActive: result.newShieldState.active,
					shieldValue: result.newShieldState.value,
				},
			},
		}, conn.id);
	};

	/**
	 * 处理主动排散指令
	 */
	private handleVentFluxCommand = (conn: Connection, msg: WSMessage): void => {
		const payload = msg.payload as {
			shipId?: string;
		};

		if (!payload.shipId) {
			this.connMgr.sendError(conn.id, "INVALID_VENT", "Ship ID required", msg.id);
			return;
		}

		const room = this.roomMgr.getRoom(conn.roomId!);
		if (!room) {
			this.connMgr.sendError(conn.id, "ROOM_NOT_FOUND", "Room not found", msg.id);
			return;
		}

		const ship = room.getShipToken(payload.shipId);
		if (!ship) {
			this.connMgr.sendError(conn.id, "SHIP_NOT_FOUND", "Ship not found", msg.id);
			return;
		}

		const { ventFlux } = require("../../core/engine/modules/flux.js");
		const result = ventFlux(ship);

		if (!result.success) {
			this.connMgr.sendError(conn.id, "VENT_ERROR", result.reason || "Failed to vent flux", msg.id);
			return;
		}

		// 更新状态
		room.updateShipTokenRuntime(payload.shipId, {
			fluxSoft: 0,
			fluxHard: 0,
			venting: true,
			overloaded: false,
			overloadTime: 0,
			shield: ship.runtime.shield ? { ...ship.runtime.shield, active: false } : undefined,
		});

		this.connMgr.send(conn.id, {
			type: MsgType.GAME_COMMAND_RESULT,
			payload: {
				success: true,
				command: MsgType.GAME_VENT_FLUX,
				data: {
					shipId: payload.shipId,
					fluxCleared: result.fluxCleared,
				},
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		// 广播排散事件
		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "flux_vented",
				data: {
					shipId: payload.shipId,
					fluxCleared: result.fluxCleared,
				},
			},
		}, conn.id);
	};

	/**
	 * 处理通用游戏命令（占位）
	 */
	private handleGenericCommand = (conn: Connection, msg: WSMessage): void => {
		this.connMgr.send(conn.id, {
			type: MsgType.GAME_COMMAND_RESULT,
			payload: {
				success: true,
				command: msg.type,
			},
			...(msg.id ? { id: msg.id } : {}),
		});

		this.connMgr.broadcastToRoom(conn.roomId!, {
			type: MsgType.EVENT,
			payload: {
				eventType: "game_command",
				data: {
					playerId: conn.id,
					command: msg.type,
					params: msg.payload,
				},
			},
		}, conn.id);
	};
}
