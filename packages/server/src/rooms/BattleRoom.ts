/**
 * 战斗房间
 */

import { Client, matchMaker, Room } from "@colyseus/core";
import {
	Faction,
	GamePhase,
	PlayerRole,
	WeaponState,
} from "../schema/types.js";
import type { CreateObjectPayload, MoveTokenPayload, RoomMetadata } from "../schema/types.js";
import { CommandDispatcher } from "../commands/CommandDispatcher.js";
import {
	toErrorDto,
	toGameLoadedDto,
	toGameSavedDto,
	toIdentityDto,
	toRoleDto,
} from "../dto/index.js";
import { createAsteroid, createShip, createStation } from "../factory/ShipFactory.js";
import { registerMessageHandlers } from "../handlers/BattleRoomHandlers.js";
import { deserializeShipSave, serializeGameSave } from "../schema/GameSave.js";
import { ChatMessage, GameRoomState, PlayerState } from "../schema/GameSchema.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";
import { saveStore } from "../services/SaveStore.js";
import { RoomEventLogger } from "../utils/ColyseusMessaging.js";

export class BattleRoom extends Room<{ state: GameRoomState; metadata: RoomMetadata }> {
	maxClients = 8;
	autoDispose = false;
	private dispatcher!: CommandDispatcher;
	private logger!: RoomEventLogger;
	private pingEwma = new Map<string, number>();
	private jitterEwma = new Map<string, number>();
	private roomOwnerId: string | null = null;
	private moveCommandBuffer = new Map<string, { client: Client; payload: MoveTokenPayload }>();
	private roomDisplayName = "";
	private profileStore = new Map<number, { nickname: string; avatar: string }>();
	private createdAt = Date.now();
	/** 房间空置时的自动销毁定时器（10 分钟） */
	private emptyDisposeTimeout: ReturnType<typeof setTimeout> | null = null;
	private static readonly EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

	async onCreate(options: { roomName?: string; maxPlayers?: number }) {
		this.maxClients = Math.min(16, Math.max(2, options.maxPlayers ?? 8));
		this.roomDisplayName = options.roomName?.trim() || `Battle-${this.roomId.substring(0, 6)}`;
		this.createdAt = Date.now();
		this.state = new GameRoomState();
		this.dispatcher = new CommandDispatcher(this.state);
		this.logger = new RoomEventLogger(this.state);

		registerMessageHandlers(this, {
			state: this.state,
			dispatcher: this.dispatcher,
			logger: this.logger,
			broadcast: (t, d) => this.broadcast(t, d),
			pingEwma: this.pingEwma,
			jitterEwma: this.jitterEwma,
			getRoomOwnerId: () => this.roomOwnerId,
			setMetadata: () => this.syncMetadata(),
			profileStore: this.profileStore,
			createObject: (payload: CreateObjectPayload) => this.createObject(payload),
			enqueueMoveCommand: (client: Client, payload: MoveTokenPayload) =>
				this.enqueueMoveCommand(client, payload),
			dissolveRoom: () => this.disconnect(),
		});

		this.syncMetadata();
		this.setSimulationInterval((dt) => this.update(dt / 1000), 50);
	}

	async onJoin(client: Client, options: { playerName?: string; shortId?: number }) {
		// 有人加入，取消空置销毁定时器
		this.cancelEmptyDisposeTimer();

		const name = options.playerName?.trim() || `Player-${client.sessionId.substring(0, 4)}`;
		const shortId = options.shortId ?? Math.floor(100000 + Math.random() * 900000);
		const isFirstClient = this.clients.length === 1;

		// 🔑 检查房间是否已满（加入前检查）
		if (!isFirstClient && this.clients.length >= this.maxClients) {
			console.log("[BattleRoom] Room is full, rejecting:", this.roomId);
			client.send("error", {
				message: "房间已满，无法加入"
			});
			setTimeout(() => {
				client.leave();
			}, 200);
			return;
		}

		// 第一个加入的客户端会成为房主（DM）
		if (isFirstClient) {
			// 🔑 后端权威检查：检查用户是否已经拥有其他房间（且房主仍在房间内）
			const existingRooms = await matchMaker.query({ name: "battle" });
			const alreadyOwnsActiveRoom = existingRooms.some((r) => {
				if (r.roomId === this.roomId) return false; // 排除当前房间
				const meta = (r.metadata as Record<string, unknown> | undefined) || {};
				// 检查 shortId 匹配 AND 房间内有人（房主仍在线）
				const shortIdMatch = Number(meta.ownerShortId) === shortId;
				const hasActiveClients = Number(r.clients) > 0;
				return shortIdMatch && hasActiveClients;
			});

			if (alreadyOwnsActiveRoom) {
				// 🔑 验证失败：用户在其他房间中仍是活跃房主
				console.log("[BattleRoom] Rejecting creator, already owns active room:", shortId);
				client.send("error", {
					message: "您已在一个活跃房间中担任房主，请先离开或解散该房间后再创建新房间"
				});
				// 🔑 关键：延迟断开连接并销毁房间（因为是第一个客户端）
				setTimeout(() => {
					console.log("[BattleRoom] Destroying room due to duplicate owner:", this.roomId);
					this.disconnect(); // 销毁房间，而不仅仅是踢出用户
				}, 200);
				return; // 不再继续执行后续代码
			}

			// 验证通过，设置房主
			this.roomOwnerId = client.sessionId;
			console.log("[BattleRoom] Creator joined, room owner set:", client.sessionId);
		}

		// 🔑 只有验证通过后才添加玩家状态
		const player = new PlayerState();
		player.sessionId = client.sessionId;
		player.shortId = shortId;
		player.name = name;
		player.connected = true;
		player.role = isFirstClient ? PlayerRole.DM : PlayerRole.PLAYER;

		if (player.role === PlayerRole.DM) this.roomOwnerId = client.sessionId;

		client.send("role", toRoleDto(player.role));
		client.send("identity", toIdentityDto(name, shortId));
		this.state.players.set(client.sessionId, player);
		this.pingEwma.set(client.sessionId, -1);
		this.syncMetadata();
	}

	onLeave(client: Client, code?: number) {
		const player = this.state.players.get(client.sessionId);
		if (code === 1000) {
			this.state.players.delete(client.sessionId);
			this.assignOwner();
			this.syncMetadata();
			this.scheduleEmptyDisposeIfNeeded();
			return;
		}
		if (player) {
			player.connected = false;
			this.allowReconnection(client, 60)
				.then(() => {
					player.connected = true;
					this.syncMetadata();
				})
				.catch(() => {
					this.state.players.delete(client.sessionId);
					this.assignOwner();
					this.syncMetadata();
					this.scheduleEmptyDisposeIfNeeded();
				});
		}
	}

	private enqueueMoveCommand(client: Client, payload: MoveTokenPayload): void {
		this.moveCommandBuffer.set(payload.shipId, { client, payload });
	}

	private flushMoveCommands(): void {
		if (this.moveCommandBuffer.size === 0) return;
		const commands = Array.from(this.moveCommandBuffer.values());
		this.moveCommandBuffer.clear();
		for (const command of commands) {
			try {
				this.dispatcher.dispatchMoveToken(command.client, command.payload);
			} catch (error) {
				command.client.send("error", toErrorDto((error as Error).message));
			}
		}
	}

	private update(dt: number) {
		this.flushMoveCommands();
		this.state.ships.forEach((ship: ShipState) => {
			if (ship.isDestroyed) return;
			ship.weapons.forEach((w: WeaponSlot) => {
				w.cooldownRemaining = Math.max(0, w.cooldownRemaining - dt);
				if (w.state === WeaponState.COOLDOWN && w.cooldownRemaining <= 0) {
					w.state =
						w.currentAmmo === 0 && w.maxAmmo > 0 ? WeaponState.OUT_OF_AMMO : WeaponState.READY;
				}
			});
			if (ship.isOverloaded && ship.overloadTime > 0) {
				ship.overloadTime -= dt;
				if (ship.overloadTime <= 0) ship.isOverloaded = false;
			}
			ship.flux.dissipate(dt);
			if (ship.isOverloaded && !ship.flux.isOverloaded) ship.isOverloaded = false;
		});
	}

	onDispose() {
		this.cancelEmptyDisposeTimer();
	}

	/**
	 * 当房间为空时，启动 10 分钟自动销毁定时器。
	 * 如果在此期间有人加入，则取消定时器。
	 */
	private scheduleEmptyDisposeIfNeeded(): void {
		if (this.clients.length > 0) return;
		if (this.emptyDisposeTimeout) return;

		console.log(
			`[BattleRoom] Room ${this.roomId} is empty, scheduling dispose in ${BattleRoom.EMPTY_ROOM_TTL_MS / 1000}s`
		);

		this.emptyDisposeTimeout = setTimeout(() => {
			if (this.clients.length === 0) {
				console.log(`[BattleRoom] Room ${this.roomId} has been empty for 10 minutes, disposing`);
				this.disconnect();
			}
			this.emptyDisposeTimeout = null;
		}, BattleRoom.EMPTY_ROOM_TTL_MS);
	}

	private cancelEmptyDisposeTimer(): void {
		if (this.emptyDisposeTimeout) {
			clearTimeout(this.emptyDisposeTimeout);
			this.emptyDisposeTimeout = null;
			console.log(`[BattleRoom] Room ${this.roomId} empty dispose timer cancelled`);
		}
	}

	private assignOwner() {
		if (!this.state.players.has(this.roomOwnerId ?? "")) {
			const next = Array.from(this.state.players.values() as IterableIterator<PlayerState>).find(
				(p) => p.connected
			);
			this.roomOwnerId = next?.sessionId ?? null;
			this.state.players.forEach((p: PlayerState) => {
				p.role = p.sessionId === this.roomOwnerId ? PlayerRole.DM : PlayerRole.PLAYER;
			});
		}
	}

	private getOwnerProfile(): { sessionId: string; shortId: number } | null {
		if (!this.roomOwnerId) return null;
		const owner = this.state.players.get(this.roomOwnerId);
		if (!owner) return null;
		return { sessionId: owner.sessionId, shortId: owner.shortId };
	}

	private syncMetadata(): void {
		const owner = this.getOwnerProfile();
		const metadata: RoomMetadata = {
			roomType: "battle",
			name: this.roomDisplayName,
			phase: this.state.currentPhase,
			ownerId: owner?.sessionId ?? null,
			ownerShortId: owner?.shortId ?? null,
			maxPlayers: this.maxClients,
			isPrivate: false,
			createdAt: this.createdAt,
			turnCount: this.state.turnCount,
		};
		this.setMetadata(metadata);
	}

	async saveGame(name: string): Promise<string> {
		const save = serializeGameSave(
			this.state,
			this.roomId,
			this.roomDisplayName,
			this.maxClients,
			false,
			name
		);
		await saveStore.save(save);
		this.broadcast("game_saved", toGameSavedDto(save.saveId, name));
		return save.saveId;
	}

	async loadGame(id: string): Promise<boolean> {
		try {
			const save = await saveStore.load(id);
			const isEnumValue = <T extends Record<string, string>>(
				enumObj: T,
				value: unknown
			): value is T[keyof T] => Object.values(enumObj).includes(value as T[keyof T]);
			this.state.currentPhase = isEnumValue(GamePhase, save.currentPhase)
				? save.currentPhase
				: GamePhase.DEPLOYMENT;
			this.state.turnCount = save.turnCount;
			this.state.activeFaction = isEnumValue(Faction, save.activeFaction)
				? save.activeFaction
				: Faction.PLAYER;
			this.state.ships.clear();
			save.ships.forEach((s) => this.state.ships.set(s.id, deserializeShipSave(s)));
			this.state.chatMessages.clear();
			save.chatHistory.forEach((m) => {
				const msg = new ChatMessage();
				Object.assign(msg, m);
				this.state.chatMessages.push(msg);
			});
			this.broadcast("game_loaded", toGameLoadedDto(id, save.saveName));
			this.syncMetadata();
			return true;
		} catch {
			return false;
		}
	}

	createObject(p: CreateObjectPayload) {
		const heading = p.heading ?? 0;
		const faction = p.faction ?? Faction.PLAYER;
		const ship =
			p.type === "ship" && p.hullId
				? createShip(p.hullId, p.x, p.y, heading, faction, p.ownerId)
				: p.type === "station"
					? createStation(p.x, p.y, heading)
					: createAsteroid(p.x, p.y, heading);
		if (ship) {
			ship.faction = faction;
			if (p.name) {
				ship.name = p.name;
			}
			this.state.ships.set(ship.id, ship);
		}
	}
}