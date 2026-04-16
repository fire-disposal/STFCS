/**
 * 健康检查 DTO 转换器
 */

import type { HealthStatusDTO } from "../schema/types.js";

export const toHealthStatusDto = (uptimeSec: number): HealthStatusDTO => ({
	status: "ok",
	uptimeSec,
});