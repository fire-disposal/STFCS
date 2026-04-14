/**
 * 游戏存档数据结构
 *
 * 用于保存和加载游戏状态，支持读档继续游戏
 *
 * 设计原则：
 * 1. 只保存必要数据
 * 2. 支持版本兼容
 * 3. 最小化存储空间
 * 4. 快速序列化/反序列化
 */

/**
 * 游戏存档版本（用于兼容性检查）
 */
export const GAME_SAVE_VERSION = "1.0.0";

/**
 * 玩家存档数据
 */
export interface PlayerSave {
	shortId: number; // 短 ID（不变，用于识别）
	name: string; // 用户名（不变）
	nickname: string; // 昵称
	avatar: string; // 头像
	role: string; // 角色（DM/PLAYER）
	isReady: boolean; // 准备状态
}

/**
 * 舰船存档数据
 */
export interface ShipSave {
	// 基础信息
	id: string; // 舰船 ID
	ownerId: string; // 所有者 sessionId（读档后可能失效）
	hullType: string; // 船体类型
	faction: string; // 阵营
	name: string; // 舰船名称

	// 位置信息
	transform: {
		x: number;
		y: number;
		heading: number;
	};

	// 尺寸信息
	width: number;
	length: number;

	// 状态信息
	hullCurrent: number; // 当前船体
	hullMax: number; // 最大船体
	armorCurrent: number[]; // 当前护甲（6 个象限）
	armorMax: number[]; // 最大护甲
	fluxHard: number; // 硬辐能
	fluxSoft: number; // 软辐能
	fluxMax: number; // 最大辐能
	isShieldUp: boolean; // 护盾是否开启
	isOverloaded: boolean; // 是否过载
	isDestroyed: boolean; // 是否被摧毁

	// 移动状态
	hasMoved: boolean; // 本回合是否已移动
	hasFired: boolean; // 本回合是否已开火
	currentMovementPhase: number; // 当前移动阶段

	// 武器状态（简化）
	weapons: Array<{
		mountId: string;
		weaponSpecId: string;
		currentAmmo: number;
		cooldownRemaining: number;
		hasFiredThisTurn: boolean;
	}>;
}

/**
 * 游戏存档数据
 */
export interface GameSave {
	// 元数据
	saveId: string; // 存档 ID（唯一标识）
	saveName: string; // 存档名称（用户自定义）
	createdAt: number; // 创建时间戳
	updatedAt: number; // 最后更新时间戳
	version: string; // 游戏版本（用于兼容性检查）

	// 房间信息
	roomId: string; // 房间 ID
	roomName: string; // 房间名称
	maxPlayers: number; // 最大玩家数
	isPrivate: boolean; // 是否私密房间

	// 游戏状态
	currentPhase: string; // 当前阶段（DEPLOYMENT/PLAYER_TURN/DM_TURN/END_PHASE）
	turnCount: number; // 回合数
	activeFaction: string; // 活跃阵营（PLAYER/DM）

	// 玩家列表
	players: PlayerSave[]; // 玩家存档

	// 舰船列表
	ships: ShipSave[]; // 舰船存档

	// 聊天历史（最近 50 条）
	chatHistory: Array<{
		id: string;
		senderId: string;
		senderName: string;
		content: string;
		timestamp: number;
		type: "chat" | "system" | "combat";
	}>;

	// 事件历史（最近 100 条，用于回放）
	eventHistory: Array<{
		id: string;
		type: string;
		data: string; // JSON 字符串
		timestamp: number;
	}>;
}

/**
 * 存档摘要（用于列表显示）
 */
export interface SaveSummary {
	saveId: string;
	saveName: string;
	roomName: string;
	playerCount: number;
	shipCount: number;
	turnCount: number;
	currentPhase: string;
	createdAt: number;
	updatedAt: number;
	fileSize: number; // 文件大小（字节）
}

/**
 * 存档存储接口
 *
 * 可以由不同的实现（内存、文件系统、数据库等）
 */
export interface SaveStore {
	/**
	 * 保存游戏
	 */
	save(saveData: GameSave): Promise<void>;

	/**
	 * 加载游戏
	 */
	load(saveId: string): Promise<GameSave>;

	/**
	 * 删除存档
	 */
	delete(saveId: string): Promise<void>;

	/**
	 * 列出所有存档
	 */
	list(): Promise<SaveSummary[]>;

	/**
	 * 检查存档是否存在
	 */
	exists(saveId: string): Promise<boolean>;

	/**
	 * 获取存档摘要
	 */
	getSummary(saveId: string): Promise<SaveSummary>;
}

/**
 * 将 GameRoomState 序列化为存档数据
 */
export function serializeGameSave(
	state: any,
	roomId: string,
	roomName: string,
	maxPlayers: number,
	isPrivate: boolean,
	saveName: string
): GameSave {
	const players: PlayerSave[] = [];
	state.players.forEach((player: any) => {
		players.push({
			shortId: player.shortId,
			name: player.name,
			nickname: player.nickname,
			avatar: player.avatar,
			role: player.role,
			isReady: player.isReady,
		});
	});

	const ships: ShipSave[] = [];
	state.ships.forEach((ship: any) => {
		const weapons: ShipSave["weapons"] = [];
		ship.weapons.forEach((weapon: any) => {
			weapons.push({
				mountId: weapon.mountId,
				weaponSpecId: weapon.weaponSpecId,
				currentAmmo: weapon.currentAmmo,
				cooldownRemaining: weapon.cooldownRemaining,
				hasFiredThisTurn: weapon.hasFiredThisTurn,
			});
		});

		ships.push({
			id: ship.id,
			ownerId: ship.ownerId,
			hullType: ship.hullType,
			faction: ship.faction,
			name: ship.name,
			transform: {
				x: ship.transform.x,
				y: ship.transform.y,
				heading: ship.transform.heading,
			},
			width: ship.width,
			length: ship.length,
			hullCurrent: ship.hullCurrent,
			hullMax: ship.hullMax,
			armorCurrent: Array.from(ship.armorCurrent),
			armorMax: Array.from(ship.armorMax),
			fluxHard: ship.fluxHard,
			fluxSoft: ship.fluxSoft,
			fluxMax: ship.fluxMax,
			isShieldUp: ship.isShieldUp,
			isOverloaded: ship.isOverloaded,
			isDestroyed: ship.isDestroyed,
			hasMoved: ship.hasMoved,
			hasFired: ship.hasFired,
			currentMovementPhase: ship.currentMovementPhase,
			weapons,
		});
	});

	const chatHistory = state.chatMessages
		.map((msg: any) => ({
			id: msg.id,
			senderId: msg.senderId,
			senderName: msg.senderName,
			content: msg.content,
			timestamp: msg.timestamp,
			type: msg.type,
		}))
		.slice(-50); // 只保留最近 50 条

	return {
		saveId: `save_${Date.now()}_${roomId}`,
		saveName,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		version: GAME_SAVE_VERSION,
		roomId,
		roomName,
		maxPlayers,
		isPrivate,
		currentPhase: state.currentPhase,
		turnCount: state.turnCount,
		activeFaction: state.activeFaction,
		players,
		ships,
		chatHistory,
		eventHistory: [], // 可选：记录事件历史
	};
}

/**
 * 从存档数据反序列化为 GameRoomState
 *
 * 注意：这需要 BattleRoom 提供状态恢复方法
 */
export function deserializeGameSave(saveData: GameSave): Partial<GameSave> {
	// 验证版本兼容性
	if (saveData.version !== GAME_SAVE_VERSION) {
		console.warn(`[Save] Version mismatch: expected ${GAME_SAVE_VERSION}, got ${saveData.version}`);
		// 可以在这里添加版本迁移逻辑
	}

	return {
		currentPhase: saveData.currentPhase,
		turnCount: saveData.turnCount,
		activeFaction: saveData.activeFaction,
		// 其他状态需要在 BattleRoom 中恢复
	};
}

/**
 * 压缩存档数据（可选，用于减少存储空间）
 */
export async function compressSave(saveData: GameSave): Promise<Uint8Array> {
	const json = JSON.stringify(saveData);
	const encoder = new TextEncoder();
	const data = encoder.encode(json);

	// 使用 Compression Streams API（现代浏览器支持）
	if (typeof CompressionStream !== "undefined") {
		const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));
		const compressed = await new Response(stream).arrayBuffer();
		return new Uint8Array(compressed);
	}

	// 降级：不压缩
	return data;
}

/**
 * 解压缩存档数据
 */
export async function decompressSave(compressed: Uint8Array): Promise<GameSave> {
	// 使用 Compression Streams API
	if (typeof DecompressionStream !== "undefined") {
		const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
		const json = await new Response(stream).text();
		return JSON.parse(json);
	}

	// 降级：假设未压缩
	const decoder = new TextDecoder();
	const json = decoder.decode(compressed);
	return JSON.parse(json);
}

/**
 * 生成存档摘要
 */
export function generateSaveSummary(saveData: GameSave, fileSize: number = 0): SaveSummary {
	return {
		saveId: saveData.saveId,
		saveName: saveData.saveName,
		roomName: saveData.roomName,
		playerCount: saveData.players.length,
		shipCount: saveData.ships.length,
		turnCount: saveData.turnCount,
		currentPhase: saveData.currentPhase,
		createdAt: saveData.createdAt,
		updatedAt: saveData.updatedAt,
		fileSize,
	};
}
