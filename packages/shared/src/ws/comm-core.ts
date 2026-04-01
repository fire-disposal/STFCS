export type CoreCommandOperation =
	| "session.hello"
	| "session.resume"
	| "session.leave"
	| "presence.update"
	| "chat.send"
	| "object.upsert"
	| "object.remove"
	| "state.get";

export interface CommandEnvelope<T = unknown> {
	type: "command";
	commandId: string;
	actorId: string;
	op: CoreCommandOperation;
	payload: T;
	sentAt: number;
}

export interface PatchEnvelope<T = unknown> {
	type: "patch";
	revision: number;
	eventId: string;
	op: string;
	payload: T;
	emittedAt: number;
}

export interface AckEnvelope {
	type: "ack";
	commandId: string;
	accepted: boolean;
	errorCode?: string;
	message?: string;
}

export function isCommandEnvelope(message: unknown): message is CommandEnvelope {
	if (!message || typeof message !== "object") {
		return false;
	}
	const candidate = message as Partial<CommandEnvelope>;
	return candidate.type === "command" && typeof candidate.commandId === "string" && typeof candidate.op === "string";
}
