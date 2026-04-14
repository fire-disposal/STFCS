import { matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import type { Express, Request, Response } from "express";

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

			res.json(
				rooms.map((room) => {
					const metadata = (room.metadata as Record<string, unknown> | undefined) || {};
					return {
						roomId: room.roomId,
						name: room.name,
						clients: room.clients,
						maxClients: room.maxClients,
						roomType: room.name,
						metadata,
					};
				})
			);
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

	// ==================== 存档相关 API ====================

	// 获取存档列表
	app.get("/api/saves", async (_req: Request, res: Response) => {
		try {
			const saves = await saveStore.list();
			res.json({ success: true, saves });
		} catch (error) {
			console.error("[Server] List saves error:", error);
			res.status(500).json({ success: false, message: "获取存档列表失败" });
		}
	});

	// 获取存档详情
	app.get("/api/saves/:saveId", async (req: Request, res: Response) => {
		try {
			const saveId = String(req.params.saveId || "").trim();
			if (!saveId) {
				return res.status(400).json({ success: false, message: "缺少存档 ID" });
			}

			const summary = await saveStore.getSummary(saveId);
			res.json({ success: true, summary });
		} catch (error) {
			console.error("[Server] Get save error:", error);
			res.status(404).json({ success: false, message: "存档不存在" });
		}
	});

	// 删除存档
	app.delete("/api/saves/:saveId", async (req: Request, res: Response) => {
		try {
			const saveId = String(req.params.saveId || "").trim();
			if (!saveId) {
				return res.status(400).json({ success: false, message: "缺少存档 ID" });
			}

			await saveStore.delete(saveId);
			res.json({ success: true });
		} catch (error) {
			console.error("[Server] Delete save error:", error);
			res.status(500).json({ success: false, message: "删除存档失败" });
		}
	});

	// 导出存档（下载 JSON 文件）
	app.get("/api/saves/:saveId/export", async (req: Request, res: Response) => {
		try {
			const saveId = String(req.params.saveId || "").trim();
			if (!saveId) {
				return res.status(400).json({ success: false, message: "缺少存档 ID" });
			}

			const saveData = await saveStore.load(saveId);

			res.setHeader("Content-Type", "application/json");
			res.setHeader("Content-Disposition", `attachment; filename="${saveData.saveName}.json"`);
			res.json(saveData);
		} catch (error) {
			console.error("[Server] Export save error:", error);
			res.status(404).json({ success: false, message: "存档不存在" });
		}
	});

	// 导入存档（上传 JSON 文件）
	app.post("/api/saves/import", async (req: Request, res: Response) => {
		try {
			const saveData = req.body;

			// 验证基本字段
			if (!saveData.saveId || !saveData.saveName || !saveData.roomId) {
				return res.status(400).json({ success: false, message: "无效的存档数据" });
			}

			// 保存
			await saveStore.save(saveData);

			res.json({ success: true, saveId: saveData.saveId });
		} catch (error) {
			console.error("[Server] Import save error:", error);
			res.status(400).json({ success: false, message: "导入存档失败" });
		}
	});
}
