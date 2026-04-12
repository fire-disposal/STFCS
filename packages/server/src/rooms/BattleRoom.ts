/**
 * 战斗房间 - Colyseus 多人游戏房间
 *
 * 遵循 Colyseus 最佳实践：
 * - 使用泛型声明状态类型
 * - 实现 onAuth 进行认证
 * - 正确处理 onLeave 和重连
 * - 使用 setMetadata 更新房间元数据
 */

import { Client, Room } from "@colyseus/core";
import { getShipHullSpec, getWeaponSpec } from "@vt/rules";
import { CommandDispatcher } from "../commands/CommandDispatcher.js";
import {
	ArraySchema,
	ClientCommand,
	GamePhase,
	GameRoomState,
	PlayerState,
	ShipState,
	WeaponSlot,
} from "../schema/GameSchema.js";

// ==================== 消息 Payload 类型定义 ====================

interface NetPingPayload {
	seq: number;
	clientSentAt: number;
}

export interface MoveTokenPayload {
	shipId: string;
	x: number;
	y: number;
	heading: number;
	movementPlan?: {
		phaseAForward: number;
		phaseAStrafe: number;
		turnAngle: number;
		phaseBForward: number;
		phaseBStrafe: number;
	};
	phase?: 'PHASE_A' | 'ATTACK_1' | 'PHASE_B' | 'ATTACK_2' | 'PHASE_C';
}

export interface ToggleShieldPayload {
	shipId: string;
	isActive: boolean;
	orientation?: number;
}

export interface FireWeaponPayload {
	attackerId: string;
	weaponId: string;
	targetId: string;
}

export interface VentFluxPayload {
	shipId: string;
}

interface DMClearOverloadPayload {
	shipId: string;
}

interface DMSetArmorPayload {
	shipId: string;
	section: number;
	value: number;
}

interface CreateObjectPayload {
	type: "ship" | "station" | "asteroid";
	hullId?: string;
	x: number;
	y: number;
	heading: number;
	faction: "player" | "dm";
	ownerId?: string;
}

// ==================== 战斗房间类 ====================

export class BattleRoom extends Room<{ state: GameRoomState }> {
	maxClients = 8;
	private commandDispatcher!: CommandDispatcher;
	private pingEwma = new Map<string, number>();
	private jitterEwma = new Map<string, number>();
	private playerIdentity = new Map<string, { userName: string; shortId: number }>();
	private roomDisplayName = "";
	private roomOwnerId: string | null = null;
	private isPrivateRoom = false;

	/**
	 * 房间创建初始化
	 * Colyseus 在第一个客户端加入时自动调用
	 */
	onCreate(options: {
		playerName?: string;
		shortId?: number;
		roomName?: string;
		maxPlayers?: number;
		isPrivate?: boolean;
	}) {
		console.log(
			`[BattleRoom] Room created - ID: ${this.roomId}, Options:`, JSON.stringify(options)
		);

		const normalizedMaxPlayers = Number(options.maxPlayers);
		if (Number.isFinite(normalizedMaxPlayers)) {
			this.maxClients = Math.min(16, Math.max(2, Math.floor(normalizedMaxPlayers)));
		}

		this.roomDisplayName = options.roomName?.trim() || `Battle - ${this.roomId.substring(0, 6)}`;
		this.isPrivateRoom = Boolean(options.isPrivate);

		// 初始化状态
		this.state = new GameRoomState();
		this.assertSchemaMetadataSafe();

		// 初始化命令分发器
		this.commandDispatcher = new CommandDispatcher(this.state);

		// 设置初始游戏阶段
		this.state.currentPhase = "DEPLOYMENT";
		this.state.turnCount = 1;

		// 设置初始元数据
		this.setMetadata({
			name: this.roomDisplayName,
			phase: this.state.currentPhase,
			turnCount: 1,
			isPrivate: this.isPrivateRoom,
			maxPlayers: this.maxClients,
			playerCount: 0,
			dmCount: 0,
		});

		// 注册所有消息处理器
		this.registerMessageHandlers();

		// 设置游戏循环 (60 FPS)
		this.setSimulationInterval((deltaTime) => this.update(deltaTime), 16);

		console.log(`[BattleRoom] Initialization complete, metadata set`);
		console.log(`[BattleRoom] Room state type: ${this.state.constructor.name}`);
	}

	/**
	 * 客户端认证 - 简化版，直接使用用户名
	 * 在 onJoin 之前调用
	 */
	async onAuth(
		client: Client,
		options: { playerName?: string; shortId?: number }
	) {
		// 简化认证：直接使用用户名，无需 token
		const playerName = options?.playerName?.trim();

		if (!playerName || playerName.length === 0) {
			console.warn(`[BattleRoom] Auth failed: empty player name from ${client.sessionId}`);
			throw new Error("请输入玩家名称");
		}

		if (playerName.length > 32) {
			console.warn(`[BattleRoom] Auth failed: name too long (${playerName.length}) from ${client.sessionId}`);
			throw new Error("玩家名称不能超过 32 个字符");
		}

		const shortId = this.resolveShortId(options?.shortId);

		// 保存到 client 对象供 onJoin 使用
		(client as any).playerName = playerName;
		(client as any).shortId = shortId;

		console.log(`[BattleRoom] Auth: ${playerName} (${client.sessionId}) [${shortId}]`);
		return true;
	}

	private resolveShortId(shortId: number | undefined): number {
		if (
			typeof shortId === "number" &&
			Number.isInteger(shortId) &&
			shortId >= 100000 &&
			shortId <= 999999
		) {
			return shortId;
		}

		return Math.floor(100000 + Math.random() * 900000);
	}

	private findPlayerSessionByShortId(shortId: number): string | null {
		for (const [sessionId, identity] of this.playerIdentity.entries()) {
			if (identity.shortId === shortId) {
				return sessionId;
			}
		}

		return null;
	}

	private transferPlayerOwnership(fromSessionId: string, toSessionId: string): void {
		if (this.roomOwnerId === fromSessionId) {
			this.roomOwnerId = toSessionId;
		}

		this.state.ships.forEach((ship: ShipState) => {
			if (ship.ownerId === fromSessionId) {
				ship.ownerId = toSessionId;
			}
		});
	}

	private assertSchemaMetadataSafe(): void {
		const classes: Array<[string, unknown]> = [
			["GameRoomState", GameRoomState],
			["PlayerState", PlayerState],
			["ShipState", ShipState],
			["WeaponSlot", WeaponSlot],
		];

		for (const [name, klass] of classes) {
			const metadata = (
				klass as { [Symbol.metadata]?: Record<string, { name?: string; type?: unknown }> }
			)[Symbol.metadata];
			if (!metadata) {
				throw new Error(`[SchemaCheck] ${name} metadata missing`);
			}

			for (const [index, field] of Object.entries(metadata)) {
				if (!field || typeof field !== "object") {
					continue;
				}

				if ("type" in field && field.type === undefined) {
					const fieldName = "name" in field ? String(field.name) : `#${index}`;
					throw new Error(`[SchemaCheck] ${name}.${fieldName} has undefined type`);
				}

				if ("type" in field && typeof field.type === "object" && field.type !== null) {
					const fieldName = "name" in field ? String(field.name) : `#${index}`;
					const complexType = field.type as Record<string, unknown>;

					if ("map" in complexType && complexType.map === undefined) {
						throw new Error(`[SchemaCheck] ${name}.${fieldName} has undefined map child type`);
					}

					if ("array" in complexType && complexType.array === undefined) {
						throw new Error(`[SchemaCheck] ${name}.${fieldName} has undefined array child type`);
					}

					if ("set" in complexType && complexType.set === undefined) {
						throw new Error(`[SchemaCheck] ${name}.${fieldName} has undefined set child type`);
					}
				}
			}
		}
	}

	/**
	 * 客户端加入房间
	 * 在 onAuth 成功后调用
	 */
	onJoin(client: Client) {
		// 从 onAuth 传递的名称
		const playerName =
			(client as Client & { playerName: string }).playerName ||
			`Player_${client.sessionId.substring(0, 4)}`;
		const shortId =
			(client as Client & { shortId?: number }).shortId || this.resolveShortId(undefined);

		console.log(`[BattleRoom] Player joined: ${playerName} (${client.sessionId}) [${shortId}]`);

		// 检查是否有同短 ID 的玩家已连接（防止重复）
		const existingPlayerByShortId = this.findPlayerByShortId(shortId);
		if (existingPlayerByShortId && existingPlayerByShortId.connected && existingPlayerByShortId.sessionId !== client.sessionId) {
			// 旧玩家已断开，清理旧数据，允许新玩家加入
			console.log(`[BattleRoom] Cleaning up disconnected player with same shortId: ${existingPlayerByShortId.sessionId}`);
			this.state.players.delete(existingPlayerByShortId.sessionId);
			this.playerIdentity.delete(existingPlayerByShortId.sessionId);
			this.pingEwma.delete(existingPlayerByShortId.sessionId);
			this.jitterEwma.delete(existingPlayerByShortId.sessionId);
		}

		// 检查是否有同名的玩家已连接（用户名独占性）
		const existingPlayerByName = this.findPlayerByName(playerName);
		if (existingPlayerByName && existingPlayerByName.connected && existingPlayerByName.sessionId !== client.sessionId) {
			console.warn(`[BattleRoom] Username "${playerName}" already in use by ${existingPlayerByName.sessionId}`);
			throw new Error(`用户名 "${playerName}" 已被使用，请选择其他用户名`);
		}

		// 创建玩家状态
		this.assertSchemaMetadataSafe();
		const player = new PlayerState();
		player.sessionId = client.sessionId;
		player.shortId = shortId;
		player.name = playerName;
		player.connected = true;
		player.role = "player";
		player.isReady = false;
		player.pingMs = -1;
		player.jitterMs = 0;
		player.connectionQuality = "excellent";

		// 第一个玩家自动成为 DM
		if (this.clients.length === 1) {
			player.role = "dm";
			this.roomOwnerId = client.sessionId;
			console.log(`[BattleRoom] First player is DM`);
		}

		// 发送角色信息
		client.send("role", { role: player.role });
		client.send("identity", { userName: playerName, shortId });

		// 添加到状态
		this.state.players.set(client.sessionId, player);
		this.playerIdentity.set(client.sessionId, { userName: playerName, shortId });
		this.pingEwma.set(client.sessionId, -1);
		this.jitterEwma.set(client.sessionId, 0);

		// 更新元数据
		this.updateMetadata();
	}

	/**
	 * 更新房间元数据
	 */
	private updateMetadata(): void {
		let playerCount = 0;
		let dmCount = 0;
		
		this.state.players.forEach((p) => {
			if (p.connected) {
				if (p.role === "dm") dmCount++;
				else playerCount++;
			}
		});

		this.setMetadata({
			name: this.roomDisplayName,
			phase: this.state.currentPhase,
			turnCount: this.state.turnCount,
			isPrivate: this.isPrivateRoom,
			maxPlayers: this.maxClients,
			playerCount,
			dmCount,
			ownerId: this.roomOwnerId,
			ownerShortId: this.roomOwnerId ? (this.playerIdentity.get(this.roomOwnerId)?.shortId ?? null) : null,
		});
	}

	/**
	 * 根据 shortId 查找玩家
	 */
	private findPlayerByShortId(shortId: number): PlayerState | null {
		for (const player of this.state.players.values()) {
			if (player.shortId === shortId) {
				return player;
			}
		}
		return null;
	}

	/**
	 * 根据用户名查找玩家
	 */
	private findPlayerByName(name: string): PlayerState | null {
		for (const player of this.state.players.values()) {
			if (player.name.toLowerCase() === name.toLowerCase()) {
				return player;
			}
		}
		return null;
	}

	/**
	 * 注册所有消息处理器
	 */
	private registerMessageHandlers() {
		// 聊天消息
		this.onMessage('chat', (client, payload: { content: string; playerName?: string }) => {
			const player = this.state.players.get(client.sessionId);
			const senderName = payload.playerName || player?.name || 'Unknown';
			
			// 广播聊天消息给所有客户端
			this.broadcast('chat', {
				senderId: client.sessionId,
				senderName,
				content: payload.content.trim(),
			});
			
			console.log(`[Chat] ${senderName}: ${payload.content}`);
		});

		// 移动指令
		this.onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, payload: MoveTokenPayload) => {
			try {
				this.commandDispatcher.dispatchMoveToken(client, payload);
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 护盾指令
		this.onMessage(ClientCommand.CMD_TOGGLE_SHIELD, (client, payload: ToggleShieldPayload) => {
			try {
				this.commandDispatcher.dispatchToggleShield(client, payload);
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 开火指令
		this.onMessage(ClientCommand.CMD_FIRE_WEAPON, (client, payload: FireWeaponPayload) => {
			try {
				this.commandDispatcher.dispatchFireWeapon(client, payload);
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 排散指令
		this.onMessage(ClientCommand.CMD_VENT_FLUX, (client, payload: VentFluxPayload) => {
			try {
				this.commandDispatcher.dispatchVentFlux(client, payload);
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 分配舰船指令
		this.onMessage(
			ClientCommand.CMD_ASSIGN_SHIP,
			(client, payload: { shipId: string; targetSessionId: string }) => {
				try {
					this.commandDispatcher.dispatchAssignShip(
						client,
						payload.shipId,
						payload.targetSessionId
					);
				} catch (error) {
					client.send("error", { message: (error as Error).message });
				}
			}
		);

		// 切换准备状态
		this.onMessage(ClientCommand.CMD_TOGGLE_READY, (client, payload: { isReady: boolean }) => {
			try {
				const player = this.state.players.get(client.sessionId);
				if (player) {
					player.isReady = payload.isReady;
					this.checkAutoAdvancePhase();
				}
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 下一阶段指令
		this.onMessage(ClientCommand.CMD_NEXT_PHASE, (client) => {
			try {
				const player = this.state.players.get(client.sessionId);
				if (player?.role === "dm") {
					this.advancePhase();
				} else {
					throw new Error("只有 DM 可以强制进入下一阶段");
				}
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 创建测试舰船（旧接口，保留兼容性）
		this.onMessage(
			"CREATE_TEST_SHIP",
			(client, payload: { faction: "player" | "dm"; x: number; y: number }) => {
				const player = this.state.players.get(client.sessionId);
				if (player?.role === "dm") {
					this.createTestShip(payload.faction, payload.x, payload.y);
				} else {
					client.send("error", { message: "只有 DM 可以创建测试舰船" });
				}
			}
		);

		// DM 创建对象（新接口）
		this.onMessage("DM_CREATE_OBJECT", (client, payload: CreateObjectPayload) => {
			const player = this.state.players.get(client.sessionId);
			if (player?.role === "dm") {
				this.createObject(payload);
			} else {
				client.send("error", { message: "只有 DM 可以创建对象" });
			}
		});

		// DM 清除过载
		this.onMessage("DM_CLEAR_OVERLOAD", (client, payload: DMClearOverloadPayload) => {
			try {
				this.commandDispatcher.dispatchClearOverload(client, payload.shipId);
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// DM 修改护甲
		this.onMessage("DM_SET_ARMOR", (client, payload: DMSetArmorPayload) => {
			try {
				this.commandDispatcher.dispatchSetArmor(
					client,
					payload.shipId,
					payload.section,
					payload.value
				);
			} catch (error) {
				client.send("error", { message: (error as Error).message });
			}
		});

		// 网络质量探测
		this.onMessage("NET_PING", (client, payload: NetPingPayload) => {
			const player = this.state.players.get(client.sessionId);
			if (!player || !player.connected) return;

			const now = Date.now();
			const sampleRtt = Math.max(0, now - payload.clientSentAt);
			const prevRtt = this.pingEwma.get(client.sessionId) ?? -1;
			const alpha = 0.2;
			const nextRtt = prevRtt < 0 ? sampleRtt : prevRtt * (1 - alpha) + sampleRtt * alpha;

			const prevJitter = this.jitterEwma.get(client.sessionId) ?? 0;
			const jitterSample = prevRtt < 0 ? 0 : Math.abs(sampleRtt - prevRtt);
			const nextJitter = prevJitter * 0.7 + jitterSample * 0.3;

			this.pingEwma.set(client.sessionId, nextRtt);
			this.jitterEwma.set(client.sessionId, nextJitter);

			player.pingMs = Math.round(nextRtt);
			player.jitterMs = Math.round(nextJitter);
			player.connectionQuality = this.toQuality(player.pingMs);

			client.send("NET_PONG", {
				seq: payload.seq,
				serverTime: now,
				pingMs: player.pingMs,
				jitterMs: player.jitterMs,
				quality: player.connectionQuality,
			});
		});
	}

	/**
	 * 游戏主循环
	 */
	private update(deltaTime: number) {
		// 更新所有舰船的状态
		this.state.ships.forEach((ship: ShipState) => {
			// 更新武器冷却
			ship.weapons.forEach((weapon: WeaponSlot) => {
				if (weapon.cooldown > 0) {
					weapon.cooldown = Math.max(0, weapon.cooldown - deltaTime / 1000);
				}
			});

			// 更新过载时间
			if (ship.isOverloaded && ship.overloadTime > 0) {
				ship.overloadTime -= deltaTime / 1000;
				if (ship.overloadTime <= 0) {
					ship.isOverloaded = false;
					ship.overloadTime = 0;
				}
			}
		});
	}

	/**
	 * 检查是否自动进入下一阶段
	 */
	private checkAutoAdvancePhase(): void {
		if (this.state.currentPhase !== "PLAYER_TURN") return;

		let allReady = true;
		let hasPlayers = false;

		this.state.players.forEach((player: PlayerState) => {
			if (player.role === "player" && player.connected) {
				hasPlayers = true;
				if (!player.isReady) {
					allReady = false;
				}
			}
		});

		if (hasPlayers && allReady) {
			console.log("[BattleRoom] All players ready, advancing phase");
			this.advancePhase();
		}
	}

	/**
	 * 推进游戏阶段
	 */
	private advancePhase(): void {
		const phases: GamePhase[] = ["DEPLOYMENT", "PLAYER_TURN", "DM_TURN", "END_PHASE"];
		const currentIndex = phases.indexOf(this.state.currentPhase);
		let nextIndex = currentIndex + 1;

		if (nextIndex >= phases.length) {
			nextIndex = phases.indexOf("PLAYER_TURN");
		}

		const oldPhase = this.state.currentPhase;
		this.state.currentPhase = phases[nextIndex];

		// 重置所有玩家的 ready 状态
		this.state.players.forEach((p: PlayerState) => (p.isReady = false));

		// 处理阶段转换
		if (this.state.currentPhase === "END_PHASE") {
			this.handleEndPhase();
			return this.advancePhase();
		}

		// 设置活跃阵营
		this.state.activeFaction = this.state.currentPhase === "PLAYER_TURN" ? "player" : "dm";

		// 广播阶段变更
		this.broadcast("phase_change", {
			phase: this.state.currentPhase,
			oldPhase,
			turnCount: this.state.turnCount,
		});

		// 更新元数据
		this.updateMetadata();
		console.log(`[BattleRoom] Phase changed: ${oldPhase} -> ${this.state.currentPhase}`);
	}

	/**
	 * 处理结束阶段
	 */
	private handleEndPhase(): void {
		this.state.ships.forEach((ship: ShipState) => {
			// 清空软辐能
			ship.fluxSoft = 0;

			// 重置行动标记
			ship.hasMoved = false;
			ship.hasFired = false;

			// 护盾维持消耗
			if (ship.isShieldUp) {
				ship.fluxSoft += 2;
			}

			// 检查过载
			if (ship.fluxSoft + ship.fluxHard >= ship.fluxMax) {
				ship.isOverloaded = true;
				ship.overloadTime = 10;
				ship.isShieldUp = false;
			}
		});

		this.state.turnCount++;
	}

	/**
	 * 创建测试舰船
	 */
	private createTestShip(faction: "player" | "dm", x: number, y: number) {
		const ship = new ShipState();
		ship.id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		ship.faction = faction;
		ship.hullType = "frigate";
		ship.transform.x = x;
		ship.transform.y = y;
		ship.transform.heading = faction === "player" ? 0 : 180;

		ship.hullMax = 1000;
		ship.hullCurrent = 1000;
		ship.armorMax = new ArraySchema<number>(150, 150, 150, 100, 150, 150);
		ship.armorCurrent = new ArraySchema<number>(150, 150, 150, 100, 150, 150);
		ship.fluxMax = 200;
		ship.fluxHard = 0;
		ship.fluxSoft = 0;
		ship.maxSpeed = 100;
		ship.maxTurnRate = 45;
		ship.acceleration = 50;

		const weapon = this.createWeaponSlot(`weapon_${Date.now()}`, "kinetic", 50, 300, 90, 0, 0);
		ship.weapons.set(weapon.weaponId, weapon);

		this.state.ships.set(ship.id, ship);
		console.log(`[BattleRoom] Created test ship: ${ship.id} at (${x}, ${y})`);
	}

	/**
	 * DM 创建对象（舰船/空间站/小行星）
	 */
	createObject(payload: CreateObjectPayload): void {
		const { type, hullId, x, y, heading, faction, ownerId } = payload;

		if (type === "ship" && hullId) {
			const shipSpec = getShipHullSpec(hullId);
			if (!shipSpec) {
				console.error(`[BattleRoom] Ship hull not found: ${hullId}`);
				return;
			}

			const ship = new ShipState();
			ship.id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			ship.faction = faction;
			ship.hullType = hullId;
			ship.ownerId = ownerId || "";
			ship.transform.x = x;
			ship.transform.y = y;
			ship.transform.heading = heading;

			ship.hullMax = shipSpec.hullPoints;
			ship.hullCurrent = shipSpec.hullPoints;

			const armorDist = shipSpec.armorDistribution || Array(6).fill(shipSpec.armorValue);
			ship.armorMax = new ArraySchema<number>(...armorDist);
			ship.armorCurrent = new ArraySchema<number>(...armorDist);

			ship.fluxMax = shipSpec.fluxCapacity;
			ship.fluxDissipation = shipSpec.fluxDissipation || 10;
			ship.fluxHard = 0;
			ship.fluxSoft = 0;

			ship.maxSpeed = shipSpec.maxSpeed;
			ship.maxTurnRate = shipSpec.maxTurnRate;
			ship.acceleration = shipSpec.acceleration;

			if (shipSpec.hasShield) {
				ship.isShieldUp = false;
				ship.shieldOrientation = heading;
				ship.shieldArc = shipSpec.shieldArc || 120;
			}

			// 添加武器
			for (const mount of shipSpec.weaponMounts) {
				const weaponSpec = mount.defaultWeapon ? getWeaponSpec(mount.defaultWeapon) : null;
				if (weaponSpec) {
					ship.weapons.set(
						mount.id,
						this.createWeaponSlot(
							mount.id,
							this.mapDamageType(weaponSpec.damageType),
							weaponSpec.damage,
							weaponSpec.range,
							weaponSpec.arc,
							mount.facing,
							0
						)
					);
				}
			}

			this.state.ships.set(ship.id, ship);
			console.log(`[BattleRoom] Created ${hullId} for ${faction} at (${x}, ${y})`);
		} else if (type === "station" || type === "asteroid") {
			const ship = new ShipState();
			ship.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			ship.faction = faction;
			ship.hullType = type;
			ship.ownerId = ownerId || "";
			ship.transform.x = x;
			ship.transform.y = y;
			ship.transform.heading = heading;

			ship.hullMax = type === "station" ? 5000 : 2000;
			ship.hullCurrent = ship.hullMax;
			ship.armorMax = new ArraySchema<number>(300, 300, 300, 200, 300, 300);
			ship.armorCurrent = new ArraySchema<number>(300, 300, 300, 200, 300, 300);
			ship.fluxMax = 0;
			ship.fluxHard = 0;
			ship.fluxSoft = 0;
			ship.maxSpeed = 0;
			ship.maxTurnRate = 0;
			ship.acceleration = 0;

			this.state.ships.set(ship.id, ship);
			console.log(`[BattleRoom] Created ${type} at (${x}, ${y})`);
		}
	}

	/**
	 * 映射伤害类型
	 */
	private mapDamageType(type: string): "kinetic" | "high_explosive" | "energy" | "fragmentation" {
		switch (type) {
			case "kinetic":
				return "kinetic";
			case "high_explosive":
				return "high_explosive";
			case "energy":
				return "energy";
			default:
				return "fragmentation";
		}
	}

	private createWeaponSlot(
		weaponId: string,
		type: "kinetic" | "high_explosive" | "energy" | "fragmentation",
		damage: number,
		range: number,
		arc: number,
		angle: number,
		cooldown: number
	): WeaponSlot {
		const weapon = new WeaponSlot();
		weapon.weaponId = weaponId;
		weapon.type = type;
		weapon.damage = damage;
		weapon.range = range;
		weapon.arc = arc;
		weapon.angle = angle;
		weapon.cooldown = cooldown;
		return weapon;
	}

	/**
	 * 将 Ping 值转换为连接质量
	 */
	private toQuality(pingMs: number): "excellent" | "good" | "fair" | "poor" | "offline" {
		if (pingMs < 0) return "offline";
		if (pingMs <= 80) return "excellent";
		if (pingMs <= 140) return "good";
		if (pingMs <= 220) return "fair";
		return "poor";
	}

	/**
	 * 客户端离开房间
	 * 实现断线重连机制
	 */
	async onLeave(client: Client, code?: number) {
		const player = this.state.players.get(client.sessionId);
		const allowReconnect = code !== 1000; // 正常退出 (1000) 不允许重连

		console.log(
			`[BattleRoom] Player left: ${player?.name || "unknown"} (${client.sessionId}), ` +
			`code: ${code}, allowReconnect: ${allowReconnect}`
		);

		if (allowReconnect && player) {
			try {
				// 允许 60 秒内重连
				await this.allowReconnection(client, 60);

				// 重连成功，恢复连接状态
				player.connected = true;
				console.log(`[BattleRoom] Player ${player.name} reconnected`);
				return;
			} catch (e) {
				// 重连失败或超时
				console.log(`[BattleRoom] Player ${player.name} reconnection failed`);
			}
		}

		// 设置断开状态
		if (player) {
			player.connected = false;
		}

		// 更新元数据
		this.updateMetadata();

		// 检查是否需要清理（所有客户端都断开）
		const hasConnectedClients = Array.from(this.state.players.values()).some(p => p.connected);

		if (!hasConnectedClients && this.clients.length === 0) {
			// 给 5 分钟清理时间，防止短暂网络波动
			console.log(`[BattleRoom] No connected clients, scheduling cleanup in 5 minutes`);
			setTimeout(() => {
				if (this.clients.length === 0) {
					console.log(`[BattleRoom] No clients after timeout, disconnecting`);
					this.disconnect();
				}
			}, 5 * 60 * 1000);
		}
	}

	/**
	 * 房间销毁
	 */
	onDispose() {
		console.log(`[BattleRoom] Room ${this.roomId} disposed`);
		// Colyseus 会自动清理所有资源
	}
}
