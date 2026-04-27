import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import {
	useGameState,
	useGameRoomId,
	useGamePlayers,
	useGamePlayerId,
	useGameStore,
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
import React, { useState, useMemo, useCallback } from "react";
import type { SocketNetworkManager } from "@/network";
import BattlePanel from "@/ui/panels/BattlePanel";
import ShipInfoPanel from "@/ui/panels/ShipInfoPanel";
import MovementPanel from "@/ui/panels/MovementPanel";
import WeaponPanel from "@/ui/panels/WeaponPanel";
import ShieldPanel from "@/ui/panels/ShieldPanel";
import TopBar from "@/ui/panels/TopBar";
import RightSidebar from "@/ui/panels/RightSidebar";
import { useGameAction } from "@/hooks/useGameAction";
import { Avatar } from "@/ui/shared/Avatar";
import { useAssetSocket } from "@/hooks/useAssetSocket";
import "@/ui/panels/room-player-list.css";

interface GamePageProps {
	networkManager: SocketNetworkManager;
	onLeaveRoom: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ networkManager, onLeaveRoom }) => {
	useSocketRoom(networkManager, onLeaveRoom);

	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);
	const [draftHpPerBar, setDraftHpPerBar] = useState(20);

	const socket = networkManager.getSocket();
	const assetSocket = useAssetSocket(socket);

	React.useEffect(() => {
		if (!socket) return;
		socket.on("response", assetSocket.handleResponse);
		return () => {
			socket.off("response", assetSocket.handleResponse);
		};
	}, [socket, assetSocket.handleResponse]);

	const hpPerBar = useUIStore((state) => state.hpPerBar);
	const setHpPerBar = useUIStore((state) => state.setHpPerBar);
	const suppressContextMenu = useUIStore((state) => state.suppressContextMenu);
	const toggleSuppressContextMenu = useUIStore((state) => state.toggleSuppressContextMenu);

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

	// 仅保留 GamePage 自身需要的数据，不再为子组件抽取 props
	const gameState = useGameState();
	const players = useGamePlayers();
	const roomId = useGameRoomId();
	const playerId = useGamePlayerId();

	const { send } = useGameAction();

	const currentPlayer = playerId ? players[playerId] : undefined;
	const isHost = currentPlayer?.role === "HOST";

	const handleAdvancePhase = useCallback(async () => {
		const currentPhase = useGameStore.getState().state?.phase;
		if (!currentPhase) return;

		try {
			if (currentPhase === "DEPLOYMENT") {
				await send("room:action", { action: "start" });
			} else if (currentPhase === "PLAYER_ACTION") {
				await send("edit:room", { action: "force_end_turn" });
			}
		} catch {
			// 错误已由 useGameAction 中的 notify.error 处理
		}
	}, [send]);

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
	], [networkManager, isHost]);

	if (!gameState || !roomId) {
		return (
			<Box style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
				<Text color="gray">连接中...</Text>
				<Text size="1" color="gray">{networkManager.getCurrentRoomId() ? "同步状态..." : "等待房间..."}</Text>
			</Box>
		);
	}

	const connectedPlayers = Object.values(players).filter((p) => p.connected);

	return (
		<Box style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a0e14", color: "#cfe8ff" }}>
			<TopBar
				onReadyToggle={() => networkManager.setReady()}
				onAdvancePhase={handleAdvancePhase}
				onSettings={() => setShowSettings(true)}
				onLeave={onLeaveRoom}
				onFactionChange={(playerId, faction) => {
					send("edit:room", { action: "set_faction", playerId, faction });
				}}
			/>

			<Box style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
				<Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
					<PixiCanvas fetchAssets={assetSocket.batchGet} />
				</Box>

				<RightSidebar networkManager={networkManager} />
			</Box>

			<BattlePanel tabs={tabs} defaultActiveTab="ship-info" />

			<Dialog.Root open={showPlayerRoster} onOpenChange={setShowPlayerRoster}>
				<Dialog.Content style={{ maxWidth: 400 }}>
					<Dialog.Title>
						<Flex align="center" gap="2">
							<Users size={16} /> 玩家列表
						</Flex>
					</Dialog.Title>
					<div className="room-player-list room-player-list--detailed">
						{connectedPlayers.map((p) => (
							<div
								key={p.sessionId}
								className={`room-player-item ${p.sessionId === playerId ? "room-player-item--self" : ""}`}
							>
								<Avatar userName={p.nickname} size={32} />
								<div className="room-player-info">
									<span className="room-player-name">{p.nickname}</span>
									{p.role === "HOST" && (
										<span className="room-player-badge room-player-badge--dm">
											<Crown size={12} />
										</span>
									)}
								</div>
								<div className={`room-player-status ${p.isReady ? "room-player-status--ready" : "room-player-status--not-ready"}`}>
									{p.isReady ? <CheckCircle size={14} /> : <XCircle size={14} />}
								</div>
							</div>
						))}
					</div>
					<Flex justify="end" gap="2" mt="4">
						{isHost && (
							<Button variant="soft" onClick={() => {
								navigator.clipboard.writeText(networkManager.buildInviteLink(roomId));
								notify.success("邀请链接已复制");
							}}>
								邀请链接
							</Button>
						)}
						<Button variant="soft" color="red" onClick={onLeaveRoom}>离开房间</Button>
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
	);
};

export default GamePage;