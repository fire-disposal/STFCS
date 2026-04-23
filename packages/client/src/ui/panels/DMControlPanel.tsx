/**
 * DMControlPanel - DM控制面板
 * 房主专用：回合推进、阶段切换、玩家管理、开始游戏
 */

import React, { useMemo } from "react";
import { Settings, ChevronDown, Users, UserX } from "lucide-react";
import { Button, Flex, Box, Text, Badge, DropdownMenu } from "@radix-ui/themes";
import type { SocketNetworkManager } from "@/network";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import "./battle-panel.css";

interface DMControlPanelProps {
	networkManager: SocketNetworkManager;
	players: Record<string, { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean }>;
	isHost: boolean;
	phase: string;
	turnCount: number;
	activeFaction: string | undefined;
}

export const DMControlPanel: React.FC<DMControlPanelProps> = ({
	networkManager,
	players,
	isHost,
	phase,
	turnCount,
	activeFaction,
}) => {
	const { send } = useGameAction();

	const playerList = useMemo(() => Object.entries(players).map(([id, p]) => ({
		id,
		sessionId: p.sessionId,
		nickname: p.nickname,
		role: p.role,
		isReady: p.isReady,
		connected: p.connected,
	})), [players]);

	const readyStats = useMemo(() => {
		const total = playerList.filter(p => p.connected).length;
		const ready = playerList.filter(p => p.connected && p.isReady).length;
		return { total, ready };
	}, [playerList]);

	if (!isHost) return null;

	const handleSetPhase = async (newPhase: string) => {
		const result = await send("edit:room", { action: "set_phase", phase: newPhase });
		if (result) notify.success(`阶段已切换为 ${newPhase}`);
	};

	const handleSetTurn = async (turn: number) => {
		const result = await send("edit:room", { action: "set_turn", turn });
		if (result) notify.success(`回合已设置为 ${turn}`);
	};

	const handleTransferHost = (targetId: string) => {
		networkManager.transferHost(targetId);
		notify.success("房主权限已转移");
	};

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2">
				<Badge color="gold" size="1">DM</Badge>
				<Text size="2" weight="bold">控制面板</Text>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" color="gray">回合</Text>
				<Badge size="1">{turnCount}</Badge>
				<Text size="1" color="gray">阶段</Text>
				<Badge size="1" color="blue">{phase}</Badge>
				{activeFaction && (
					<>
						<Text size="1" color="gray">阵营</Text>
						<Badge size="1" color={activeFaction === "PLAYER" ? "green" : "red"}>{activeFaction}</Badge>
					</>
				)}
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" color="gray">准备</Text>
				<Badge size="1" color="blue">
					{readyStats.ready}/{readyStats.total}
				</Badge>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button size="1" variant="soft">
							<Settings size={12} /> 设置 <ChevronDown size={10} />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Label>切换阶段</DropdownMenu.Label>
						<DropdownMenu.Item onClick={() => handleSetPhase("DEPLOYMENT")}>部署阶段</DropdownMenu.Item>
						<DropdownMenu.Item onClick={() => handleSetPhase("PLAYER_ACTION")}>玩家回合</DropdownMenu.Item>
						<DropdownMenu.Item onClick={() => handleSetPhase("DM_ACTION")}>DM回合</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Label>设置回合</DropdownMenu.Label>
						<DropdownMenu.Item onClick={() => handleSetTurn(turnCount + 1)}>+1</DropdownMenu.Item>
						<DropdownMenu.Item onClick={() => handleSetTurn(Math.max(1, turnCount - 1))}>-1</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button size="1" variant="soft" color="amber">
							<Users size={12} /> 玩家 <ChevronDown size={10} />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Label>踢出玩家</DropdownMenu.Label>
						{playerList.map((p) => (
							<DropdownMenu.Item key={p.id} onClick={() => {
								networkManager.kickPlayer(p.sessionId);
								notify.success(`已踢出 ${p.nickname}`);
							}}>
								<UserX size={12} /> {p.nickname} {p.isReady ? "✓" : "○"}
							</DropdownMenu.Item>
						))}
						<DropdownMenu.Separator />
						<DropdownMenu.Label>转移房主</DropdownMenu.Label>
						{playerList.filter((p) => p.role !== "HOST").map((p) => (
							<DropdownMenu.Item key={p.id} onClick={() => handleTransferHost(p.sessionId)}>
								{p.nickname}
							</DropdownMenu.Item>
						))}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Flex>
		</Flex>
	);
};

export default DMControlPanel;