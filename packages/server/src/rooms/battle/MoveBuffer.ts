/**
 * 移动命令缓冲管理
 */

import type { Client } from "@colyseus/core";
import type { MoveTokenPayload } from "../../commands/types.js";
import { toErrorDto } from "../../dto/index.js";
import type { CommandDispatcher } from "../../commands/CommandDispatcher.js";

interface BufferedMoveCommand {
	client: Client;
	payload: MoveTokenPayload;
}

export class MoveBuffer {
	private buffer = new Map<string, BufferedMoveCommand>();

	/** 缓冲移动命令 */
	enqueue(shipId: string, client: Client, payload: MoveTokenPayload): void {
		this.buffer.set(shipId, { client, payload });
	}

	/** 执行所有缓冲的移动命令 */
	flush(dispatcher: CommandDispatcher): void {
		if (this.buffer.size === 0) return;
		const commands = Array.from(this.buffer.values());
		this.buffer.clear();
		for (const cmd of commands) {
			try {
				dispatcher.dispatchMoveToken(cmd.client, cmd.payload);
			} catch (error) {
				cmd.client.send("error", toErrorDto((error as Error).message));
			}
		}
	}

	/** 清空缓冲 */
	clear(): void {
		this.buffer.clear();
	}

	/** 获取缓冲数量 */
	get size(): number {
		return this.buffer.size;
	}
}