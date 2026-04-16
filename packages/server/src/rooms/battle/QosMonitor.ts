/**
 * 网络质量监控
 */

import type { ConnectionQualityValue } from "@vt/data";
import { ConnectionQuality } from "@vt/data";

export class QosMonitor {
	private pingEwma = new Map<string, number>();
	private jitterEwma = new Map<string, number>();

	/** 更新网络质量采样 */
	updateSample(sessionId: string, sampleRtt: number): ConnectionQualityValue {
		const prev = this.pingEwma.get(sessionId) ?? -1;
		const rtt = prev < 0 ? sampleRtt : prev * 0.8 + sampleRtt * 0.2;
		const jitter =
			(this.jitterEwma.get(sessionId) ?? 0) * 0.7 +
			Math.abs(sampleRtt - (prev < 0 ? sampleRtt : prev)) * 0.3;

		this.pingEwma.set(sessionId, rtt);
		this.jitterEwma.set(sessionId, jitter);

		return this.classifyQuality(rtt);
	}

	/** 分类连接质量 */
	private classifyQuality(rtt: number): ConnectionQualityValue {
		if (rtt <= 80) return ConnectionQuality.EXCELLENT;
		if (rtt <= 140) return ConnectionQuality.GOOD;
		if (rtt <= 220) return ConnectionQuality.FAIR;
		return ConnectionQuality.POOR;
	}

	/** 获取玩家的 ping 值 */
	getPing(sessionId: string): number {
		return Math.round(this.pingEwma.get(sessionId) ?? -1);
	}

	/** 获取玩家的 jitter 值 */
	getJitter(sessionId: string): number {
		return Math.round(this.jitterEwma.get(sessionId) ?? 0);
	}

	/** 移除玩家监控数据 */
	remove(sessionId: string): void {
		this.pingEwma.delete(sessionId);
		this.jitterEwma.delete(sessionId);
	}

	/** 初始化玩家监控 */
	init(sessionId: string): void {
		this.pingEwma.set(sessionId, -1);
		this.jitterEwma.set(sessionId, 0);
	}
}