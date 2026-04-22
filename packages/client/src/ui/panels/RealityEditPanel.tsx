/**
 * 现实修改面板 - 横向布局
 */

import React, { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Badge, Box, Button, Flex, Switch, Text, TextField } from "@radix-ui/themes";
import type { ShipViewModel } from "@/renderer";
import type { TokenRuntime } from "@vt/data";
import "./battle-panel.css";

export interface RealityEditPanelProps {
	ship: ShipViewModel | null;
	onSubmit: (shipId: string, runtimeData: Partial<TokenRuntime>) => void;
}

export const RealityEditPanel: React.FC<RealityEditPanelProps> = ({ ship, onSubmit }) => {
	const [editMode, setEditMode] = useState(false);
	const [hull, setHull] = useState(0);
	const [heading, setHeading] = useState(0);
	const [fluxSoft, setFluxSoft] = useState(0);
	const [fluxHard, setFluxHard] = useState(0);
	const [overloaded, setOverloaded] = useState(false);
	const [shieldActive, setShieldActive] = useState(false);

	useEffect(() => {
		if (!ship) return;
		setHull(ship.runtime?.hull ?? 0);
		setHeading(ship.runtime?.heading ?? 0);
		setFluxSoft(ship.runtime?.fluxSoft ?? 0);
		setFluxHard(ship.runtime?.fluxHard ?? 0);
		setOverloaded(ship.runtime?.overloaded ?? false);
		setShieldActive(ship.runtime?.shield?.active ?? false);
	}, [ship]);

	const handleReset = () => {
		if (!ship) return;
		setHull(ship.runtime?.hull ?? 0);
		setHeading(ship.runtime?.heading ?? 0);
		setFluxSoft(ship.runtime?.fluxSoft ?? 0);
		setFluxHard(ship.runtime?.fluxHard ?? 0);
		setOverloaded(ship.runtime?.overloaded ?? false);
		setShieldActive(ship.runtime?.shield?.active ?? false);
	};

	const handleSave = () => {
		if (!ship) return;
		onSubmit(ship.id, {
			hull,
			heading,
			fluxSoft,
			fluxHard,
			overloaded,
			shield: ship.runtime?.shield ? { ...ship.runtime.shield, active: shieldActive } : undefined,
		});
		setEditMode(false);
	};

	if (!ship) {
		return (
			<Flex align="center" gap="4">
				<Text size="7">📝</Text>
				<Text size="2" color="gray">选择舰船后可编辑</Text>
			</Flex>
		);
	}

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{ship.metadata?.name ?? ship.id.slice(-6)}</Text>
				<Badge size="1" color={editMode ? "blue" : "gray"}>{editMode ? "编辑中" : "已锁定"}</Badge>
			</Flex>

			<Box className="panel-divider" />

			<Switch checked={editMode} onCheckedChange={setEditMode} />
			<Text size="1">{editMode ? "编辑模式" : "锁定"}</Text>

			{editMode && (
				<>
					<Box className="panel-divider" />

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">船体</Text>
						<TextField.Root
							size="1"
							value={hull.toString()}
							onChange={(e) => setHull(Number(e.target.value) || 0)}
							style={{ width: 60 }}
						/>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">朝向</Text>
						<TextField.Root
							size="1"
							value={heading.toString()}
							onChange={(e) => setHeading(Number(e.target.value) || 0)}
							style={{ width: 60 }}
						/>
						<Text size="1" color="gray">°</Text>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">软通量</Text>
						<TextField.Root
							size="1"
							value={fluxSoft.toString()}
							onChange={(e) => setFluxSoft(Number(e.target.value) || 0)}
							style={{ width: 60 }}
						/>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">硬通量</Text>
						<TextField.Root
							size="1"
							value={fluxHard.toString()}
							onChange={(e) => setFluxHard(Number(e.target.value) || 0)}
							style={{ width: 60 }}
						/>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">过载</Text>
						<Switch checked={overloaded} onCheckedChange={setOverloaded} />
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">护盾</Text>
						<Switch checked={shieldActive} onCheckedChange={setShieldActive} />
					</Flex>

					<Box className="panel-divider" />

					<Flex gap="2">
						<Button size="1" variant="soft" onClick={handleReset}>
							<RotateCcw size={12} /> 重置
						</Button>
						<Button size="1" variant="solid" color="green" onClick={handleSave}>
							<Save size={12} /> 保存
						</Button>
					</Flex>
				</>
			)}
		</Flex>
	);
};

export default RealityEditPanel;