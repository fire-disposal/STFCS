import type { Room } from "@colyseus/sdk";
import type { ConnectionQualityValue, GameRoomState, PlayerRoleValue } from "@vt/types";

export interface PlayerView {
	sessionId: string;
	shortId: number;
	name: string;
	role: PlayerRoleValue;
	isReady: boolean;
	connected: boolean;
	pingMs: number;
	jitterMs: number;
	quality: ConnectionQualityValue;
}

export type PlayerRosterListener = (players: PlayerView[]) => void;

export class PlayerRosterManager {
	private readonly room: Room<GameRoomState>;
	private readonly listeners = new Set<PlayerRosterListener>();
	private readonly stateListener = () => {
		this.emit();
	};

	constructor(room: Room<GameRoomState>) {
		this.room = room;
	}

	start() {
		this.stop();

		this.room.onStateChange(this.stateListener);

		this.emit();
	}

	stop() {
		this.room.onStateChange.remove(this.stateListener);
	}

	subscribe(listener: PlayerRosterListener): () => void {
		this.listeners.add(listener);
		listener(this.getPlayers());

		return () => {
			this.listeners.delete(listener);
		};
	}

	getPlayers(): PlayerView[] {
		const playersByIdentity = new Map<string, PlayerView>();

		for (const [id, p] of (this.room.state.players as Map<string, any>).entries()) {
			const shortId = (p as { shortId?: number }).shortId ?? 0;
			const playerView: PlayerView = {
				sessionId: id,
				shortId,
				name: p.name,
				role: p.role,
				isReady: p.isReady,
				connected: p.connected,
				pingMs: p.pingMs,
				jitterMs: p.jitterMs,
				quality: p.connectionQuality,
			};

			const identityKey = shortId > 0 ? `short:${shortId}` : `session:${id}`;
			const current = playersByIdentity.get(identityKey);

			if (!current) {
				playersByIdentity.set(identityKey, playerView);
				continue;
			}

			const shouldReplace =
				(playerView.connected && !current.connected) ||
				playerView.sessionId === this.room.sessionId ||
				(current.pingMs < 0 && playerView.pingMs >= 0);

			if (shouldReplace) {
				playersByIdentity.set(identityKey, playerView);
			}
		}

		return Array.from(playersByIdentity.values()).sort((a, b) => {
			if (a.role !== b.role) {
				return a.role === "DM" ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
	}

	private emit() {
		const players = this.getPlayers();
		for (const listener of this.listeners) {
			listener(players);
		}
	}
}
