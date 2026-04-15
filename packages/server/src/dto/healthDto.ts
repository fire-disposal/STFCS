/**
 * 健康检查 DTO
 */

import type { HealthStatusDTO } from "../schema/types.js";

export const toHealthDto = (startedAt: number, now = Date.now()): HealthStatusDTO => ({
	status: "ok",
	uptimeSec: Math.floor((now - startedAt) / 1000),
});