/**
 * 战斗房间
 */

import { Client, Room } from "@colyseus/core";
import type { CreateObjectPayload, FactionValue, RoomMetadata } from "@vt/types";
import { Faction, GamePhase, PlayerRole } from "@vt/types";
import { CommandDispatcher } from "../commands/CommandDispatcher.js";
import { toGameLoadedDto, toGameSavedDto, toIdentityDto, toRoleDto, toShipCreatedDto } from "../dto/index.js";
import { createAsteroid, createShip, createStation } from "../factory/ShipFactory.js";
import { registerMessageHandlers } from "../handlers/BattleRoomHandlers.js";
import { deserializeShipSave, serializeGameSave } from "../schema/GameSave.js";
import { ChatMessage, GameRoomState, PlayerState } from "../schema/GameSchema.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";
import { saveStore } from "../services/SaveStore.js";
import { RoomEventLogger } from "../utils/ColyseusMessaging.js";

export class BattleRoom extends Room<{ state: GameRoomState; metadata: RoomMetadata }> {
	maxClients = 8;
	private dispatcher!: CommandDispatcher;
	private logger!: RoomEventLogger;
	private pingEwma = new Map<string, number>();
	private jitterEwma = new Map<string, number>();
	private roomOwnerId: string | null = null;
	private roomDisplayName = "";
	private profileStore = new Map<number, { nickname: string; avatar: string }>();
	private createdAt = Date.now();

	onCreate(options: { roomName?: string; maxPlayers?: number }) {
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
		});

		this.syncMetadata();
		this.setSimulationInterval((dt) => this.update(dt / 1000), 50);
	}

	onJoin(client: Client, options: { playerName?: string; shortId?: number }) {
		const name = options.playerName?.trim() || `Player-${client.sessionId.substring(0, 4)}`;
		const shortId = options.shortId ?? Math.floor(100000 + Math.random() * 900000);

		const player = new PlayerState();
		player.sessionId = client.sessionId;
		player.shortId = shortId;
		player.name = name;
		player.connected = true;
		player.role = this.clients.length === 1 ? PlayerRole.DM : PlayerRole.PLAYER;

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
				});
		}
	}

	private update(dt: number) {
		this.state.ships.forEach((ship: ShipState) => {
			if (ship.isDestroyed) return;
			ship.weapons.forEach((w: WeaponSlot) => {
				w.cooldownRemaining = Math.max(0, w.cooldownRemaining - dt);
			});
			if (ship.isOverloaded && ship.overloadTime > 0) {
				ship.overloadTime -= dt;
				if (ship.overloadTime <= 0) ship.isOverloaded = false;
			}
			ship.flux.dissipate(dt);
			if (ship.isOverloaded && !ship.flux.isOverloaded) ship.isOverloaded = false;
		});
	}

	onDispose() {}

	private assignOwner() {
		if (!this.state.players.has(this.roomOwnerId ?? "")) {
			const next = Array.from(
				this.state.players.values() as IterableIterator<PlayerState>
			).find((p) => p.connected);
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
					: createAsteroid(p.x, p.y);
		if (ship) {
			ship.faction = faction;
			this.state.ships.set(ship.id, ship);
			this.broadcast(
				"ship_created",
				toShipCreatedDto(ship.id, p.hullId ?? p.type, p.x, p.y)
			);
		}
	}
}
