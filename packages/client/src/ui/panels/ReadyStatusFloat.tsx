/**
 * ReadyStatusFloat - 准备状态浮窗
 * 用户独立切换自己的准备状态
 */

import React, { useMemo } from "react";
import { CheckCircle, Circle } from "lucide-react";
import { Flex, Button, Box, Text } from "@radix-ui/themes";
import type { SocketNetworkManager } from "@/network";

interface ReadyStatusFloatProps {
	networkManager: SocketNetworkManager;
	players: Record<string, { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean }>;
	playerId: string | null;
	phase: string;
}

export const ReadyStatusFloat: React.FC<ReadyStatusFloatProps> = ({
	networkManager,
	players,
	playerId,
	phase,
}) => {
	const currentPlayer = useMemo(() => {
		if (!playerId) return null;
		return Object.values(players).find((p) => p.sessionId === playerId);
	}, [players, playerId]);

	const isReady = currentPlayer?.isReady ?? false;
	const isDeployment = phase === "DEPLOYMENT";

	if (!playerId || !isDeployment) return null;

	const handleToggleReady = () => {
		networkManager.setReady();
	};

	return (
		<Box
			style={{
				position: "fixed",
				top: 16,
				right: 16,
				zIndex: 100,
			}}
		>
			<Flex
				align="center"
				gap="2"
				style={{
					background: "rgba(26, 39, 56, 0.95)",
					borderRadius: 8,
					padding: "8px 12px",
					border: "1px solid rgba(43, 66, 97, 0.6)",
				}}
			>
				<Text size="2" color="gray">准备状态</Text>
				<Button
					size="1"
					variant={isReady ? "solid" : "soft"}
					color={isReady ? "green" : "gray"}
					onClick={handleToggleReady}
				>
					{isReady ? <CheckCircle size={14} /> : <Circle size={14} />}
					{isReady ? "已准备" : "未准备"}
				</Button>
			</Flex>
		</Box>
	);
};

export default ReadyStatusFloat;