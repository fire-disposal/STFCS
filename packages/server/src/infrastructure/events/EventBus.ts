/**
 * 领域事件总线
 * 用于解耦 Domain 层和 Infrastructure 层
 * Domain 实体发布事件，Infrastructure 订阅并处理（如 WS 广播）
 */

export type EventHandler<T = unknown> = (event: T) => void;

export interface IEventBus {
	subscribe<T>(eventType: string, handler: EventHandler<T>): void;
	unsubscribe<T>(eventType: string, handler?: EventHandler<T>): void;
	publish<T>(eventType: string, event: T): void;
	clear(): void;
}

export class EventBus implements IEventBus {
	private _handlers: Map<string, Set<EventHandler>>;

	constructor() {
		this._handlers = new Map();
	}

	subscribe<T>(eventType: string, handler: EventHandler<T>): void {
		let handlers = this._handlers.get(eventType);
		if (!handlers) {
			handlers = new Set();
			this._handlers.set(eventType, handlers);
		}
		handlers.add(handler as EventHandler);
	}

	unsubscribe<T>(eventType: string, handler?: EventHandler<T>): void {
		const handlers = this._handlers.get(eventType);
		if (!handlers) return;

		if (handler === undefined) {
			this._handlers.delete(eventType);
		} else {
			handlers.delete(handler as EventHandler);
			if (handlers.size === 0) {
				this._handlers.delete(eventType);
			}
		}
	}

	publish<T>(eventType: string, event: T): void {
		const handlers = this._handlers.get(eventType);
		if (!handlers) return;

		for (const handler of handlers) {
			try {
				(handler as EventHandler<T>)(event);
			} catch (error) {
				console.error(`Error in event handler for ${eventType}:`, error);
			}
		}
	}

	clear(): void {
		this._handlers.clear();
	}

	getHandlerCount(eventType: string): number {
		const handlers = this._handlers.get(eventType);
		return handlers?.size ?? 0;
	}
}

export default EventBus;
