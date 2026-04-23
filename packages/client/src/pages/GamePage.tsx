import { GamePhase } from "@vt/data";
import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import { useSocketRoom, useTokens } from "@/network";
import { notify } from "@/ui/shared/Notification";
import type { TabConfig } from "@/ui/panels/BattlePanel";
import {
	Box,
	Flex,
	Card,
	Text,
	Badge,
	Button,
	Dialog,
	IconButton,
	DropdownMenu,
} from "@radix-ui/themes";
import { Crown, LogOut, Settings, Users, CheckCircle, XCircle, Info, Edit, Move, Crosshair, Shield, Eye, Rocket, FastForward, ChevronDown } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import type { SocketNetworkManager } from "@/network";
import BattlePanel from "@/ui/panels/BattlePanel";
import ShipInfoPanel from "@/ui/panels/ShipInfoPanel";
import MovementPanel from "@/ui/panels/MovementPanel";
import WeaponPanel from "@/ui/panels/WeaponPanel";
import ShieldPanel from "@/ui/panels/ShieldPanel";
import RealityEditPanel from "@/ui/panels/RealityEditPanel";
import ViewControlPanel from "@/ui/panels/ViewControlPanel";
import ShipPresetPanel from "@/ui/panels/ShipPresetPanel";
import DMControlPanel from "@/ui/panels/DMControlPanel";
import { useGameAction } from "@/hooks/useGameAction";
import RoomPlayerList from "@/ui/panels/RoomPlayerList";
import { Avatar } from "@/ui/shared/Avatar";
import { useAssetSocket } from "@/hooks/useAssetSocket";
import "@/ui/panels/room-player-list.css";

const PHASE_NAMES: Record<string, string> = {
	DEPLOYMENT: "部署",
	PLAYER_ACTION: "玩家回合",
	DM_ACTION: "DM回合",
	TURN_END: "结算",
};

interface GamePageProps {
	networkManager: SocketNetworkManager;
	onLeaveRoom: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ networkManager, onLeaveRoom }) => {
	const room = useSocketRoom(networkManager, onLeaveRoom);
	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);
	const socket = networkManager.getSocket();
	const assetSocket = useAssetSocket(socket);

	const selectedShipId = useUIStore((state) => state.selectedShipId);
	const mapCursor = useUIStore((state) => state.mapCursor);
	const showGrid = useUIStore((state) => state.showGrid);
	const showBackground = useUIStore((state) => state.showBackground);
	const showWeaponArcs = useUIStore((state) => state.showWeaponArcs);
	const showMovementRange = useUIStore((state) => state.showMovementRange);
	const toggleGrid = useUIStore((state) => state.toggleGrid);
	const toggleBackground = useUIStore((state) => state.toggleBackground);
	const toggleWeaponArcs = useUIStore((state) => state.toggleWeaponArcs);
	const toggleMovementRange = useUIStore((state) => state.toggleMovementRange);

	const tokens = useTokens(room);
	const selectedShip = tokens.find((t) => t.$id === selectedShipId) ?? null;
	const { send } = useGameAction();

	const handleRealityEdit = useCallback(async (shipId: string, runtimeData: Record<string, unknown>) => {
		if (!room) return;
		try {
			for (const [path, value] of Object.entries(runtimeData)) {
				await room.send("edit:token", { action: "modify", tokenId: shipId, path: `runtime/${path}`, value });
			}
			notify.success("舰船数据已提交修改");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "修改失败");
		}
	}, [room]);

	const handleForceEndTurn = useCallback(async (faction?: "PLAYER" | "ENEMY" | "NEUTRAL") => {
		const result = await send("edit:room", { action: "force_end_turn", faction } as any);
		if (result) notify.success("回合已推进");
	}, [send]);

	const playerId = networkManager.getPlayerId();
	const currentPlayer = playerId ? room?.state?.players[playerId] : undefined;
	const isHost = currentPlayer?.role === "HOST";
	const isReady = currentPlayer?.isReady ?? false;
	const phase = room?.state?.currentPhase ?? "DEPLOYMENT";
	const turnCount = room?.state?.turnCount ?? 1;
	const activeFaction = room?.state?.activeFaction ?? undefined;
	const cursorPosition = useMemo(() =>
		mapCursor ? { x: mapCursor.x, y: mapCursor.y } : { x: 0, y: 0 },
		[mapCursor]
	);

	const tabs: TabConfig[] = useMemo(() => [
		{
			id: "ship-info",
			label: "舰船信息",
			icon: <Info size={14} />,
			component: <ShipInfoPanel ship={selectedShip} room={room} />,
			enabled: true,
		},
		{
			id: "movement",
			label: "移动控制",
			icon: <Move size={14} />,
			component: <MovementPanel ship={selectedShip} canControl={true} />,
			enabled: true,
		},
		{
			id: "weapon",
			label: "武器火控",
			icon: <Crosshair size={14} />,
			component: <WeaponPanel ship={selectedShip} canControl={true} />,
			enabled: true,
		},
		{
			id: "shield",
			label: "护盾管理",
			icon: <Shield size={14} />,
			component: <ShieldPanel ship={selectedShip} canControl={true} />,
			enabled: true,
		},
		{
			id: "reality-edit",
			label: "现实修改",
			icon: <Edit size={14} />,
			component: <RealityEditPanel ship={selectedShip} onSubmit={handleRealityEdit} />,
			enabled: Boolean(isHost),
		},
		{
			id: "ship-preset",
			label: "舰船预设",
			icon: <Rocket size={14} />,
			component: <ShipPresetPanel room={room} networkManager={networkManager} cursorPosition={cursorPosition} />,
			enabled: true,
		},
		{
			id: "dm-control",
			label: "DM控制",
			icon: <Crown size={14} />,
			component: <DMControlPanel
				networkManager={networkManager}
				players={room?.state?.players ?? {}}
				isHost={Boolean(isHost)}
				phase={phase}
				turnCount={turnCount}
				activeFaction={activeFaction}
			/>,
			enabled: Boolean(isHost),
		},
		{
			id: "view-control",
			label: "视图控制",
			icon: <Eye size={14} />,
			component: <ViewControlPanel />,
			enabled: true,
		},
	], [selectedShip, handleRealityEdit, isHost, room, networkManager, cursorPosition, phase, turnCount, activeFaction]);

	if (!room || !room.state || !networkManager.getCurrentRoomId()) {
		return (
			<Box style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
				<Text color="gray">连接中...</Text>
				<Text size="1" color="gray">{networkManager.getCurrentRoomId() ? "同步状态..." : "等待房间..."}</Text>
			</Box>
		);
	}

	const players = Object.values(room.state.players).filter((p) => p.connected);
	const phaseColor = room.state.currentPhase === GamePhase.PLAYER_ACTION ? "blue"
		: room.state.currentPhase === GamePhase.DM_ACTION ? "red"
			: room.state.currentPhase === GamePhase.DEPLOYMENT ? "purple" : "amber";

	return (
		<Box style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a0e14", color: "#cfe8ff" }}>
			<Card style={{ flexShrink: 0, height: "40px", borderRadius: 0, background: "rgba(10, 20, 35, 0.95)", borderBottom: "1px solid rgba(74, 158, 255, 0.2)" }}>
				<Flex justify="between" align="center" height="100%" px="3">
					<Flex align="center" gap="3">
						<Badge color={phaseColor} variant="solid" style={{ fontSize: "12px" }}>
							{room.state.currentPhase === GamePhase.DM_ACTION && <Crown size={12} style={{ marginRight: 4 }} />}
							{PHASE_NAMES[room.state.currentPhase] ?? room.state.currentPhase}
						</Badge>
						<Text size="2" color="gray">回合 {room.state.turnCount}</Text>
						
						{phase === "DEPLOYMENT" && (
							<Button
								size="1"
								variant={isReady ? "solid" : "outline"}
								color={isReady ? "green" : "gray"}
								onClick={() => networkManager.setReady()}
							>
								{isReady ? "取消准备" : "准备"}
							</Button>
						)}
						
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								<Button size="1" variant="solid" color="green" disabled={!isHost}>
									<FastForward size={12} /> 推进回合 <ChevronDown size={10} />
								</Button>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content>
								<DropdownMenu.Item onClick={() => handleForceEndTurn()}>玩家方</DropdownMenu.Item>
								<DropdownMenu.Item onClick={() => handleForceEndTurn("ENEMY")}>敌方</DropdownMenu.Item>
								<DropdownMenu.Item onClick={() => handleForceEndTurn("NEUTRAL")}>中立</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</Flex>

					<Flex align="center" gap="2" style={{ flex: 1, justifyContent: "center" }}>
						<RoomPlayerList
							players={room.state.players}
							currentPlayerId={room.sessionId ?? networkManager.getPlayerId()}
							maxVisible={6}
						/>
					</Flex>

					<Flex align="center" gap="2">
						<IconButton variant="ghost" size="1" onClick={() => setShowPlayerRoster(true)}>
							<Users size={14} />
						</IconButton>
						<IconButton variant="ghost" size="1" onClick={() => setShowSettings(true)}>
							<Settings size={14} />
						</IconButton>
						<Button variant="ghost" size="1" color="red" onClick={onLeaveRoom}>
							<LogOut size={14} />
						</Button>
					</Flex>
				</Flex>
			</Card>

			<Box style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
				<Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
					<PixiCanvas
						ships={tokens}
						fetchAssets={assetSocket.batchGet}
					/>
				</Box>
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
						{players.map((p) => (
							<div
								key={p.sessionId}
								className={`room-player-item ${p.sessionId === room.sessionId ? "room-player-item--self" : ""}`}
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
								navigator.clipboard.writeText(networkManager.buildInviteLink(room.roomId));
								notify.success("邀请链接已复制");
							}}>
								邀请链接
							</Button>
						)}
						<Button variant="soft" color="red" onClick={onLeaveRoom}>离开房间</Button>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>

			<Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
				<Dialog.Content style={{ maxWidth: 360 }}>
					<Dialog.Title>
						<Flex align="center" gap="2">
							<Settings size={16} /> 设置
						</Flex>
					</Dialog.Title>
					<Flex direction="column" gap="3">
						<Flex align="center" justify="between">
							<Text size="2">显示网格</Text>
							<IconButton
								variant={showGrid ? "solid" : "soft"}
								color={showGrid ? "blue" : "gray"}
								onClick={toggleGrid}
							>
								{showGrid ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
						<Flex align="center" justify="between">
							<Text size="2">显示背景</Text>
							<IconButton
								variant={showBackground ? "solid" : "soft"}
								color={showBackground ? "blue" : "gray"}
								onClick={toggleBackground}
							>
								{showBackground ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
						<Flex align="center" justify="between">
							<Text size="2">显示武器弧</Text>
							<IconButton
								variant={showWeaponArcs ? "solid" : "soft"}
								color={showWeaponArcs ? "blue" : "gray"}
								onClick={toggleWeaponArcs}
							>
								{showWeaponArcs ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
						<Flex align="center" justify="between">
							<Text size="2">显示移动范围</Text>
							<IconButton
								variant={showMovementRange ? "solid" : "soft"}
								color={showMovementRange ? "blue" : "gray"}
								onClick={toggleMovementRange}
							>
								{showMovementRange ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		</Box>
	);
};

export default GamePage;