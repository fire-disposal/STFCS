import type { PingPayload, DrawCommitPayload, NotePayload, ViewportPayload } from "@vt/data";

export class OverlayStateCache {
  drawings = new Map<string, DrawCommitPayload>();
  notes = new Map<string, NotePayload>();
  viewports = new Map<string, ViewportPayload>();
  pings = new Map<string, { payload: PingPayload; timeout: ReturnType<typeof setTimeout> }>();

  clearByPlayer(playerId: string): void {
    for (const [k, d] of this.drawings) { if (d.playerId === playerId) this.drawings.delete(k); }
    for (const [k, n] of this.notes) { if (n.playerId === playerId) this.notes.delete(k); }
  }

  getSyncPayload() {
    return {
      drawings: Array.from(this.drawings.values()),
      notes: Array.from(this.notes.values()),
      viewports: Array.from(this.viewports.values()),
      pings: Array.from(this.pings.values())
        .filter(p => Date.now() - p.payload.timestamp < 3000)
        .map(p => p.payload),
    };
  }
}

export class OverlayRelay {
  private caches = new Map<string, OverlayStateCache>();

  private getCache(roomId: string): OverlayStateCache {
    let c = this.caches.get(roomId);
    if (!c) { c = new OverlayStateCache(); this.caches.set(roomId, c); }
    return c;
  }

  handle(io: any, socket: any, roomId: string, _senderId: string, type: string, payload: any): void {
    const cache = this.getCache(roomId);
    const toOthers = (msg: any, volatile?: boolean) => {
      if (volatile) socket.to(roomId).volatile.emit("overlay_push", msg);
      else socket.to(roomId).emit("overlay_push", msg);
    };
    const toAll = (msg: any, volatile?: boolean) => {
      if (volatile) io.to(roomId).volatile.emit("overlay_push", msg);
      else io.to(roomId).emit("overlay_push", msg);
    };

    switch (type) {
      case "cursor":
        toOthers({ type, payload }, true);
        break;

      case "ping": {
        const p = payload as PingPayload;
        const t = setTimeout(() => {
          cache.pings.delete(p.pingId);
          toAll({ type: "ping_remove", payload: { pingId: p.pingId } });
        }, 3000);
        cache.pings.set(p.pingId, { payload: p, timeout: t });
        toAll({ type, payload });
        break;
      }

      case "draw_stream":
        toAll({ type, payload }, true);
        break;

      case "draw_commit": {
        const d = payload as DrawCommitPayload;
        cache.drawings.set(d.strokeId, d);
        toAll({ type, payload });
        break;
      }

      case "note": {
        const n = payload as NotePayload;
        if (n.op === "create" || n.op === "move") cache.notes.set(n.id, n);
        else cache.notes.delete(n.id);
        toAll({ type, payload });
        break;
      }

      case "viewport":
        cache.viewports.set(payload.playerId, payload);
        toOthers({ type, payload }, true);
        break;

      case "clear":
        if (payload.scope === "all") { cache.drawings.clear(); cache.notes.clear(); }
        else if (payload.scope === "player") cache.clearByPlayer(payload.targetId);
        toAll({ type, payload });
        break;
    }
  }

  sendSync(socket: any, roomId: string): void {
    const cache = this.caches.get(roomId);
    if (cache) socket.emit("overlay_sync", cache.getSyncPayload());
  }

  removeRoom(roomId: string): void {
    const cache = this.caches.get(roomId);
    if (cache) { for (const p of cache.pings.values()) clearTimeout(p.timeout); }
    this.caches.delete(roomId);
  }
}

export const overlayRelay = new OverlayRelay();
