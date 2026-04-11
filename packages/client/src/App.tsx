import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import {
  ClientCommand,
  type GameRoomState,
  type ShipState,
  type PlayerState,
} from "@vt/shared";
import { DEFAULT_WS_URL } from "@/config";
import { NetworkManager, type ConnectionStats } from "@/network/NetworkManager";
import { PlayerRosterManager, type PlayerView } from "@/network/PlayerRosterManager";
import { GameCanvas } from "@/components/map/GameCanvas";
import { useUIStore } from "@/store/uiStore";

const App: React.FC = () => {
  const [name, setName] = useState("Player");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [stateVersion, setStateVersion] = useState(0);
  const [roster, setRoster] = useState<PlayerView[]>([]);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    rttMs: -1,
    jitterMs: 0,
    quality: "offline",
    lastUpdatedAt: 0,
  });

  const networkRef = useRef<NetworkManager | null>(null);
  const rosterManagerRef = useRef<PlayerRosterManager | null>(null);
  const rosterUnsubRef = useRef<(() => void) | null>(null);
  const qualityUnsubRef = useRef<(() => void) | null>(null);
  const roomRef = useRef<Room<GameRoomState> | null>(null);
  const {
    zoom,
    cameraPosition,
    showGrid,
    selectedShipId,
    setZoom,
    setCameraPosition,
    toggleGrid,
    selectShip,
  } = useUIStore();

  const roomState = roomRef.current?.state;

  const players = useMemo(() => {
    const result: Array<{ id: string; value: PlayerState }> = [];
    roomState?.players?.forEach((value, id) => result.push({ id, value }));
    return result;
  }, [roomState, stateVersion]);

  const ships = useMemo(() => {
    const result: Array<{ id: string; value: ShipState }> = [];
    roomState?.ships?.forEach((value, id) => result.push({ id, value }));
    return result;
  }, [roomState, stateVersion]);

  useEffect(() => {
    return () => {
      rosterUnsubRef.current?.();
      qualityUnsubRef.current?.();
      rosterManagerRef.current?.stop();
      roomRef.current?.leave();
    };
  }, []);

  const formatJoinError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    if (/response\.room is undefined|can't access property\s+"name"/i.test(message)) {
      return "加入失败：服务端返回了异常房间数据。请确认 server 已启动，并检查前后端 Colyseus 版本是否一致。";
    }
    if (/not found/i.test(message)) {
      return `加入失败：未找到房间处理器。请确认服务端已启动（默认 2567）且地址正确：${DEFAULT_WS_URL}`;
    }
    return message;
  };

  const connectAndJoin = async () => {
    try {
      setError(null);
      setConnecting(true);

      const network = new NetworkManager(DEFAULT_WS_URL);
      networkRef.current = network;
      setConnected(true);

      const room = await network.joinBattle(name.trim() || "Player");
      roomRef.current = room;
      setJoined(true);

      qualityUnsubRef.current?.();
      qualityUnsubRef.current = network.subscribeConnectionStats((stats) => {
        setConnectionStats(stats);
      });

      rosterUnsubRef.current?.();
      rosterManagerRef.current?.stop();
      const rosterManager = new PlayerRosterManager(room);
      rosterManager.start();
      rosterManagerRef.current = rosterManager;
      rosterUnsubRef.current = rosterManager.subscribe((nextRoster) => {
        setRoster(nextRoster);
      });

      room.onStateChange(() => {
        setStateVersion((v) => v + 1);
      });

      room.onLeave((code) => {
        rosterUnsubRef.current?.();
        qualityUnsubRef.current?.();
        rosterManagerRef.current?.stop();
        rosterUnsubRef.current = null;
        qualityUnsubRef.current = null;
        rosterManagerRef.current = null;
        setRoster([]);
        setJoined(false);
        setConnected(false);
        setError(`连接断开，code=${code}`);
      });

      room.onError((code, message) => {
        setError(`房间错误(${code}): ${message}`);
      });

      room.onMessage("error", (payload: { message?: string }) => {
        if (payload?.message) {
          setError(payload.message);
        }
      });
    } catch (e) {
      setError(formatJoinError(e));
      setConnected(false);
      setJoined(false);
    } finally {
      setConnecting(false);
    }
  };

  const leaveRoom = async () => {
    rosterUnsubRef.current?.();
    qualityUnsubRef.current?.();
    rosterManagerRef.current?.stop();
    rosterUnsubRef.current = null;
    qualityUnsubRef.current = null;
    rosterManagerRef.current = null;
    await networkRef.current?.leave();
    roomRef.current = null;
    setRoster([]);
    setJoined(false);
    setConnected(false);
    setStateVersion(0);
  };

  const sendReady = (isReady: boolean) => {
    roomRef.current?.send(ClientCommand.CMD_TOGGLE_READY, { isReady });
  };

  const nextPhase = () => {
    roomRef.current?.send(ClientCommand.CMD_NEXT_PHASE);
  };

  const createPlayerShip = () => {
    roomRef.current?.send("CREATE_TEST_SHIP", {
      faction: "player",
      x: Math.random() * 400 - 200,
      y: Math.random() * 400 - 200,
    });
  };

  const createDMShip = () => {
    roomRef.current?.send("CREATE_TEST_SHIP", {
      faction: "dm",
      x: Math.random() * 400 + 200,
      y: Math.random() * 400 + 200,
    });
  };

  const shipsForCanvas = useMemo(() => ships.map((s) => s.value), [ships]);

  return (
    <div className="app">
      {!joined ? (
        <div className="connection-view">
          <div className="connection-card" style={{ maxWidth: 560 }}>
            <h2>加入 STFCS</h2>
            <p className="connection-description">输入玩家名称并加入战斗房间。</p>

            {error ? (
              <div className="connection-error">
                <p>{error}</p>
              </div>
            ) : null}

            <div className="connection-form">
              <div className="form-group">
                <label htmlFor="player-name">玩家名称</label>
                <input
                  id="player-name"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入玩家名"
                  maxLength={32}
                  disabled={connecting}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !connecting) {
                      void connectAndJoin();
                    }
                  }}
                />
              </div>

              <div className="form-actions">
                <button className="connect-button" onClick={connectAndJoin} disabled={connecting}>
                  {connecting ? (
                    <>
                      <span className="spinner" />
                      连接中...
                    </>
                  ) : (
                    "连接并加入 battle"
                  )}
                </button>
              </div>

              <div className="connection-status-text">
                服务端地址: {DEFAULT_WS_URL} / 连接状态: {connected ? "已连接" : "未连接"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: 16, fontFamily: "sans-serif" }}>
            <h2>STFCS / Colyseus 主线</h2>
            <div style={{ marginBottom: 12 }}>
              <div>服务端地址: {DEFAULT_WS_URL}</div>
              <div>连接状态: {joined ? "已加入 battle" : connected ? "已连接" : "未连接"}</div>
              <div>
                本地连接质量: {connectionStats.quality} / RTT={connectionStats.rttMs}ms / jitter={connectionStats.jitterMs}ms
              </div>
              {error ? <div style={{ color: "red" }}>错误: {error}</div> : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => sendReady(true)}>准备</button>
              <button onClick={() => sendReady(false)}>取消准备</button>
              <button onClick={nextPhase}>下一阶段（DM）</button>
              <button onClick={createPlayerShip}>创建玩家舰船（DM）</button>
              <button onClick={createDMShip}>创建DM舰船（DM）</button>
              <button onClick={leaveRoom}>离开</button>
            </div>
          </div>
        </>
      )}

      {roomState ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <section>
            <h3>战术地图（Pixi / 分图层）</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <button type="button" onClick={() => setZoom(zoom + 0.1)}>缩放 +</button>
              <button type="button" onClick={() => setZoom(zoom - 0.1)}>缩放 -</button>
              <button type="button" onClick={() => setCameraPosition(cameraPosition.x - 80, cameraPosition.y)}>←</button>
              <button type="button" onClick={() => setCameraPosition(cameraPosition.x + 80, cameraPosition.y)}>→</button>
              <button type="button" onClick={() => setCameraPosition(cameraPosition.x, cameraPosition.y - 80)}>↑</button>
              <button type="button" onClick={() => setCameraPosition(cameraPosition.x, cameraPosition.y + 80)}>↓</button>
              <button type="button" onClick={toggleGrid}>网格: {showGrid ? "开" : "关"}</button>
            </div>
            <GameCanvas
              ships={shipsForCanvas}
              zoom={zoom}
              cameraX={cameraPosition.x}
              cameraY={cameraPosition.y}
              showGrid={showGrid}
              selectedShipId={selectedShipId}
              onSelectShip={(shipId) => selectShip(shipId)}
            />
          </section>

          <section>
            <h3>房间状态</h3>
            <div>Phase: {roomState.currentPhase}</div>
            <div>Turn: {roomState.turnCount}</div>
            <div>ActiveFaction: {roomState.activeFaction}</div>
          </section>

          <section>
            <h3>玩家 ({roster.length || players.length})</h3>
            <ul>
              {(roster.length > 0
                ? roster.map((p) => ({
                    key: p.sessionId,
                    label: `${p.name} / ${p.role} / ready=${String(p.isReady)} / online=${String(p.connected)} / ${p.quality}(${p.pingMs}ms)`
                  }))
                : players.map((p) => ({
                    key: p.id,
                    label: `${p.value.name} / ${p.value.role} / ready=${String(p.value.isReady)} / online=${String(p.value.connected)}`
                  }))).map((item) => (
                <li key={item.key}>
                  {item.label}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>舰船 ({ships.length})</h3>
            <ul>
              {ships.map((s) => (
                <li key={s.id}>
                  {s.id} | faction={s.value.faction} | owner={s.value.ownerId || "(none)"} |
                  pos=({s.value.transform.x.toFixed(1)}, {s.value.transform.y.toFixed(1)}) |
                  heading={s.value.transform.heading.toFixed(1)} |
                  flux={s.value.fluxHard + s.value.fluxSoft}/{s.value.fluxMax}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default App;