import type { HealthStatusDTO } from "@vt/types";

export const toHealthDto = (startedAt: number, now = Date.now()): HealthStatusDTO => ({
	status: "ok",
	uptimeSec: Math.floor((now - startedAt) / 1000),
});