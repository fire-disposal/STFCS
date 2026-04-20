/**
 * 运行时数据修改服务
 *
 * 核心职责：
 * 1. 权限控制：普通玩家只能编辑自己的舰船，DM 可以操作一切
 * 2. 增量更新：应用路径更新，生成变更记录
 * 3. 状态广播：将变更通知房间内所有玩家
 * 4. 日志集成：记录变更到战斗日志
 */

import type { ShipTokenState } from "../../core/state/Token.js";
import type { PlayerState } from "../../core/types/common.js";
import {
	applyPathUpdates,
	describeChanges,
	type DataChange,
} from "../../core/engine/utils/incrementalUpdate.js";
import { createLogger } from "../../infra/simple-logger.js";

const logger = createLogger("data-update");

/**
 * 数据修改结果
 */
export interface DataUpdateResult {
	success: boolean;
	changes: DataChange[];
	objectType: string;
	objectId: string;
	error?: string;
}

/**
 * 权限检查结果
 */
export interface PermissionCheck {
	allowed: boolean;
	reason?: string;
	isDM: boolean;
}

/**
 * 检查玩家是否有权限修改指定对象
 */
export function checkPermission(
	player: PlayerState,
	objectType: string,
	objectId: string,
	objectOwnerId?: string
): PermissionCheck {
	// DM 拥有所有权限
	if (player.role === "OWNER") {
		return { allowed: true, isDM: true };
	}

	// 观察者无权限
	if (player.role === "OBSERVER") {
		return { allowed: false, reason: "Observers cannot modify objects", isDM: false };
	}

	// 普通玩家权限检查
	switch (objectType) {
		case "ship":
		case "token": {
			// 只能修改自己拥有的舰船
			if (objectOwnerId === player.id) {
				return { allowed: true, isDM: false };
			}
			return {
				allowed: false,
				reason: `You can only modify your own ships (owner: ${objectOwnerId}, you: ${player.id})`,
				isDM: false,
			};
		}

		case "player": {
			// 只能修改自己的玩家数据
			if (objectId === player.id) {
				return { allowed: true, isDM: false };
			}
			return {
				allowed: false,
				reason: "You can only modify your own player data",
				isDM: false,
			};
		}

		case "component": {
			// 组件修改需要检查所属舰船
			return { allowed: false, reason: "Component modification requires ship ownership", isDM: false };
		}

		default:
			return { allowed: false, reason: `Unknown object type: ${objectType}`, isDM: false };
	}
}

/**
 * 验证数据更新是否合法
 * 防止修改危险字段（如 id、schema 等）
 */
export function validateUpdate(
	objectType: string,
	updates: Record<string, unknown>,
	isDM: boolean
): { valid: boolean; error?: string; filteredUpdates: Record<string, unknown> } {
	const protectedPaths = [
		"$id",
		"$schema",
		"id",
		"type",
	];

	// DM 可以修改更多字段，但 schema/id 仍然保护
	const filteredUpdates: Record<string, unknown> = {};

	for (const [path, value] of Object.entries(updates)) {
		// 检查是否是受保护路径
		const isProtected = protectedPaths.some(protectedPath =>
			path === protectedPath || path.startsWith(`${protectedPath}.`)
		);

		if (isProtected) {
			logger.warn(`Protected path blocked: ${path}`);
			continue;
		}

		// 普通玩家不能修改 ship 规格（只能修改 runtime）
		if (!isDM && objectType === "ship") {
			if (path.startsWith("ship.") && !path.startsWith("ship.runtime")) {
				logger.warn(`Player attempted to modify ship spec: ${path}`);
				continue;
			}
		}

		filteredUpdates[path] = value;
	}

	if (Object.keys(filteredUpdates).length === 0) {
		return { valid: false, error: "No valid updates provided", filteredUpdates };
	}

	return { valid: true, filteredUpdates };
}

/**
 * 应用舰船数据更新
 */
export function applyShipUpdate(
	ship: ShipTokenState,
	updates: Record<string, unknown>
): DataUpdateResult {
	// 应用更新到 runtime
	const runtimeChanges = applyPathUpdates(
		ship.runtime as unknown as Record<string, unknown>,
		updates
	);

	// 应用更新到 ship spec（如果有 shipJson）
	let specChanges: DataChange[] = [];
	const specUpdates: Record<string, unknown> = {};

	for (const [path, value] of Object.entries(updates)) {
		if (path.startsWith("ship.")) {
			const specPath = path.replace("ship.", "");
			specUpdates[specPath] = value;
		}
	}

	if (ship.shipJson && Object.keys(specUpdates).length > 0) {
		specChanges = applyPathUpdates(
			ship.shipJson.ship as unknown as Record<string, unknown>,
			specUpdates
		);
		// 更新路径前缀
		specChanges = specChanges.map(c => ({
			...c,
			path: `ship.${c.path}`,
		}));
	}

	// 合并变更
	const allChanges = [...runtimeChanges, ...specChanges];

	// 重新计算派生状态
	if (ship.shipJson) {
		recalculateDerivedStates(ship);
	}

	return {
		success: true,
		changes: allChanges,
		objectType: "ship",
		objectId: ship.id,
	};
}

/**
 * 应用玩家数据更新
 */
export function applyPlayerUpdate(
	player: PlayerState,
	updates: Record<string, unknown>
): DataUpdateResult {
	const changes = applyPathUpdates(
		player as unknown as Record<string, unknown>,
		updates
	);

	return {
		success: true,
		changes,
		objectType: "player",
		objectId: player.id,
	};
}

/**
 * 重新计算舰船的派生状态
 */
function recalculateDerivedStates(ship: ShipTokenState): void {
	// 重新计算 combatState
	const { calculateCombatState } = require("../../core/state/Token.js");
	ship.combatState = calculateCombatState(ship.shipJson.ship, ship.runtime);

	// 重新计算 movementState
	const { calculateMovementState } = require("../../core/state/Token.js");
	ship.movementState = calculateMovementState(
		ship.shipJson.ship,
		ship.runtime.movement || {}
	);
}

/**
 * 创建 DM 日志条目
 */
export function createLogEntry(
	playerName: string,
	playerRole: string,
	objectType: string,
	objectId: string,
	objectName: string,
	changes: DataChange[]
): Record<string, unknown> {
	const descriptions = describeChanges(changes);

	return {
		type: "DATA_MODIFICATION",
		source: playerName,
		role: playerRole,
		objectType,
		objectId,
		objectName,
		changes: descriptions,
		timestamp: Date.now(),
	};
}
