/**
 * DicePanel - 桌游骰子面板
 *
 * 位置：右上角，可折叠
 * 支持：d4/d6/d8/d10/d12/d20/d100
 */

import React, { useState, useCallback } from "react";
import { Flex, Box, Text, IconButton, Tooltip } from "@radix-ui/themes";
import { Dices, ChevronUp, ChevronDown } from "lucide-react";
import { useGameActionSender } from "@/state/stores/gameStore";
import "./dice-panel.css";

const DICE_TYPES = [
	{ id: "d4", label: "d4" },
	{ id: "d6", label: "d6" },
	{ id: "d8", label: "d8" },
	{ id: "d10", label: "d10" },
	{ id: "d12", label: "d12" },
	{ id: "d20", label: "d20" },
	{ id: "d100", label: "d100" },
] as const;

export const DicePanel: React.FC = () => {
	const [collapsed, setCollapsed] = useState(true);
	const [diceType, setDiceType] = useState("d20");
	const [count, setCount] = useState(1);
	const sender = useGameActionSender();

	const handleRoll = useCallback(async () => {
		if (!sender.isAvailable()) return;
		try {
			await sender.send("game:roll_dice", { diceType, count });
		} catch {
			// silent
		}
	}, [sender, diceType, count]);

	if (collapsed) {
		return (
			<Box className="dice-panel dice-panel--collapsed">
				<Tooltip content="骰子">
					<IconButton
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => setCollapsed(false)}
						className="dice-panel-toggle"
					>
						<Dices size={16} />
					</IconButton>
				</Tooltip>
			</Box>
		);
	}

	return (
		<Box className="dice-panel">
			<Flex className="dice-panel-header" align="center" gap="1" px="2" py="1">
				<Dices size={12} />
				<Text size="1" style={{ flex: 1 }}>骰子</Text>
				<Tooltip content="折叠">
					<IconButton
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => setCollapsed(true)}
						className="dice-panel-toggle"
					>
						<ChevronUp size={12} />
					</IconButton>
				</Tooltip>
			</Flex>
			<Flex direction="column" gap="1" px="2" pb="2">
				<Flex wrap="wrap" gap="1">
					{DICE_TYPES.map((dt) => (
						<button
							key={dt.id}
							type="button"
							className={`dice-type-btn ${diceType === dt.id ? "dice-type-btn--active" : ""}`}
							onClick={() => setDiceType(dt.id)}
						>
							{dt.label}
						</button>
					))}
				</Flex>
				<Flex align="center" gap="2">
					<IconButton
						size="1"
						variant="soft"
						color="gray"
						disabled={count <= 1}
						onClick={() => setCount((c) => Math.max(1, c - 1))}
					>
						<ChevronDown size={12} />
					</IconButton>
					<Text size="2" style={{ minWidth: 24, textAlign: "center" }}>{count}</Text>
					<IconButton
						size="1"
						variant="soft"
						color="gray"
						disabled={count >= 20}
						onClick={() => setCount((c) => Math.min(20, c + 1))}
					>
						<ChevronUp size={12} />
					</IconButton>
					<button
						type="button"
						className="dice-roll-btn"
						onClick={handleRoll}
					>
						掷
					</button>
				</Flex>
			</Flex>
		</Box>
	);
};

export default DicePanel;
