/**
 * Schema 索引
 *
 * Zod 时代：schema 定义统一在 core/GameSchemas.ts 中维护。
 * 此文件保留用于兼容性，指向新的 Zod Schema 对象。
 */

import {
	CombatTokenSchema,
	InventoryTokenSchema,
	WeaponJSONSchema,
	PlayerProfileSchema,
	GameSaveSchema,
	GameMapSchema,
} from "../core/GameSchemas.js";

/** Schema 对象映射（运行时验证用） */
export const SCHEMAS = {
	inventoryToken: InventoryTokenSchema,
	combatToken: CombatTokenSchema,
	weapon: WeaponJSONSchema,
	player: PlayerProfileSchema,
	save: GameSaveSchema,
	map: GameMapSchema,
} as const;

/** Schema 版本 */
export const SCHEMA_VERSIONS = {
	inventoryToken: "1.0.0",
	combatToken: "1.0.0",
	weapon: "2.0.0",
	player: "1.0.0",
	save: "1.0.0",
	map: "1.0.0",
} as const;

/**
 * 获取 Zod Schema 对象
 */
export function getSchema(schemaName: keyof typeof SCHEMAS) {
	return SCHEMAS[schemaName];
}

/**
 * 验证数据（使用 Zod）
 */
export function validateData<T extends keyof typeof SCHEMAS>(
	schemaName: T,
	data: unknown
): typeof SCHEMAS[T] extends import("zod").ZodTypeAny
	? import("zod").infer<typeof SCHEMAS[T]>
	: never {
	const schema = SCHEMAS[schemaName];
	return schema.parse(data) as any;
}
