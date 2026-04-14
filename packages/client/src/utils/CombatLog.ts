/**
 * Combat Log Utility (Client-side)
 */

export type LogType =
	| "move"
	| "shield"
	| "fire"
	| "damage"
	| "flux"
	| "overload"
	| "phase"
	| "system"
	| "dm";

export type LogLevel = "info" | "warning" | "error" | "success";

export interface CombatLogEntry {
	id: string;
	type: LogType;
	level: LogLevel;
	message: string;
	timestamp: number;
	round: number;
	phase: string;
	data?: Record<string, unknown>;
}

export interface LogFilter {
	types: LogType[];
	levels: LogLevel[];
	searchQuery?: string;
}

class CombatLogManager {
	private logs: CombatLogEntry[] = [];
	private maxLogs = 500;
	private subscribers = new Set<(logs: CombatLogEntry[]) => void>();

	addLog(
		type: LogType,
		message: string,
		level: LogLevel = "info",
		data?: Record<string, unknown>,
		round?: number,
		phase?: string
	): CombatLogEntry {
		const entry: CombatLogEntry = {
			id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type,
			level,
			message,
			timestamp: Date.now(),
			round: round ?? 1,
			phase: phase ?? "unknown",
			data,
		};

		this.logs.push(entry);

		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		this.notifySubscribers();
		return entry;
	}

	getLogs(): CombatLogEntry[] {
		return [...this.logs];
	}

	clear(): void {
		this.logs = [];
		this.notifySubscribers();
	}

	subscribe(callback: (logs: CombatLogEntry[]) => void): () => void {
		this.subscribers.add(callback);
		return () => this.subscribers.delete(callback);
	}

	exportToJson(): string {
		return JSON.stringify(this.logs, null, 2);
	}

	private notifySubscribers(): void {
		const logsCopy = [...this.logs];
		for (const callback of this.subscribers) {
			callback(logsCopy);
		}
	}
}

export const combatLog = new CombatLogManager();
