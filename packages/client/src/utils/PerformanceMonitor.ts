/**
 * 性能监控工具 - 用于跟踪联机游戏性能指标
 *
 * 监控指标：
 * - 状态同步频率
 * - 网络带宽使用
 * - 渲染性能
 * - 帧率
 */

export interface PerfMetrics {
	// 状态同步
	stateChangesPerSecond: number;
	lastStateChangeTime: number;

	// 网络
	networkBytesReceived: number;
	networkMessagesPerSecond: number;
	lastMessageTime: number;

	// 渲染
	renderCount: number;
	lastRenderTime: number;
	shipRenderCount: number;

	// 帧率
	fps: number;
	frameCount: number;
	lastFpsUpdate: number;
}

class PerformanceMonitor {
	private metrics: PerfMetrics = {
		stateChangesPerSecond: 0,
		lastStateChangeTime: 0,
		networkBytesReceived: 0,
		networkMessagesPerSecond: 0,
		lastMessageTime: 0,
		renderCount: 0,
		lastRenderTime: 0,
		shipRenderCount: 0,
		fps: 0,
		frameCount: 0,
		lastFpsUpdate: 0,
	};

	private stateChangeCount = 0;
	private messageCount = 0;
	private frameId: number | null = null;
	private listeners = new Set<(metrics: PerfMetrics) => void>();

	/**
	 * 开始监控
	 */
	start(): void {
		if (this.frameId !== null) return;

		const loop = () => {
			this.updateFps();
			this.frameId = requestAnimationFrame(loop);
		};

		this.frameId = requestAnimationFrame(loop);
		console.log("[PerfMonitor] Started");
	}

	/**
	 * 停止监控
	 */
	stop(): void {
		if (this.frameId !== null) {
			cancelAnimationFrame(this.frameId);
			this.frameId = null;
		}
		console.log("[PerfMonitor] Stopped");
	}

	/**
	 * 记录状态变化
	 */
	recordStateChange(): void {
		this.stateChangeCount++;
		this.metrics.lastStateChangeTime = performance.now();
	}

	/**
	 * 记录网络消息
	 */
	recordNetworkMessage(bytes?: number): void {
		this.messageCount++;
		this.metrics.lastMessageTime = performance.now();

		if (bytes !== undefined) {
			this.metrics.networkBytesReceived += bytes;
		}
	}

	/**
	 * 记录渲染
	 */
	recordRender(shipCount?: number): void {
		this.metrics.renderCount++;
		this.metrics.lastRenderTime = performance.now();

		if (shipCount !== undefined) {
			this.metrics.shipRenderCount = shipCount;
		}
	}

	/**
	 * 获取当前指标
	 */
	getMetrics(): PerfMetrics {
		return { ...this.metrics };
	}

	/**
	 * 获取 FPS
	 */
	getFps(): number {
		return this.metrics.fps;
	}

	/**
	 * 获取状态同步频率（次/秒）
	 */
	getStateChangesPerSecond(): number {
		return this.metrics.stateChangesPerSecond;
	}

	/**
	 * 获取网络消息频率（次/秒）
	 */
	getNetworkMessagesPerSecond(): number {
		return this.metrics.networkMessagesPerSecond;
	}

	/**
	 * 订阅指标更新
	 */
	subscribe(listener: (metrics: PerfMetrics) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * 打印性能报告
	 */
	printReport(): void {
		console.group("📊 性能报告");
		console.log(`FPS: ${this.metrics.fps}`);
		console.log(`状态同步：${this.metrics.stateChangesPerSecond.toFixed(1)} 次/秒`);
		console.log(`网络消息：${this.metrics.networkMessagesPerSecond.toFixed(1)} 次/秒`);
		console.log(`网络流量：${(this.metrics.networkBytesReceived / 1024).toFixed(2)} KB`);
		console.log(`渲染次数：${this.metrics.renderCount}`);
		console.log(`舰船渲染：${this.metrics.shipRenderCount}`);
		console.groupEnd();
	}

	private updateFps(): void {
		const now = performance.now();
		this.metrics.frameCount++;

		// 每秒更新一次 FPS
		if (now - this.metrics.lastFpsUpdate >= 1000) {
			this.metrics.fps = Math.round(
				(this.metrics.frameCount * 1000) / (now - this.metrics.lastFpsUpdate)
			);
			this.metrics.frameCount = 0;
			this.metrics.lastFpsUpdate = now;

			// 更新频率指标
			this.metrics.stateChangesPerSecond = this.stateChangeCount;
			this.metrics.networkMessagesPerSecond = this.messageCount;

			this.stateChangeCount = 0;
			this.messageCount = 0;

			// 通知监听器
			this.listeners.forEach((listener) => listener(this.metrics));
		}
	}
}

// 单例实例
export const perfMonitor = new PerformanceMonitor();

/**
 * 网络监控包装器 - 装饰 fetch 和 WebSocket
 */
export function enableNetworkMonitoring(): void {
	// 监控 fetch
	const originalFetch = window.fetch;
	window.fetch = function (...args) {
		return originalFetch.apply(this, args).then((response) => {
			const contentLength = response.headers.get("content-length");
			if (contentLength) {
				perfMonitor.recordNetworkMessage(parseInt(contentLength));
			} else {
				perfMonitor.recordNetworkMessage();
			}
			return response;
		});
	};

	console.log("[PerfMonitor] Network monitoring enabled");
}
