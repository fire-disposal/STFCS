/**
 * MutativeStateManager - 基于 Mutative 的状态管理器
 *
 * 特点：
 * 1. 使用 draft 模式修改状态，自动生成 patches
 * 2. inversePatches 提供旧值，用于日志和撤销
 * 3. 统一的变更广播机制（patch 增量 / full 全量）
 * 4. 支持历史记录和撤销操作
 * 5. 支持延迟注入 IO（Room 创建时可能没有 IO）
 *
 * 设计原则：
 * - 所有 mutation 方法均不直接修改外部传入的对象（无副作用）
 * - updateTokenRuntime 使用浅合并（Object.assign），嵌套对象必须提供完整结构
 * - 路径操作（updateToken）不做类型校验，路径错误静默失败
 */

import { create, type Draft, type Patch } from "mutative"
import { cloneDeep, merge } from "lodash-es"
import type { Server as IOServer, Socket } from "socket.io"
import type {
	GameRoomState,
	StatePatch,
	StatePatchPayload,
	BattleLogEdit,
	BattleLogPayload,
	CombatToken,
	TokenRuntime,
	TokenSpec,
	Faction,
	EditLogContext,
} from "@vt/data"
import { TURN_ORDER, GamePhase } from "@vt/data"

export interface MutateResult {
	patches: Patch[]
	inversePatches: Patch[]
}

interface HistoryEntry {
	patches: Patch[]
	inversePatches: Patch[]
	timestamp: number
	description: string | undefined
}

export class MutativeStateManager {
	private state: GameRoomState
	private io: IOServer | null = null
	private roomId: string
	private history: HistoryEntry[] = []
	private maxHistoryLength = 50

	constructor(roomId: string, initialState?: GameRoomState) {
		this.roomId = roomId
		this.state = initialState ?? {
			roomId,
			ownerId: "",
			phase: GamePhase.DEPLOYMENT,
			turnCount: 0,
			players: {},
			tokens: {},
			globalModifiers: {},
			createdAt: Date.now(),
		}
	}

	setIo(io: IOServer): void {
		this.io = io
	}

	getState(): GameRoomState {
		return this.state
	}

	/**
	 * 用快照替换整个状态（用于读档）。
	 * 会清空 undo 历史，并广播全量状态。
	 * 注意：不会生成增量 patches。
	 */
	loadSnapshot(snapshot: GameRoomState): void {
		this.state = cloneDeep(snapshot)
		this.history = []
		this.broadcastFull()
	}

	/**
	 * 通用 mutation 入口。
	 * @param mutator - 在 draft 上执行修改
	 * @param saveHistory - 是否将操作存入 undo 历史
	 * @param description - 操作描述（用于 undo 列表显示）
	 */
	mutate(mutator: (draft: Draft<GameRoomState>) => void, saveHistory = false, description?: string): MutateResult {
		const [newState, patches, inversePatches] = create(
			this.state,
			mutator,
			{ enablePatches: true }
		)
		this.state = newState

		if (saveHistory && patches.length > 0) {
			this.history.push({
				patches,
				inversePatches,
				timestamp: Date.now(),
				description,
			})
			if (this.history.length > this.maxHistoryLength) {
				this.history.shift()
			}
		}

		return { patches, inversePatches }
	}

	/** mutate + 广播 patches */
	mutateAndBroadcast(mutator: (draft: Draft<GameRoomState>) => void, saveHistory = false): MutateResult {
		const result = this.mutate(mutator, saveHistory)
		this.broadcastPatches(result.patches)
		return result
	}

	/** mutate + 广播 patches + 广播编辑日志（用于 DM/编辑操作） */
	mutateWithLog(
		mutator: (draft: Draft<GameRoomState>) => void,
		logContext: EditLogContext,
		saveHistory = true
	): MutateResult {
		const result = this.mutate(mutator, saveHistory, logContext.reason)

		this.broadcastPatches(result.patches)
		this.broadcastEditLogs(result, logContext)

		return result
	}

	/** 撤销上一次保存了历史的操作 */
	undo(): boolean {
		const lastEntry = this.history.pop()
		if (!lastEntry) return false

		const [newState] = create(
			this.state,
			(draft) => {
				this.applyInversePatches(draft, lastEntry.inversePatches)
			},
			{ enablePatches: true }
		)
		this.state = newState
		this.broadcastFull()
		return true
	}

	/** 广播全量状态 */
	broadcastFull(): void {
		if (this.io) {
			this.io.to(this.roomId).emit("sync:full", this.state)
		}
	}

	/** 向特定 socket 发送全量状态（用于新玩家加入） */
	broadcastToSocket(socket: Socket): void {
		socket.emit("sync:full", this.state)
	}

	/** 广播增量 patches */
	broadcastPatches(patches: Patch[]): void {
		if (patches.length === 0 || !this.io) return

		const statePatches: StatePatch[] = patches.map(p => ({
			op: this.patchOpToStateOp(p.op),
			path: p.path as (string | number)[],
			value: p.value,
		}))

		const payload: StatePatchPayload = {
			patches: statePatches,
			timestamp: Date.now(),
		}

		this.io.to(this.roomId).emit("state:patch", payload)
	}

	/**
	 * 广播编辑日志变更。
	 * 只记录 tokens/** 下的变更，生成 BattleLogEdit 事件。
	 */
	private broadcastEditLogs(result: MutateResult, logContext: EditLogContext): void {
		if (!this.io) return

		for (const invPatch of result.inversePatches) {
			const invPath = invPatch.path as (string | number)[]
			const correspondingPatch = result.patches.find(
				p => this.pathsEqual((p.path as (string | number)[]), invPath)
			)

			if (invPath.length >= 2 && invPath[0] === "tokens") {
				const tokenId = String(invPath[1])
				const token = this.state.tokens[tokenId]
				const pathStr = invPath.slice(2).map(String).join("/")

				const log: BattleLogEdit = {
					type: "edit",
					playerId: logContext.playerId,
					playerName: logContext.playerName,
					tokenId,
					tokenName: token?.metadata?.name ?? tokenId,
					path: pathStr,
					oldValue: invPatch.value,
					newValue: correspondingPatch?.value,
					reason: logContext.reason,
					timestamp: Date.now(),
				}

				this.io.to(this.roomId).emit("battle:log", { log } as BattleLogPayload)
			}
		}
	}

	/**
	 * 回放 inversePatches 实现撤销。
	 * 注意：Mutative 的逆补丁 op 语义和正向相反，此处手动转换。
	 */
	private applyInversePatches(draft: Draft<GameRoomState>, inversePatches: Patch[]): void {
		for (const patch of inversePatches.reverse()) {
			const path = patch.path as (string | number)[]
			if (path.length === 0) continue
			const target = this.resolvePath(draft, path.slice(0, -1))
			const key = path[path.length - 1]

			if (key === undefined) continue

			if (patch.op === "add") {
				// 逆补丁：add → 删除该 key
				delete target[key]
			} else if (patch.op === "remove") {
				// 逆补丁：remove → 恢复旧值
				target[key] = patch.value
			} else if (patch.op === "replace") {
				// 逆补丁：replace → 恢复旧值
				target[key] = patch.value
			}
		}
	}

	/** 沿路径解析目标对象 */
	private resolvePath(obj: any, path: (string | number)[]): any {
		for (const key of path) {
			if (obj == null) return obj
			obj = obj[key]
		}
		return obj
	}

	/** Mutative op → StatePatch op 映射 */
	private patchOpToStateOp(op: string): StatePatch["op"] {
		switch (op) {
			case "add": return "add"
			case "remove": return "remove"
			case "replace": return "replace"
			default:
				throw new Error(`未知 patch 操作: ${op}`)
		}
	}

	/** 比较两个路径数组是否相等 */
	private pathsEqual(a: (string | number)[], b: (string | number)[]): boolean {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false
		}
		return true
	}

	// ======================================================
	// 便捷操作方法
	// ======================================================

	getToken(tokenId: string): CombatToken | undefined {
		return this.state.tokens[tokenId]
	}

	getPlayer(playerId: string): GameRoomState["players"][string] | undefined {
		return this.state.players[playerId]
	}

	/**
	 * 设置/创建舰船。
	 * 自动初始化护盾和武器运行时状态（如有规格但缺少运行时数据）。
	 * 不污染输入 token 对象。
	 */
	setToken(tokenId: string, token: CombatToken, logContext?: EditLogContext): void {
		const mutator = (draft: Draft<GameRoomState>) => {
			// 创建新的 runtime 对象，不修改外部传入的 token
			const existingRuntime = token.runtime ?? {} as TokenRuntime
			const runtime: TokenRuntime = { ...existingRuntime }

			// 护盾初始化：有 shield spec 但无 runtime.shield 时自动创建
			if (token.spec?.shield && !runtime.shield) {
				runtime.shield = {
					active: false,
					direction: 0,
				}
			}

			// 武器初始化：有 mounts 但无 runtime.weapons 时自动创建
			if (!runtime.weapons && token.spec?.mounts) {
				runtime.weapons = token.spec.mounts
					.filter((m: { weapon?: unknown }) => m.weapon)
					.map((m: { id: string }) => ({
						mountId: m.id,
						state: "READY" as const,
					}))
			}

			draft.tokens[tokenId] = {
				...token,
				runtime,
			}
		}

		if (logContext) {
			this.mutateWithLog(mutator, logContext)
		} else {
			this.mutateAndBroadcast(mutator)
		}
	}

	/**
	 * 通过路径字符串设置 token 的某个字段。
	 * 路径格式：以 "/" 分隔的字段名（如 "runtime/hull"）。
	 * 数字路径段自动转为数组索引。
	 * ⚠️ 不做类型校验，路径错误会静默无操作。
	 */
	updateToken(tokenId: string, path: string, value: unknown, logContext?: EditLogContext): void {
		const pathParts = path.split("/").map(p => {
			const num = Number(p)
			return Number.isNaN(num) ? p : num
		})

		const mutator = (draft: Draft<GameRoomState>) => {
			const token = draft.tokens[tokenId]
			if (!token) return

			if (pathParts.length === 0) return
			const target = this.resolvePath(token, pathParts.slice(0, -1))
			const key = pathParts[pathParts.length - 1]
			if (key !== undefined) {
				target[key] = value
			}
		}

		if (logContext) {
			this.mutateWithLog(mutator, logContext)
		} else {
			this.mutateAndBroadcast(mutator)
		}
	}

	/**
	 * 批量更新 token 运行时字段。
	 * ⚠️ 注意：使用浅合并（Object.assign 语义）。
	 * 对于嵌套对象（shield, movement, weapons），调用方必须提供完整结构，
	 * 否则会丢失未提供的字段。
	 * 推荐使用方式：
	 *   updateTokenRuntime(id, { shield: { ...current, active: true } })
	 *   updateTokenRuntime(id, { hull: 50, fluxSoft: 100 })
	 */
	updateTokenRuntime(tokenId: string, runtimeUpdates: Partial<TokenRuntime>): void {
		this.mutateAndBroadcast((draft) => {
			const token = draft.tokens[tokenId]
			if (token?.runtime) {
				const currentSequence = token.runtime.actionSequence ?? 0
				token.runtime.actionSequence = currentSequence + 1
				merge(token.runtime, runtimeUpdates)
			}
		})
	}

	updateTokenSpec(tokenId: string, specUpdates: Partial<TokenSpec>, logContext?: EditLogContext): void {
		const mutator = (draft: Draft<GameRoomState>) => {
			const token = draft.tokens[tokenId]
			if (token?.spec) {
				Object.assign(token.spec, specUpdates)
			}
		}

		if (logContext) {
			this.mutateWithLog(mutator, logContext)
		} else {
			this.mutateAndBroadcast(mutator)
		}
	}

	removeToken(tokenId: string, logContext?: EditLogContext): void {
		const mutator = (draft: Draft<GameRoomState>) => {
			delete draft.tokens[tokenId]
		}

		if (logContext) {
			this.mutateWithLog(mutator, logContext)
		} else {
			this.mutateAndBroadcast(mutator)
		}
	}

	clearTokens(): void {
		this.mutateAndBroadcast((draft) => {
			draft.tokens = {}
		})
	}

	addPlayer(playerId: string, player: {
		sessionId: string
		nickname: string
		role: "HOST" | "PLAYER"
		isReady: boolean
		connected: boolean
		tokenIds?: string[]
		avatar?: string
	}): void {
		this.mutateAndBroadcast((draft) => {
			draft.players[playerId] = player
		})
	}

	removePlayer(playerId: string): void {
		this.mutateAndBroadcast((draft) => {
			delete draft.players[playerId]
		})
	}

	updatePlayer(playerId: string, updates: Partial<{
		sessionId: string
		nickname: string
		role: "HOST" | "PLAYER"
		isReady: boolean
		connected: boolean
		tokenIds: string[]
		avatar: string
		avatarAssetId: string
		faction: string
	}>): void {
		this.mutateAndBroadcast((draft) => {
			const player = draft.players[playerId]
			if (player) {
				merge(player, updates)
			}
		})
	}

	updatePlayerConnection(playerId: string, connected: boolean): void {
		this.mutateAndBroadcast((draft) => {
			const player = draft.players[playerId]
			if (player) {
				player.connected = connected
			}
		})
	}

	/**
	 * 切换阶段，同时自动更新 activeFaction。
	 * phase ↔ activeFaction 对应关系：
	 *   DEPLOYMENT   → undefined
	 *   PLAYER_ACTION → TURN_ORDER 循环决定
	 *   DM_ACTION     → "ENEMY"
	 */
	changePhase(phase: GamePhase): void {
		this.mutateAndBroadcast((draft) => {
			draft.phase = phase
			draft.activeFaction = this.getFactionForPhase(phase)
		})
	}

	resetAllPlayersReady(): void {
		this.mutateAndBroadcast((draft) => {
			for (const playerId in draft.players) {
				if (draft.players[playerId]) {
					draft.players[playerId].isReady = false
				}
			}
		})
	}

	/**
	 * 根据阶段获取当前活跃派系
	 * PLAYER_ACTION 阶段使用 TURN_ORDER 决定当前派系
	 * DEPLOYMENT 阶段无派系
	 */
	private getFactionForPhase(phase: GamePhase): Faction | undefined {
		if (phase === GamePhase.PLAYER_ACTION) {
			// 根据回合数决定当前活跃派系（TURN_ORDER 循环）
			const factionIndex = (this.state.turnCount - 1) % TURN_ORDER.length;
			return TURN_ORDER[factionIndex] as Faction;
		}
		return undefined;
	}

	changeTurn(turn: number): void {
		this.mutateAndBroadcast((draft) => {
			draft.turnCount = turn
		})
	}

	changeFaction(faction: Faction): void {
		this.mutateAndBroadcast((draft) => {
			draft.activeFaction = faction
		})
	}

	changeHost(newOwnerId: string): void {
		this.mutateAndBroadcast((draft) => {
			draft.ownerId = newOwnerId
		})
	}

	setGlobalModifier(key: string, value: number): void {
		this.mutateAndBroadcast((draft) => {
			if (!draft.globalModifiers) {
				draft.globalModifiers = {}
			}
			draft.globalModifiers[key] = value
		})
	}

	removeGlobalModifier(key: string): void {
		this.mutateAndBroadcast((draft) => {
			if (draft.globalModifiers) {
				delete draft.globalModifiers[key]
			}
		})
	}

	getHistory(): HistoryEntry[] {
		return [...this.history]
	}

	canUndo(): boolean {
		return this.history.length > 0
	}
}
