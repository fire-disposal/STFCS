/**
 * ReadyStatusFloat - 准备状态浮窗
 * 支持切换准备状态（可反悔）
 */

import React, { useMemo } from "react";
import { CheckCircle, RotateCcw } from "lucide-react";
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
		return players[playerId];
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
				gap="2"
				style={{
					background: "rgba(26, 39, 56, 0.95)",
					borderRadius: 12,
					padding: "12px 16px",
					border: isReady ? "2px solid rgba(46, 204, 113, 0.6)" : "1px solid rgba(43, 66, 97, 0.6)",
					minWidth: 140,
				}}
			>
				<Text size="2" weight="bold" color="gray">准备状态</Text>
				<Button
					size="2"
					variant={isReady ? "solid" : "outline"}
					color={isReady ? "green" : "gray"}
					onClick={handleToggleReady}
					style={{ minWidth: 120 }}
				>
					{isReady ? <RotateCcw size={16} /> : <CheckCircle size={16} />}
					{isReady ? "取消准备" : "确认准备"}
				</Button>
				<Text size="1" color="gray" style={{ opacity: 0.8 }}>
					{isReady ? "点击可取消" : "点击确认"}
				</Text>
			</Flex>
		</div>
	);
};

export default ReadyStatusFloat;