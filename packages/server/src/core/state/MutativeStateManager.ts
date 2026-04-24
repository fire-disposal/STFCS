/**
 * MutativeStateManager - 基于 Mutative 的状态管理器
 *
 * 特点：
 * 1. 使用 draft 模式修改状态，自动生成 patches
 * 2. inversePatches 提旧值，用于日志和撤销
 * 3. 统一的变更广播机制
 * 4. 支持历史记录和撤销操作
 * 5. 支持延迟注入 IO（Room 创建时可能没有 IO）
 */

import { create, type Draft, type Patch } from "mutative"
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
	GamePhase,
} from "@vt/data"
import {
	TURN_ORDER,
} from "@vt/data"

export interface MutateResult {
	patches: Patch[]
	inversePatches: Patch[]
}

export interface EditLogContext {
	playerId: string
	playerName: string
	reason?: string
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
			phase: "DEPLOYMENT",
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

	setState(newState: GameRoomState): void {
		this.state = newState
	}

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

	mutateAndBroadcast(mutator: (draft: Draft<GameRoomState>) => void, saveHistory = false): MutateResult {
		const result = this.mutate(mutator, saveHistory)
		this.broadcastPatches(result.patches)
		return result
	}

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

	broadcastFull(): void {
		if (this.io) {
			this.io.to(this.roomId).emit("sync:full", this.state)
		}
	}

	broadcastToSocket(socket: Socket): void {
		socket.emit("sync:full", this.state)
	}

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

	private applyInversePatches(draft: Draft<GameRoomState>, inversePatches: Patch[]): void {
		for (const patch of inversePatches.reverse()) {
			const path = patch.path as (string | number)[]
			if (path.length === 0) continue
			const target = this.resolvePath(draft, path.slice(0, -1))
			const key = path[path.length - 1]

			if (key === undefined) continue

			if (patch.op === "add") {
				delete target[key]
			} else if (patch.op === "remove") {
				target[key] = patch.value
			} else if (patch.op === "replace") {
				target[key] = patch.value
			}
		}
	}

	private resolvePath(obj: any, path: (string | number)[]): any {
		for (const key of path) {
			obj = obj[key]
		}
		return obj
	}

	private patchOpToStateOp(op: string): StatePatch["op"] {
		switch (op) {
			case "add": return "add"
			case "remove": return "remove"
			case "replace": return "replace"
			default: return "replace"
		}
	}

	private pathsEqual(a: (string | number)[], b: (string | number)[]): boolean {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false
		}
		return true
	}

	getToken(tokenId: string): CombatToken | undefined {
		return this.state.tokens[tokenId]
	}

	getPlayer(playerId: string): GameRoomState["players"][string] | undefined {
		return this.state.players[playerId]
	}

	setToken(tokenId: string, token: CombatToken, logContext?: EditLogContext): void {
		const mutator = (draft: Draft<GameRoomState>) => {
			if (token.spec?.shield && !token.runtime?.shield) {
				token.runtime = token.runtime || {} as any
					; (token.runtime as any).shield = {
						active: false,
						value: token.spec.shield.radius,
						direction: 0,
					}
			}
			// 初始化武器运行时状态（所有武器初始为 READY）
			if (!token.runtime?.weapons && token.spec?.mounts) {
				token.runtime = token.runtime || {} as any
					; (token.runtime as any).weapons = token.spec.mounts
						.filter((m: any) => m.weapon)
						.map((m: any) => ({
							mountId: m.id,
							state: "READY",
						}))
			}
			draft.tokens[tokenId] = token
		}

		if (logContext) {
			this.mutateWithLog(mutator, logContext)
		} else {
			this.mutateAndBroadcast(mutator)
		}
	}

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

	updateTokenRuntime(tokenId: string, runtimeUpdates: Partial<TokenRuntime>): void {
		this.mutateAndBroadcast((draft) => {
			const token = draft.tokens[tokenId]
			if (token?.runtime) {
				Object.assign(token.runtime, runtimeUpdates)
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

	addPlayer(playerId: string, player: { sessionId: string; nickname: string; role: "HOST" | "PLAYER"; isReady: boolean; connected: boolean; tokenIds?: string[]; avatar?: string }): void {
		this.mutateAndBroadcast((draft) => {
			draft.players[playerId] = player
		})
	}

	removePlayer(playerId: string): void {
		this.mutateAndBroadcast((draft) => {
			delete draft.players[playerId]
		})
	}

	updatePlayer(playerId: string, updates: Partial<{ sessionId: string; nickname: string; role: "HOST" | "PLAYER"; isReady: boolean; connected: boolean; tokenIds: string[]; avatar: string; faction: string }>): void {
		this.mutateAndBroadcast((draft) => {
			const player = draft.players[playerId]
			if (player) {
				Object.assign(player, updates)
			}
		})
	}

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
		if (phase === "PLAYER_ACTION") {
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