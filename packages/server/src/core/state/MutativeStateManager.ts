/**
 * MutativeStateManager - 基于 Mutative 的状态管理器
 *
 * 特点：
 * 1. 使用 draft 模式修改状态，自动生成 patches
 * 2. inversePatches 提旧值，用于日志和撤销
 * 3. 统一的变更广播机制
 */

import { create, type Draft, type Patch } from "mutative"
import type { Server as IOServer } from "socket.io"
import type { 
	GameRoomState,
	StatePatch, 
	StatePatchPayload,
	BattleLogEdit,
	BattleLogPayload,
	CombatToken,
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

export class MutativeStateManager {
	private state: GameRoomState
	private io: IOServer
	private roomId: string

	constructor(io: IOServer, roomId: string, initialState: GameRoomState) {
		this.io = io
		this.roomId = roomId
		this.state = initialState
	}

	getState(): GameRoomState {
		return this.state
	}

	mutate(mutator: (draft: Draft<GameRoomState>) => void): MutateResult {
		const [newState, patches, inversePatches] = create(
			this.state,
			mutator,
			{ enablePatches: true }
		)
		this.state = newState
		return { patches, inversePatches }
	}

	mutateAndBroadcast(mutator: (draft: Draft<GameRoomState>) => void): MutateResult {
		const result = this.mutate(mutator)
		this.broadcastPatches(result.patches)
		return result
	}

	mutateWithLog(
		mutator: (draft: Draft<GameRoomState>) => void,
		logContext: EditLogContext
	): MutateResult {
		const result = this.mutate(mutator)
		
		this.broadcastPatches(result.patches)
		
		for (const invPatch of result.inversePatches) {
			const invPath = invPatch.path as (string | number)[];
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
		
		return result
	}

	setState(newState: GameRoomState): void {
		this.state = newState
	}

	broadcastFull(): void {
		this.io.to(this.roomId).emit("sync:full", this.state)
	}

	private broadcastPatches(patches: Patch[]): void {
		if (patches.length === 0) return
		
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

	setToken(tokenId: string, token: CombatToken): void {
		this.mutateAndBroadcast(draft => {
			draft.tokens[tokenId] = token
		})
	}

	removeToken(tokenId: string): void {
		this.mutateAndBroadcast(draft => {
			delete draft.tokens[tokenId]
		})
	}
}