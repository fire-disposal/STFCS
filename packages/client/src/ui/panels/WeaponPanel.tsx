/**
 * 武器火控面板 - 横向布局
 * 使用 useGameAction hook + useTargets hook，无需 room prop
 */

import React, { useState, useMemo } from "react";
import { Crosshair, Target, Bomb } from "lucide-react";
import type { ShipViewModel } from "@/renderer";
import { Button, Flex, Box, Text, Badge, Select } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useTargets } from "@/hooks/useTargets";
import "./battle-panel.css";

export interface WeaponPanelProps {
	ship: ShipViewModel | null;
	canControl: boolean;
}

export const WeaponPanel: React.FC<WeaponPanelProps> = ({ ship, canControl }) => {
	const [selectedWeapon, setSelectedWeapon] = useState("");
	const [targetId, setTargetId] = useState("");

	const { isAvailable, sendAttack } = useGameAction();
	const targets = useTargets(ship?.id ?? null);

	const hasShip = ship && ship.runtime;
	const weapons = useMemo(() => {
		if (!hasShip) return [];
		return (ship.runtime.weapons ?? []).map((w) => ({
			id: w.mountId,
			state: w.state,
			cooldown: w.cooldownRemaining,
		}));
	}, [hasShip, ship]);

	const canAct = canControl && hasShip && isAvailable;

	const handleAttack = async () => {
		if (!canAct || !selectedWeapon || !targetId) return;
		await sendAttack(ship.id, [{
			mountId: selectedWeapon,
			targets: [{ targetId, shots: 1 }],
		}]);
	};

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{hasShip ? (ship.metadata?.name ?? ship.id.slice(-6)) : "请选择舰船"}</Text>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Crosshair size={14} />
				<Text size="1" className="panel-section__label">武器</Text>
				<Select.Root value={selectedWeapon} onValueChange={setSelectedWeapon}>
					<Select.Trigger style={{ minWidth: 100 }}>
						{hasShip && weapons.length > 0 ? (selectedWeapon || "选择武器") : "无武器"}
					</Select.Trigger>
					<Select.Content>
						{weapons.map((w) => (
							<Select.Item key={w.id} value={w.id}>
								{w.id} [{w.state}] {w.cooldown ? `${w.cooldown}s` : ""}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Target size={14} />
				<Text size="1" className="panel-section__label">目标</Text>
				<Select.Root value={targetId} onValueChange={setTargetId}>
					<Select.Trigger style={{ minWidth: 100 }}>
						{targetId || "选择目标"}
					</Select.Trigger>
					<Select.Content>
						{targets.map((t) => (
							<Select.Item key={t.id} value={t.id}>
								{t.name}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="solid" color="red" onClick={handleAttack} disabled={!canAct || !selectedWeapon || !targetId}>
				<Bomb size={12} /> 开火
			</Button>

			{weapons.length > 0 && (
				<Flex className="panel-section" align="center" gap="2">
					{weapons.map((w) => (
						<Badge key={w.id} size="1" color={w.state === "READY" ? "green" : w.state === "COOLDOWN" ? "gray" : "amber"}>
							{w.id.slice(-4)}: {w.state}
						</Badge>
					))}
				</Flex>
			)}
		</Flex>
	);
};

export default WeaponPanel;