/**
 * ReadyStatusFloat - 准备状态浮窗
 * 位于 Pixi 容器左上角，大尺寸切换按钮
 */

import React, { useMemo } from "react";
import { CheckCircle, Circle } from "lucide-react";
import { Flex, Button, Text } from "@radix-ui/themes";
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
		<div
			style={{
				position: "absolute",
				top: 20,
				left: 20,
				zIndex: 100,
			}}
		>
			<Flex
				direction="column"
				align="center"
				gap="3"
				style={{
					background: "rgba(26, 39, 56, 0.95)",
					borderRadius: 12,
					padding: "16px 20px",
					border: isReady ? "2px solid rgba(46, 204, 113, 0.6)" : "1px solid rgba(43, 66, 97, 0.6)",
					minWidth: 120,
				}}
			>
				<Text size="3" weight="bold" color="gray">准备状态</Text>
				<Button
					size="3"
					variant={isReady ? "solid" : "outline"}
					color={isReady ? "green" : "gray"}
					onClick={handleToggleReady}
					style={{ minWidth: 100 }}
				>
					{isReady ? <CheckCircle size={18} /> : <Circle size={18} />}
					{isReady ? "已准备" : "未准备"}
				</Button>
			</Flex>
		</div>
	);
};

export default ReadyStatusFloat;