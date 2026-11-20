import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import {
	useGameState,
	useGameRoomId,
	useGamePlayers,
	useGamePlayerId,
} from "@/state/stores/gameStore";
import { useSocketRoom } from "@/network";
import { notify } from "@/ui/shared/Notification";
import type { TabConfig } from "@/ui/panels/BattlePanel";
import {
	Box,
	Flex,
	Text,
	Button,
	Dialog,
	TextField,
	Switch,
	Separator,
} from "@radix-ui/themes";
import { Crown, Settings, Users, CheckCircle, XCircle, Info, Move, Crosshair, Shield } from "lucide-react";
import React, { useState, useMemo, useRef } from "react";
import type { SocketNetworkManager } from "@/network";
import { ErrorBoundary } from "@/ui/shared/ErrorBoundary";
import BattlePanel from "@/ui/panels/BattlePanel";
import ShipInfoPanel from "@/ui/panels/ShipInfoPanel";
import MovementPanel from "@/ui/panels/MovementPanel";
import WeaponPanel from "@/ui/panels/WeaponPanel";
import ShieldPanel from "@/ui/panels/ShieldPanel";
import TopBar from "@/ui/panels/TopBar";
import RightSidebar from "@/ui/panels/RightSidebar";
import { useGameAction } from "@/hooks/useGameAction";
import { Avatar } from "@/ui/shared/Avatar";
import { OverlayClient } from "@/network/OverlayClient";
import type { OverlayHandlers } from "@/renderer/core/PixiCanvas";
import { OverlayToolbar } from "@/ui/panels/OverlayToolbar";
import { DicePanel } from "@/ui/panels/DicePanel";
import { PLAYER_OVERLAY_COLORS } from "@vt/data";
import { screenToWorld } from "@/utils/coordinateSystem";
import { copyText } from "@/utils/clipboard";
import "@/ui/panels/room-player-list.css";

interface GamePageProps {
	networkManager: SocketNetworkManager;
	onLeaveRoom: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ networkManager, onLeaveRoom }) => {
	useSocketRoom(networkManager, onLeaveRoom);

	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);
	const [showShortcuts, setShowShortcuts] = useState(false);
	const [draftHpPerBar, setDraftHpPerBar] = useState(20);
	const overlayClientRef = useRef<OverlayClient | null>(null);
	const [overlayHandlers, setOverlayHandlers] = useState<OverlayHandlers | null>(null);
	const overlayHandlersRef = useRef<OverlayHandlers | null>(null);
	overlayHandlersRef.current = overlayHandlers;

	const socket = networkManager.getSocket();

	const gameState = useGameState();
	const players = useGamePlayers();
	const roomId = useGameRoomId();
	const playerId = useGamePlayerId();

	React.useEffect(() => {
		if (!socket || !roomId || !playerId) return;
		const client = new OverlayClient();
		client.init(socket, roomId, playerId);
		overlayClientRef.current = client;

		const onPush = (type: string, payload: any) => {
			const h = overlayHandlersRef.current;
			if (!h) return;
			switch (type) {
				case "cursor": h.onCursor(payload); break;
				case "ping": h.onPing(payload); break;
				case "ping_remove": h.onPingRemove(payload); break;
				case "draw_stream": h.onDrawStream(payload); break;
				case "draw_commit": h.onDrawCommit(payload); break;
				case "note": h.onNote(payload); break;
				case "viewport": h.onViewport(payload); break;
				case "clear": h.onClearDrawings(payload); h.onClearNotes(payload); break;
			}
		};
		const onSync = (sync: any) => {
			const h = overlayHandlersRef.current;
			if (!h) return;
			for (const d of sync.drawings ?? []) h.onDrawCommit(d);
			for (const n of sync.notes ?? []) h.onNote(n);
			for (const v of sync.viewports ?? []) h.onViewport(v);
			for (const p of sync.pings ?? []) h.onPing(p);
		};
		client.subscribePush(onPush);
		client.subscribeSync(onSync);

		return () => { client.destroy(); overlayClientRef.current = null; };
	}, [socket, roomId, playerId]);

	const hpPerBar = useUIStore((state) => state.hpPerBar);
	const setHpPerBar = useUIStore((state) => state.setHpPerBar);
	const suppressContextMenu = useUIStore((state) => state.suppressContextMenu);
	const toggleSuppressContextMenu = useUIStore((state) => state.toggleSuppressContextMenu);

	React.useEffect(() => {
		if (showSettings) setDraftHpPerBar(hpPerBar);
	}, [showSettings, hpPerBar]);

	// 全局拦截右键菜单（设置页开关控制）
	React.useEffect(() => {
		const handleContextMenu = (e: MouseEvent) => {
			if (suppressContextMenu) {
				e.preventDefault();
			}
		};
		document.addEventListener("contextmenu", handleContextMenu);
		return () => document.removeEventListener("contextmenu", handleContextMenu);
	}, [suppressContextMenu]);

	React.useEffect(() => {
		if (!overlayClientRef.current || !playerId) return;
		let lastKey = "";
		const interval = setInterval(() => {
			const cam = useUIStore.getState();
			const idx = Object.keys(players ?? {}).indexOf(playerId);
			const color = PLAYER_OVERLAY_COLORS[idx >= 0 ? (idx % PLAYER_OVERLAY_COLORS.length) : 0];
			const key = `${cam.cameraPosition.x.toFixed(1)}|${cam.cameraPosition.y.toFixed(1)}|${cam.zoom.toFixed(3)}|${cam.viewRotation}`;
			if (key === lastKey) return;
			lastKey = key;
			overlayClientRef.current?.sendViewport(
				cam.cameraPosition.x, cam.cameraPosition.y,
				cam.zoom, cam.viewRotation,
				window.innerWidth, window.innerHeight, color
			);
		}, 500);
		return () => clearInterval(interval);
	}, [players, playerId]);

	React.useEffect(() => {
		const host = document.getElementById("game-canvas-host");
		if (!host || !playerId) return;
		const idx = Object.keys(players ?? {}).indexOf(playerId);
		const color = PLAYER_OVERLAY_COLORS[idx >= 0 ? (idx % PLAYER_OVERLAY_COLORS.length) : 0];

		let lastCursorAt = 0;
		const onMove = (e: MouseEvent) => {
			if (!overlayClientRef.current) return;
			const now = performance.now();
			if (now - lastCursorAt < 33) return;
			lastCursorAt = now;
			const rect = host.getBoundingClientRect();
			const sx = e.clientX - rect.left - rect.width / 2;
			const sy = e.clientY - rect.top - rect.height / 2;
			const cam = useUIStore.getState();
			const wp = screenToWorld(sx, sy, cam.zoom, cam.cameraPosition.x, cam.cameraPosition.y, cam.viewRotation);
			overlayClientRef.current.sendCursor(wp.x, wp.y, color);
		};
		host.addEventListener("mousemove", onMove);
		return () => host.removeEventListener("mousemove", onMove);
	}, [players, playerId]);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			const active = document.activeElement;
			if (
				active instanceof HTMLElement &&
				(active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
			) {
				return;
			}
			if (e.target instanceof Element && e.target.closest('[role="dialog"]')) {
				return;
			}
			const store = useUIStore.getState();
			if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
				e.preventDefault();
				setShowShortcuts((open) => !open);
				return;
			}
			switch (e.key.toLowerCase()) {
				case "d": store.setOverlayMode(store.overlayMode === "pen" ? "none" : "pen"); break;
				case "a": store.setOverlayMode(store.overlayMode === "arrow" ? "none" : "arrow"); break;
				case "p": store.setOverlayMode(store.overlayMode === "ping" ? "none" : "ping"); break;
				case "t": store.setOverlayMode(store.overlayMode === "note" ? "none" : "note"); break;
				case "escape":
					if (store.overlayMode !== "none") store.setOverlayMode("none");
					else store.selectShip(null);
					break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const { send } = useGameAction();

	const currentPlayer = playerId ? players[playerId] : undefined;
	const isHost = currentPlayer?.role === "HOST";

	// 底部栏仅保留核心战斗Tab
	const tabs: TabConfig[] = useMemo(() => [
		{
			id: "ship-info",
			label: "舰船信息",
			icon: <Info size={14} />,
			component: <ShipInfoPanel />,
			enabled: true,
		},
		{
			id: "movement",
			label: "移动控制",
			icon: <Move size={14} />,
			component: <MovementPanel canControl={true} />,
			enabled: true,
		},
		{
			id: "weapon",
			label: "武器火控",
			icon: <Crosshair size={14} />,
			component: <WeaponPanel canControl={true} />,
			enabled: true,
		},
		{
			id: "shield",
			label: "护盾管理",
			icon: <Shield size={14} />,
			component: <ShieldPanel canControl={true} />,
			enabled: true,
		},
	], []);

	if (!gameState || !roomId) {
		return (
			<Box style={{
				height: "100vh", display: "flex", flexDirection: "column",
				alignItems: "center", justifyContent: "center", gap: 16,
				background: "#0a0e14",
			}}>
				<div style={{
					width: 48, height: 48,
					border: "2px solid rgba(74, 158, 255, 0.2)",
					borderTopColor: "rgba(74, 158, 255, 0.7)",
					borderRadius: "50%",
					animation: "spin 1s linear infinite",
				}} />
				<Text size="2" style={{ color: "#6b8aaa" }}>
					{networkManager.getCurrentRoomId() ? "同步状态..." : "等待房间..."}
				</Text>
			</Box>
		);
	}

	const connectedPlayers = Object.entries(players).filter(([, p]) => p.connected);

	return (
		<ErrorBoundary>
		<Box style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a0e14", color: "#cfe8ff" }}>
			<TopBar
				onSettings={() => setShowSettings(true)}
				onLeave={onLeaveRoom}
				onPlayers={() => setShowPlayerRoster(true)}
				onHelp={() => setShowShortcuts(true)}
				onFactionChange={(playerId, faction) => {
					send("edit:room", { action: "set_faction", playerId, faction });
				}}
				onFactionDelete={(factionId) => {
					send("edit:faction:delete", { factionId });
				}}
			/>

			<Box style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
				<Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
					<PixiCanvas
						onOverlaySetup={setOverlayHandlers}
						overlayClientRef={overlayClientRef}
					/>
					<OverlayToolbar
						onClearMyAnnotations={() => overlayClientRef.current?.sendClear("player", playerId ?? undefined)}
					/>
					<DicePanel />
				</Box>

				<RightSidebar networkManager={networkManager} />
			</Box>

			<BattlePanel tabs={tabs} />

			<Dialog.Root open={showPlayerRoster} onOpenChange={setShowPlayerRoster}>
				<Dialog.Content style={{ maxWidth: 460 }}>
					<Dialog.Title>
						<Flex align="center" gap="2">
							<Users size={16} /> 玩家与邀请
						</Flex>
					</Dialog.Title>
					<Dialog.Description size="1" color="gray" mb="3">
						房间 {roomId} · {connectedPlayers.length} 人在线
					</Dialog.Description>
					<div className="room-player-list room-player-list--detailed">
						{connectedPlayers.map(([id, p]) => (
							<div
								key={p.sessionId}
								className={`room-player-item ${id === playerId ? "room-player-item--self" : ""}`}
							>
								<Avatar userName={p.nickname} size={32} />
								<div className="room-player-info">
									<span className="room-player-name">{p.nickname}</span>
									<span className="room-player-meta">
										{p.role === "HOST" ? (
											<span className="room-player-badge room-player-badge--dm">
												<Crown size={11} /> DM
											</span>
										) : null}
										<span
											className="room-player-faction"
											style={p.faction ? { borderColor: gameState.factions?.[p.faction]?.color ?? "transparent" } : undefined}
										>
											{p.faction ? (gameState.factions?.[p.faction]?.name ?? "未命名派系") : "未选派系"}
										</span>
									</span>
								</div>
								<div className={`room-player-status ${p.isReady ? "room-player-status--ready" : "room-player-status--not-ready"}`}>
									{p.isReady ? <CheckCircle size={14} /> : <XCircle size={14} />}
								</div>
								{isHost && id !== playerId && (
									<Button
										size="1"
										variant="ghost"
										color="red"
										onClick={() => void send("room:action", { action: "kick", targetId: id })}
									>
										移出
									</Button>
								)}
							</div>
						))}
					</div>
					<Flex justify="between" align="center" gap="2" mt="4">
						<Button
							variant="soft"
							onClick={async () => {
								const link = networkManager.buildInviteLink(roomId);
								const copied = await copyText(link);
								notify[copied ? "success" : "error"](copied ? "邀请链接已复制" : `复制失败：${link}`);
							}}
						>
							复制邀请链接
						</Button>
						<Button variant="soft" color="red" onClick={onLeaveRoom}>离开房间</Button>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>

			<Dialog.Root open={showShortcuts} onOpenChange={setShowShortcuts}>
				<Dialog.Content style={{ maxWidth: 420 }}>
					<Dialog.Title>快捷键</Dialog.Title>
					<Dialog.Description size="1" color="gray" mb="3">
						标注模式下左键绘制，标注外左键选择舰船。
					</Dialog.Description>
					<Flex direction="column" gap="2">
						{[
							["右键拖拽", "平移视野"],
							["中键拖拽", "旋转视野"],
							["滚轮", "缩放"],
							["D", "画笔"],
							["A", "箭头"],
							["P", "信标"],
							["T", "便签"],
							["Esc", "退出标注 / 取消选中"],
							["?", "打开或关闭本页"],
						].map(([key, action]) => (
							<Flex key={key} justify="between" align="center">
								<Text size="2">{action}</Text>
								<Text size="1" className="shortcut-key">{key}</Text>
							</Flex>
						))}
					</Flex>
				</Dialog.Content>
			</Dialog.Root>

			<Dialog.Root open={showSettings} onOpenChange={(open) => {
				if (!open) {
					setDraftHpPerBar(hpPerBar);
				}
				setShowSettings(open);
			}}>
				<Dialog.Content style={{ maxWidth: 400 }}>
					<Dialog.Title>
						<Flex align="center" gap="2">
							<Settings size={16} /> 设置
						</Flex>
					</Dialog.Title>
					<Flex direction="column" gap="3">
						<Text size="1" weight="bold" color="gray">血条显示</Text>
						<Flex align="center" justify="between">
							<Text size="2">血条单位HP</Text>
							<TextField.Root
								size="1"
								value={draftHpPerBar.toString()}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftHpPerBar(Number(e.target.value) || 20)}
								style={{ width: 60 }}
							/>
						</Flex>
						<Text size="1" color="gray">每个 | 符号代表的HP数量</Text>

						<Separator size="4" />

						<Text size="1" weight="bold" color="gray">交互</Text>
						<Flex align="center" justify="between">
							<Text size="2">禁用右键菜单</Text>
							<Switch size="1" checked={suppressContextMenu} onCheckedChange={toggleSuppressContextMenu} />
						</Flex>
						<Text size="1" color="gray">拦截浏览器右键菜单，提升右键拖拽体验</Text>

						<Separator size="4" />

						<Flex justify="end" gap="2">
							<Button size="1" variant="soft" color="gray" onClick={() => {
								setDraftHpPerBar(hpPerBar);
								setShowSettings(false);
							}}>
								取消
							</Button>
							<Button size="1" variant="solid" onClick={() => {
								setHpPerBar(draftHpPerBar);
								setShowSettings(false);
							}}>
								保存
							</Button>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		</Box>
		</ErrorBoundary>
	);
};

export default GamePage;