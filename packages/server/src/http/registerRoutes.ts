import { matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import type { Express, Request, Response } from "express";
import { toHealthDto, toMatchmakeRoomDto } from "../dto/index.js";

/**
 * 注册 HTTP 路由
 *
 * 简化后只保留：
 * - /health - 健康检查
 * - /matchmake - 房间列表（Colyseus 标准）
 * - /colyseus - Monitor（需要认证）
 */
export function registerHttpRoutes(app: Express): void {
	// 健康检查
	app.get("/health", (_req: Request, res: Response) => {
		res.json(toHealthDto(app.get("startedAt")));
	});

	// 房间列表（Colyseus 标准端点）
	app.get("/matchmake", async (_req: Request, res: Response) => {
		try {
			const rooms = await matchMaker.query({ name: "battle" });

			res.json(rooms.map((room) => toMatchmakeRoomDto(room)));
		} catch (error) {
			console.error("[Server] Error in /matchmake:", error);
			res.json([]);
		}
	});

	// Colyseus Monitor（建议添加简单认证）
	app.use("/colyseus", monitor());
}
