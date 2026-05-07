/**
 * DMControlSidebarPanel — DM 控制面板
 *
 * 适配 GameMode 三模式：DEPLOYMENT / COMBAT / WORLD
 * 新增：世界地图加载、模式切换、return_to_world
 */

import React, { useMemo } from "react";
import {
	ChevronDown,
	Users,
	UserX,
	Plus,
	Minus,
	FastForward,
	Play,
	Globe,
	ArrowLeft,
} from "lucide-react";
import { Button, Flex, Text, Badge, DropdownMenu, Card, Separator } from "@radix-ui/themes";
import type { SocketNetworkManager } from "@/network";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import {
	useGamePlayers,
	useGameMode,
	useGameTurnCount,
	useGameActiveFaction,
	useGamePlayerId,
	useGameState,
} from "@/state/stores/gameStore";
import { FactionLabels, TURN_ORDER } from "@vt/data";

interface DMControlSidebarPanelProps {
	networkManager: SocketNetworkManager;
}

const MODE_LABELS: Record<string, string> = {
	DEPLOYMENT: "部署",
	COMBAT: "战斗",
	WORLD: "星图",
};

const MODE_COLORS: Record<string, "blue" | "red" | "green" | "gold"> = {
	DEPLOYMENT: "blue",
	COMBAT: "red",
	WORLD: "green",
};

export const DMControlSidebarPanel: React.FC<DMControlSidebarPanelProps> = ({ networkManager }) => {
	const { send } = useGameAction();

	const players = useGamePlayers();
	const mode = useGameMode();
	const turnCount = useGameTurnCount();
	const activeFaction = useGameActiveFaction();
	const playerId = useGamePlayerId();
	const gameState = useGameState();
	const hasWorld = !!gameState?.world;

	const currentPlayer = playerId ? players[playerId] : undefined;
	const isHost = currentPlayer?.role === "HOST";

	const playerList = useMemo(
		() =>
			Object.entries(players).map(([id, p]) => ({
				id,
				sessionId: p.sessionId,
				nickname: p.nickname,
				role: p.role,
				isReady: p.isReady,
				connected: p.connected,
			})),
		[players]
	);

	if (!isHost) return null;

	const handleAdvanceTurn = async () => {
		try {
			if (mode === "DEPLOYMENT") {
				if (hasWorld) await send("edit:room", { action: "set_phase", phase: "WORLD" });
				else await send("room:action", { action: "start" });
			} else {
				await send("edit:room", { action: "force_end_turn" });
			}
		} catch { notify.error("操作失败"); }
	};

	const handleSetMode = async (m: string) => {
		try {
			await send("edit:room", { action: "set_phase", phase: m });
			notify.success(`模式切换为 ${MODE_LABELS[m] ?? m}`);
		} catch { notify.error("模式切换失败"); }
	};

	const handleLoadWorld = async () => {
		try {
			await send("edit:room", { action: "set_world", preset: "demo" });
			notify.success("已加载演示星域");
		} catch { notify.error("加载失败"); }
	};

	const handleEnterCombat = async () => {
		try {
			await send("world:enter_combat", {});
			notify.success("进入战斗模式");
		} catch {
			notify.error("进入战斗失败");
		}
	};

	const handleReturnToWorld = async () => {
		try {
			await send("edit:room", { action: "return_to_world" });
			notify.success("已返回星图");
		} catch { notify.error("返回失败"); }
	};

	const isLastFaction =
		activeFaction && TURN_ORDER.indexOf(activeFaction) === TURN_ORDER.length - 1;

	return (
		<Flex direction="column" gap="2" style={{ height: "100%" }}>
			<Flex align="center" gap="2" style={{ flexShrink: 0 }}>
				<Badge color="gold" size="1">
					DM
				</Badge>
				<Text size="2" weight="bold">
					控制面板
				</Text>
			</Flex>

			{/* ── 当前模式状态 ── */}
			<Card style={{ padding: "6px 8px" }}>
				<Flex direction="column" gap="1">
					<Flex align="center" justify="between">
						<Text size="1" color="gray">
							模式
						</Text>
						<Badge size="1" color={MODE_COLORS[mode] ?? "gray"}>
							{MODE_LABELS[mode] ?? mode}
						</Badge>
					</Flex>
					{mode === "COMBAT" && (
						<>
							<Flex align="center" justify="between">
								<Text size="1" color="gray">
									回合
								</Text>
								<Badge size="1">{turnCount}</Badge>
							</Flex>
							{activeFaction && (
								<Flex align="center" justify="between">
									<Text size="1" color="gray">
										阵营
									</Text>
									<Badge size="1" color={activeFaction === "PLAYER_ALLIANCE" ? "green" : "red"}>
										{FactionLabels[activeFaction as keyof typeof FactionLabels]}
									</Badge>
								</Flex>
							)}
						</>
					)}
				</Flex>
			</Card>

			{/* ── 主操作 ── */}
			<Card style={{ padding: "6px 8px" }}>
				<Text size="1" color="gray" mb="1">
					主操作
				</Text>

				{mode === "WORLD" && (
					<Button
						size="1"
						variant="solid"
						color="green"
						onClick={handleEnterCombat}
						style={{ width: "100%", marginBottom: 4 }}
					>
						<Play size={12} /> 进入战斗
					</Button>
				)}

				{mode === "COMBAT" && hasWorld && (
					<Button
						size="1"
						variant="soft"
						color="green"
						onClick={handleReturnToWorld}
						style={{ width: "100%", marginBottom: 4 }}
					>
						<ArrowLeft size={12} /> 返回星图
					</Button>
				)}

				<Button
					size="1"
					variant="solid"
					color={isLastFaction ? "red" : "blue"}
					onClick={handleAdvanceTurn}
					style={{ width: "100%" }}
				>
					{mode === "DEPLOYMENT" ? (
						<>
							<Play size={12} /> {hasWorld ? "开始探索" : "开始游戏"}
						</>
					) : mode === "COMBAT" && isLastFaction ? (
						<>
							<FastForward size={12} /> 结算回合
						</>
					) : (
						<>
							<FastForward size={12} /> 推进
						</>
					)}
				</Button>
			</Card>

			<Separator size="4" />

			{/* ── 模式切换 ── */}
			<Card style={{ padding: "6px 8px" }}>
				<Text size="1" color="gray" mb="1">
					模式切换
				</Text>
				<Flex gap="1" wrap="wrap">
					<Button size="1" variant="soft" onClick={() => handleSetMode("DEPLOYMENT")}>
						部署
					</Button>
					<Button size="1" variant="soft" onClick={() => handleSetMode("COMBAT")}>
						战斗
					</Button>
					{hasWorld && (
						<Button size="1" variant="soft" onClick={() => handleSetMode("WORLD")}>
							<Globe size={12} /> 星图
						</Button>
					)}
				</Flex>
			</Card>

			{/* ── 世界地图（仅无 world 时） ── */}
			{!hasWorld && (
				<Card style={{ padding: "6px 8px" }}>
					<Text size="1" color="gray" mb="1">
						世界地图
					</Text>
					<Button
						size="1"
						variant="soft"
						color="green"
						onClick={handleLoadWorld}
						style={{ width: "100%" }}
					>
						<Globe size={12} /> 加载演示星域
					</Button>
				</Card>
			)}

			{/* ── 回合调整 ── */}
			{mode === "COMBAT" && (
				<Card style={{ padding: "6px 8px" }}>
					<Text size="1" color="gray" mb="1">
						回合调整
					</Text>
					<Flex gap="1">
						<Button
							size="1"
							variant="soft"
							onClick={() => send("edit:room", { action: "set_turn", turn: turnCount + 1 })}
						>
							<Plus size={12} /> +1
						</Button>
						<Button
							size="1"
							variant="soft"
							onClick={() =>
								send("edit:room", { action: "set_turn", turn: Math.max(1, turnCount - 1) })
							}
						>
							<Minus size={12} /> -1
						</Button>
					</Flex>
				</Card>
			)}

			{/* ── 玩家管理 ── */}
			<Card style={{ padding: "6px 8px" }}>
				<Text size="1" color="gray" mb="1">
					玩家管理
				</Text>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button size="1" variant="soft" color="amber" style={{ width: "100%" }}>
							<Users size={12} /> 管理 <ChevronDown size={10} />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Label>踢出玩家</DropdownMenu.Label>
						{playerList.map((p) => (
							<DropdownMenu.Item
								key={p.id}
								onClick={() => {
									networkManager.kickPlayer(p.sessionId);
									notify.success(`已踢出 ${p.nickname}`);
								}}
							>
								<UserX size={12} /> {p.nickname} {p.isReady ? "✓" : "○"}
							</DropdownMenu.Item>
						))}
						<DropdownMenu.Separator />
						<DropdownMenu.Label>转移房主</DropdownMenu.Label>
						{playerList
							.filter((p) => p.role !== "HOST")
							.map((p) => (
								<DropdownMenu.Item
									key={p.id}
									onClick={() => networkManager.transferHost(p.sessionId)}
								>
									{p.nickname}
								</DropdownMenu.Item>
							))}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Card>
		</Flex>
	);
};

export default DMControlSidebarPanel;
