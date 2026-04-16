/**
 * 战斗房间
 *
 * 使用 services 层处理业务逻辑
 */

import { Client, matchMaker, Room } from "@colyseus/core";
import { Faction, GamePhase, PlayerRole, WeaponState } from "../schema/types.js";
import type { RoomMetadata } from "../schema/types.js";
import type { CreateObjectPayload, MoveTokenPayload } from "../commands/types.js";
import { CommandDispatcher } from "../commands/CommandDispatcher.js";
import { GameService } from "../services/GameService.js";
import { PlayerService } from "../services/PlayerService.js";
import { saveService } from "../services/SaveService.js";
import {
	toErrorDto,
	toGameLoadedDto,
	toGameSavedDto,
	toIdentityDto,
	toRoleDto,
} from "../dto/index.js";
import { createAsteroid, createShip, createStation } from "../factory/ShipFactory.js";
import { registerMessageHandlers } from "../handlers/BattleRoomHandlers.js";
import { GameRoomState, PlayerState } from "../schema/GameSchema.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";

export class BattleRoom extends Room<{ state: GameRoomState; metadata: RoomMetadata }> {
	maxClients = 8;
	autoDispose = false;

	private gameService!: GameService;
	private playerService!: PlayerService;
	private dispatcher!: CommandDispatcher;
	private pingEwma = new Map<string, number>();
	private jitterEwma = new Map<string, number>();
	private roomOwnerId: string | null = null;
	private moveCommandBuffer = new Map<string, { client: Client; payload: MoveTokenPayload }>();
	private roomDisplayName = "";
	private createdAt = Date.now();
	private emptyDisposeTimeout: ReturnType<typeof setTimeout> | null = null;

	private static readonly EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

	async onCreate(options: { roomName?: string; maxPlayers?: number }) {
		this.maxClients = Math.min(16, Math.max(2, options.maxPlayers ?? 8));
		this.roomDisplayName = options.roomName?.trim() || `Battle-${this.roomId.substring(0, 6)}`;
		this.createdAt = Date.now();

		this.state = new GameRoomState();
		this.dispatcher = new CommandDispatcher(this.state);
		this.gameService = new GameService(this.state);
		this.playerService = new PlayerService();

		registerMessageHandlers(this, {
			state: this.state,
			dispatcher: this.dispatcher,
			logger: { log: () => {} },
			broadcast: (t, d) => this.broadcast(t, d),
			pingEwma: this.pingEwma,
			jitterEwma: this.jitterEwma,
			getRoomOwnerId: () => this.roomOwnerId,
			setMetadata: () => this.syncMetadata(),
			profileStore: new Map(),
			createObject: (payload: CreateObjectPayload) => this.createObject(payload),
			enqueueMoveCommand: (client: Client, payload: MoveTokenPayload) =>
				this.enqueueMoveCommand(client, payload),
			dissolveRoom: () => this.disconnect(),
		});

		this.syncMetadata();
		this.setSimulationInterval((dt) => this.update(dt / 1000), 50);
	}

	async onJoin(client: Client, options: { playerName?: string }) {
		this.cancelEmptyDisposeTimer();

		const name = options.playerName?.trim() || `Player-${client.sessionId.substring(0, 4)}`;
		const isFirstClient = this.clients.length === 1;

		// 房间已满检查
		if (!isFirstClient && this.clients.length >= this.maxClients) {
			client.send("error", { message: "房间已满，无法加入" });
			setTimeout(() => client.leave(), 200);
			return;
		}

		// 创建玩家状态
		const player = new PlayerState();
		player.sessionId = client.sessionId;
		player.name = name;
		player.connected = true;
		player.role = isFirstClient ? PlayerRole.DM : PlayerRole.PLAYER;

		if (player.role === PlayerRole.DM) {
			this.roomOwnerId = client.sessionId;
		}

		// 注册玩家档案（后端分配 shortId）
		const { profile } = this.playerService.registerPlayer(client, this.state, { playerName: name });
		player.shortId = profile.shortId;

		// 房主重复检查（基于刚分配的 shortId）
		if (isFirstClient) {
			const existingRooms = await matchMaker.query({ name: "battle" });
			const alreadyOwnsActiveRoom = existingRooms.some((r) => {
				if (r.roomId === this.roomId) return false;
				const meta = (r.metadata as Record<string, unknown> | undefined) || {};
				const shortIdMatch = Number(meta.ownerShortId) === profile.shortId;
				const hasActiveClients = Number(r.clients) > 0;
				return shortIdMatch && hasActiveClients;
			});

			if (alreadyOwnsActiveRoom) {
				client.send("error", { message: "您已在其他房间担任房主" });
				setTimeout(() => this.disconnect(), 200);
				return;
			}
		}

		client.send("role", toRoleDto(player.role));
		client.send("identity", toIdentityDto(name, profile.shortId));
		this.state.players.set(client.sessionId, player);
		this.pingEwma.set(client.sessionId, -1);
		this.syncMetadata();
	}

	onLeave(client: Client, code?: number) {
		const player = this.state.players.get(client.sessionId);

		if (code === 1000) {
			this.state.players.delete(client.sessionId);
			this.playerService.handleDisconnect(client.sessionId);
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
					this.playerService.handleDisconnect(client.sessionId);
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
		for (const cmd of commands) {
			try {
				this.dispatcher.dispatchMoveToken(cmd.client, cmd.payload);
			} catch (error) {
				cmd.client.send("error", toErrorDto((error as Error).message));
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
					w.state = w.currentAmmo === 0 && w.maxAmmo > 0 ? WeaponState.OUT_OF_AMMO : WeaponState.READY;
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

	private scheduleEmptyDisposeIfNeeded(): void {
		if (this.clients.length > 0) return;
		if (this.emptyDisposeTimeout) return;

		this.emptyDisposeTimeout = setTimeout(() => {
			if (this.clients.length === 0) this.disconnect();
			this.emptyDisposeTimeout = null;
		}, BattleRoom.EMPTY_ROOM_TTL_MS);
	}

	private cancelEmptyDisposeTimer(): void {
		if (this.emptyDisposeTimeout) {
			clearTimeout(this.emptyDisposeTimeout);
			this.emptyDisposeTimeout = null;
		}
	}

	private assignOwner() {
		if (!this.state.players.has(this.roomOwnerId ?? "")) {
			const next = Array.from(this.state.players.values()).find((p) => p.connected);
			this.roomOwnerId = next?.sessionId ?? null;
			this.state.players.forEach((p: PlayerState) => {
				p.role = p.sessionId === this.roomOwnerId ? PlayerRole.DM : PlayerRole.PLAYER;
			});
		}
	}

	private getOwnerProfile(): { sessionId: string; shortId: number } | null {
		if (!this.roomOwnerId) return null;
		const owner = this.state.players.get(this.roomOwnerId);
		return owner ? { sessionId: owner.sessionId, shortId: owner.shortId } : null;
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
		const saveId = await saveService.saveGame(this.state, this.roomId, name);
		this.broadcast("game_saved", toGameSavedDto(saveId, name));
		return saveId;
	}

	async loadGame(id: string): Promise<boolean> {
		try {
			const success = await saveService.loadGame(this.state, id);
			if (success) {
				const save = await saveService.exportSave(id);
				this.broadcast("game_loaded", toGameLoadedDto(id, save.name));
				this.syncMetadata();
			}
			return success;
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
			if (p.name) ship.name = p.name;
			this.state.ships.set(ship.id, ship);
		}
	}
}