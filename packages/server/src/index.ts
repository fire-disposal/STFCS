import express from "express";
import { createServer } from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import cors from "cors";
import { BattleRoom } from "./rooms/BattleRoom";

const app = express();
app.use(cors());
app.use(express.json());
const startedAt = Date.now();

// 创建HTTP服务器
const server = createServer(app);

// 创建Colyseus服务器
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

// 注册房间
gameServer.define("battle", BattleRoom);

// 监控面板
app.use("/colyseus", monitor());

// 健康检查
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  });
});

const PORT = process.env.PORT || 2567;

gameServer.listen(Number(PORT));
console.log(`STFCS server listening on ws://localhost:${PORT}`);
