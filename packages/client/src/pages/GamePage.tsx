import { GamePhase } from "@vt/data";
import type { ShipViewModel } from "@/renderer";
import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import { useSocketRoom, useTokens } from "@/network";
import { notify } from "@/ui/shared/Notification";
import {
	Box,
	Flex,
	Card,
	Text,
	Badge,
	Button,
	Dialog,
	ScrollArea,
	IconButton,
} from "@radix-ui/themes";
import { Crown, LogOut, Settings, Users, CheckCircle, XCircle, Info, Edit, Move, Crosshair, Shield, Eye, Rocket } from "lucide-react";
import React, { useState } from "react";
import type { SocketNetworkManager } from "@/network";
import BattlePanel from "@/ui/panels/BattlePanel";
import ShipInfoPanel from "@/ui/panels/ShipInfoPanel";
import MovementPanel from "@/ui/panels/MovementPanel";
import WeaponPanel from "@/ui/panels/WeaponPanel";
import ShieldPanel from "@/ui/panels/ShieldPanel";
import RealityEditPanel from "@/ui/panels/RealityEditPanel";
import ViewControlPanel from "@/ui/panels/ViewControlPanel";
import ShipPresetPanel from "@/ui/panels/ShipPresetPanel";

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

	const selectedShipId = useUIStore((state) => state.selectedShipId);
	const mapCursor = useUIStore((state) => state.mapCursor);

	const tokens = useTokens(room) as unknown as ShipViewModel[];
	const selectedShip = tokens.find((t) => t.id === selectedShipId) ?? null;

	const handleRealityEdit = async (shipId: string, runtimeData: Record<string, unknown>) => {
		if (!room) return;
		try {
			for (const [path, value] of Object.entries(runtimeData)) {
				await room.send("edit:token", { action: "modify", tokenId: shipId, path: `runtime/${path}`, value });
			}
			notify.success("舰船数据已提交修改");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "修改失败");
		}
	};

	const playerKeys = room?.state?.players ? Object.keys(room.state.players) : [];
	const currentPlayerKey = playerKeys.find((k) => {
		const p = room?.state?.players[k];
		return p?.sessionId === room?.sessionId;
	});
	const currentPlayer = currentPlayerKey ? room?.state?.players[currentPlayerKey] : undefined;
	const isHost = currentPlayer?.role === "HOST";

	if (!room || !room.state) {
		return (
			<Box style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
				<Text color="gray">连接中...</Text>
			</Box>
		);
	}

	const players = Object.values(room.state.players).filter((p) => p.connected);
	const phaseColor = room.state.currentPhase === GamePhase.PLAYER_ACTION ? "blue"
		: room.state.currentPhase === GamePhase.DM_ACTION ? "red"
		: room.state.currentPhase === GamePhase.DEPLOYMENT ? "purple" : "amber";

	return (
		<Box style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a0e14", color: "#cfe8ff" }}>
			{/* Header */}
			<Card style={{ flexShrink: 0, height: "40px", borderRadius: 0, background: "rgba(10, 20, 35, 0.95)", borderBottom: "1px solid rgba(74, 158, 255, 0.2)" }}>
				<Flex justify="between" align="center" height="100%" px="3">
					<Flex align="center" gap="3">
						<Badge color={phaseColor} variant="solid" style={{ fontSize: "12px" }}>
							{room.state.currentPhase === GamePhase.DM_ACTION && <Crown size={12} style={{ marginRight: 4 }} />}
							{PHASE_NAMES[room.state.currentPhase] ?? room.state.currentPhase}
						</Badge>
						<Text size="2" color="gray">回合 {room.state.turnCount}</Text>
					</Flex>

					<Flex align="center" gap="2" style={{ flex: 1, justifyContent: "center" }}>
						{players.slice(0, 6).map((p) => (
							<Flex key={p.sessionId} align="center" gap="1" style={{ padding: "2px 6px", background: "rgba(26, 45, 66, 0.5)", borderRadius: 2 }}>
								{p.role === "HOST" && <Crown size={10} color="#ff6f8f" />}
								<Text size="1" style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{p.nickname}</Text>
								{p.isReady ? <CheckCircle size={10} color="#2ecc71" /> : <XCircle size={10} color="#6b7280" />}
							</Flex>
						))}
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

			{/* Main */}
			<Box style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
				<Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
					<PixiCanvas ships={tokens} />
				</Box>
			</Box>

			{/* Battle Panel */}
			<BattlePanel
				tabs={[
					{
						id: "ship-info",
						label: "舰船信息",
						icon: <Info size={14} />,
						component: <ShipInfoPanel ship={selectedShip} canControl={true} />,
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
						component: <ShipPresetPanel room={room} networkManager={networkManager} cursorPosition={mapCursor ? { x: mapCursor.x, y: mapCursor.y } : { x: 0, y: 0 }} isHost={Boolean(isHost)} />,
						enabled: true,
					},
					{
						id: "view-control",
						label: "视图控制",
						icon: <Eye size={14} />,
						component: <ViewControlPanel />,
						enabled: true,
					},
				]}
				defaultActiveTab="ship-info"
			/>

			{/* Player Roster Modal */}
			<Dialog.Root open={showPlayerRoster} onOpenChange={setShowPlayerRoster}>
				<Dialog.Content style={{ maxWidth: 400 }}>
					<Dialog.Title>
						<Flex align="center" gap="2">
							<Users size={16} /> 玩家列表
						</Flex>
					</Dialog.Title>
					<ScrollArea style={{ maxHeight: 300 }}>
						<Flex direction="column" gap="2">
							{players.map((p) => (
								<Card key={p.sessionId} variant="surface" style={{
									borderLeft: p.sessionId === room.sessionId ? "2px solid #4a9eff" : "none"
								}}>
									<Flex align="center" gap="2">
										{p.role === "HOST" && <Crown size={14} color="#ff6f8f" />}
										<Text size="2" style={{ flex: 1 }}>{p.nickname}</Text>
										{p.isReady ? <CheckCircle size={12} color="#2ecc71" /> : <XCircle size={12} color="#6b7280" />}
									</Flex>
								</Card>
							))}
						</Flex>
					</ScrollArea>
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

			{/* Settings Modal */}
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
								variant={useUIStore.getState().showGrid ? "solid" : "soft"}
								color={useUIStore.getState().showGrid ? "blue" : "gray"}
								onClick={() => useUIStore.getState().toggleGrid()}
							>
								{useUIStore.getState().showGrid ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
						<Flex align="center" justify="between">
							<Text size="2">显示背景</Text>
							<IconButton
								variant={useUIStore.getState().showBackground ? "solid" : "soft"}
								color={useUIStore.getState().showBackground ? "blue" : "gray"}
								onClick={() => useUIStore.getState().toggleBackground()}
							>
								{useUIStore.getState().showBackground ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
						<Flex align="center" justify="between">
							<Text size="2">显示武器弧</Text>
							<IconButton
								variant={useUIStore.getState().showWeaponArcs ? "solid" : "soft"}
								color={useUIStore.getState().showWeaponArcs ? "blue" : "gray"}
								onClick={() => useUIStore.getState().toggleWeaponArcs()}
							>
								{useUIStore.getState().showWeaponArcs ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
						<Flex align="center" justify="between">
							<Text size="2">显示移动范围</Text>
							<IconButton
								variant={useUIStore.getState().showMovementRange ? "solid" : "soft"}
								color={useUIStore.getState().showMovementRange ? "blue" : "gray"}
								onClick={() => useUIStore.getState().toggleMovementRange()}
							>
								{useUIStore.getState().showMovementRange ? <CheckCircle size={14} /> : <XCircle size={14} />}
							</IconButton>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		</Box>
	);
};

export default GamePage;