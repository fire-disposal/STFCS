import type { Room } from "colyseus.js";
import type { ConnectionQuality, GameRoomState } from "@vt/shared";

export interface PlayerView {
  sessionId: string;
  name: string;
  role: "dm" | "player";
  isReady: boolean;
  connected: boolean;
  pingMs: number;
  jitterMs: number;
  quality: ConnectionQuality;
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
    const players: PlayerView[] = [];

    this.room.state.players.forEach((p, id) => {
      players.push({
        sessionId: id,
        name: p.name,
        role: p.role,
        isReady: p.isReady,
        connected: p.connected,
        pingMs: p.pingMs,
        jitterMs: p.jitterMs,
        quality: p.connectionQuality,
      });
    });

    return players.sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === "dm" ? -1 : 1;
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
