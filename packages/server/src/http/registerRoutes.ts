import type { Express, Request, Response } from "express";
import { matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";

/**
 * 注册 HTTP 路由
 * 
 * 简化后只保留：
 * - /health - 健康检查
 * - /matchmake - 房间列表（Colyseus 标准）
 * - /colyseus - Monitor（需要认证）
 * - DELETE /api/rooms/:roomId - 删除房间
 */
export function registerHttpRoutes(app: Express): void {
  // 健康检查
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptimeSec: Math.floor((Date.now() - app.get("startedAt")) / 1000),
    });
  });

  // 房间列表（Colyseus 标准端点）
  app.get("/matchmake", async (_req: Request, res: Response) => {
    try {
      const rooms = await matchMaker.query({ name: "battle" });

      res.json(rooms.map((room) => {
        const metadata = (room.metadata as Record<string, unknown> | undefined) || {};
        return {
          roomId: room.roomId,
          name: room.name,
          clients: room.clients,
          maxClients: room.maxClients,
          roomType: room.name,
          metadata,
        };
      }));
    } catch (error) {
      console.error("[Server] Error in /matchmake:", error);
      res.json([]);
    }
  });

  // 删除房间
  app.delete("/api/rooms/:roomId", async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const shortIdValue = req.header("x-short-id") || req.query.shortId;
      const shortId = Number(shortIdValue);

      if (!roomId) {
        return res.status(400).json({ success: false, message: "缺少房间 ID" });
      }

      if (!Number.isInteger(shortId) || shortId < 100000 || shortId > 999999) {
        return res.status(400).json({ success: false, message: "缺少有效的房主标识" });
      }

      const rooms = await matchMaker.query({ name: "battle" });
      const room = rooms.find((item) => item.roomId === roomId);

      if (!room) {
        return res.status(404).json({ success: false, message: "房间不存在或已删除" });
      }

      const metadata = (room.metadata as Record<string, unknown> | undefined) || {};
      const ownerShortId = Number(metadata.ownerShortId);

      if (!Number.isInteger(ownerShortId) || ownerShortId !== shortId) {
        return res.status(403).json({ success: false, message: "仅房主可删除房间" });
      }

      await matchMaker.remoteRoomCall(roomId, "disconnect", []);
      return res.json({ success: true });
    } catch (error) {
      console.error("[Server] Delete room error:", error);
      return res.status(500).json({ success: false, message: "删除房间失败" });
    }
  });

  // Colyseus Monitor（建议添加简单认证）
  app.use("/colyseus", monitor());
}
