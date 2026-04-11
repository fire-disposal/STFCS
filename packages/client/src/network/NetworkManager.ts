import { Client, type Room } from "colyseus.js";
import type { ConnectionQuality, GameRoomState } from "@vt/shared";

export interface ConnectionStats {
  rttMs: number;
  jitterMs: number;
  quality: ConnectionQuality;
  lastUpdatedAt: number;
}

export type ConnectionStatsListener = (stats: ConnectionStats) => void;

export class NetworkManager {
  private static readonly RECONNECT_TOKEN_KEY = "stfcs:reconnectToken";
  private static readonly PING_INTERVAL_MS = 2000;

  private client: Client;
  private room: Room<GameRoomState> | null = null;
  private pingTimer: number | null = null;
  private pingSeq = 0;
  private readonly statsListeners = new Set<ConnectionStatsListener>();
  private connectionStats: ConnectionStats = {
    rttMs: -1,
    jitterMs: 0,
    quality: "offline",
    lastUpdatedAt: 0,
  };

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  private bindRoom(room: Room<GameRoomState>) {
    this.room = room;

    if (room.reconnectionToken) {
      localStorage.setItem(NetworkManager.RECONNECT_TOKEN_KEY, room.reconnectionToken);
    }

    room.onMessage("NET_PONG", (payload: {
      seq: number;
      pingMs: number;
      jitterMs: number;
      quality: ConnectionQuality;
      serverTime: number;
    }) => {
      this.connectionStats = {
        rttMs: payload.pingMs,
        jitterMs: payload.jitterMs,
        quality: payload.quality,
        lastUpdatedAt: payload.serverTime,
      };
      this.emitConnectionStats();
    });

    this.startPingProbe();

    room.onLeave(() => {
      this.stopPingProbe();
      this.room = null;
      this.connectionStats = {
        rttMs: -1,
        jitterMs: 0,
        quality: "offline",
        lastUpdatedAt: Date.now(),
      };
      this.emitConnectionStats();
    });
  }

  private emitConnectionStats() {
    for (const listener of this.statsListeners) {
      listener(this.connectionStats);
    }
  }

  private startPingProbe() {
    this.stopPingProbe();

    this.pingTimer = window.setInterval(() => {
      if (!this.room) {
        return;
      }
      this.pingSeq += 1;
      this.room.send("NET_PING", {
        seq: this.pingSeq,
        clientSentAt: Date.now(),
      });
    }, NetworkManager.PING_INTERVAL_MS);
  }

  private stopPingProbe() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  getConnectionStats(): ConnectionStats {
    return this.connectionStats;
  }

  subscribeConnectionStats(listener: ConnectionStatsListener): () => void {
    this.statsListeners.add(listener);
    listener(this.connectionStats);
    return () => this.statsListeners.delete(listener);
  }

  async reconnectBattle(): Promise<Room<GameRoomState> | null> {
    const token = localStorage.getItem(NetworkManager.RECONNECT_TOKEN_KEY);
    if (!token) {
      return null;
    }

    try {
      const room = await this.client.reconnect<GameRoomState>(token);
      this.bindRoom(room);
      return room;
    } catch {
      localStorage.removeItem(NetworkManager.RECONNECT_TOKEN_KEY);
      return null;
    }
  }

  async joinBattle(name: string): Promise<Room<GameRoomState>> {
    const reconnected = await this.reconnectBattle();
    if (reconnected) {
      return reconnected;
    }

    const room = await this.client.joinOrCreate<GameRoomState>("battle", {
      name,
    });
    this.bindRoom(room);
    return room;
  }

  getRoom(): Room<GameRoomState> | null {
    return this.room;
  }

  async leave(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
    this.stopPingProbe();
    localStorage.removeItem(NetworkManager.RECONNECT_TOKEN_KEY);
  }
}
