/**
 * JSON Schema 索引
 *
 * 提供所有JSON Schema的引用路径
 */

export const SCHEMA_BASE_PATH = "./schemas";

export const SCHEMA_FILES = {
	common: `${SCHEMA_BASE_PATH}/common.schema.json`,
	ship: `${SCHEMA_BASE_PATH}/ship.schema.json`,
	weapon: `${SCHEMA_BASE_PATH}/weapon.schema.json`,
	save: `${SCHEMA_BASE_PATH}/save.schema.json`,
	export: `${SCHEMA_BASE_PATH}/export.schema.json`,
	presets: `${SCHEMA_BASE_PATH}/presets.schema.json`,
};

export const SCHEMA_VERSIONS = {
	common: "1.0.0",
	ship: "1.0.0",
	weapon: "1.0.0",
	save: "1.0.0",
	export: "1.0.0",
	presets: "1.0.0",
};

/**
 * 获取Schema引用URL
 */
export function getSchemaRef(schemaName: keyof typeof SCHEMA_FILES): string {
	return SCHEMA_FILES[schemaName];
}

/**
 * 验证Schema版本
 */
export function validateSchemaVersion(
	data: { $schema?: string; $version?: string },
	expectedSchema: keyof typeof SCHEMA_VERSIONS
): boolean {
	const expectedVersion = SCHEMA_VERSIONS[expectedSchema];
	return data.$version === expectedVersion;
}