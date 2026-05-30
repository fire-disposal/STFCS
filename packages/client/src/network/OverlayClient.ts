import type { Socket } from "socket.io-client";
import type { OverlaySyncPayload } from "@vt/data";
import { playPingSound } from "@/utils/sound";

type PushCb = (type: string, payload: any) => void;
type SyncCb = (sync: OverlaySyncPayload) => void;

export class OverlayClient {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private pushCb: PushCb | null = null;
  private syncCb: SyncCb | null = null;
  private cursorThrottle = 0;
  private drawThrottles = new Map<string, number>();
  private viewportThrottle = 0;

  init(socket: Socket, roomId: string, playerId: string): void {
    this.socket = socket; this.roomId = roomId; this.playerId = playerId;
    socket.on("overlay_push", (msg: { type: string; payload: any }) => {
      this.pushCb?.(msg.type, msg.payload);
    });
    socket.on("overlay_sync", (sync: OverlaySyncPayload) => {
      this.syncCb?.(sync);
    });
  }

  destroy(): void {
    this.socket?.off("overlay_push");
    this.socket?.off("overlay_sync");
    this.socket = null; this.roomId = null;
    this.pushCb = null; this.syncCb = null;
  }

  subscribePush(cb: PushCb): void { this.pushCb = cb; }
  subscribeSync(cb: SyncCb): void { this.syncCb = cb; }

  private send(type: string, payload: unknown): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("overlay_send", { roomId: this.roomId, type, payload });
  }

  sendCursor(x: number, y: number, color: string): void {
    if (performance.now() - this.cursorThrottle < 50) return;
    this.cursorThrottle = performance.now();
    this.send("cursor", { playerId: this.playerId, x, y, color });
  }

  sendPing(x: number, y: number, color: string): void {
    playPingSound();
    this.send("ping", {
      pingId: `${this.playerId}_${Date.now()}`, playerId: this.playerId,
      x, y, color, timestamp: Date.now(),
    });
  }

  sendDrawStream(strokeId: string, x: number, y: number, color: string, lineWidth: number): void {
    if (performance.now() - (this.drawThrottles.get(strokeId) ?? 0) < 20) return;
    this.drawThrottles.set(strokeId, performance.now());
    this.send("draw_stream", { strokeId, playerId: this.playerId, x, y, color, lineWidth });
  }

  sendDrawCommit(strokeId: string, tool: string, color: string, lineWidth: number, points: { x: number; y: number }[]): void {
    this.send("draw_commit", { strokeId, playerId: this.playerId, tool, color, lineWidth, points });
    this.drawThrottles.delete(strokeId);
  }

  sendNote(op: string, id: string, x: number, y: number, text: string | undefined, color: string): void {
    this.send("note", { op, id, playerId: this.playerId, x, y, text, color });
  }

  sendViewport(cx: number, cy: number, zoom: number, rotation: number, sw: number, sh: number, color: string): void {
    if (performance.now() - this.viewportThrottle < 200) return;
    this.viewportThrottle = performance.now();
    this.send("viewport", { playerId: this.playerId, cx, cy, zoom, rotation, sw, sh, color });
  }

  sendClear(scope: "all" | "player", targetId?: string): void {
    this.send("clear", { scope, targetId });
  }
}
