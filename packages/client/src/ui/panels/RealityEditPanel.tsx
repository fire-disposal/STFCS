/**
 * 现实修改面板 - 横向布局
 */

import React, { useEffect, useState } from "react";
import { RotateCcw, Save, Trash2, User } from "lucide-react";
import { Badge, Box, Button, Flex, Switch, Text, TextField, Select, IconButton } from "@radix-ui/themes";
import type { CombatToken, RoomPlayerState } from "@vt/data";
import type { TokenRuntime } from "@vt/data";
import { notify } from "@/ui/shared/Notification";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel.css";

export interface RealityEditPanelProps {
	ship: CombatToken | null;
	players: Record<string, RoomPlayerState>;
	onSubmit?: (shipId: string, runtimeData: Partial<TokenRuntime>) => void;
}

export const RealityEditPanel: React.FC<RealityEditPanelProps> = ({ ship, players, onSubmit }) => {
	const { send } = useGameAction();
	const [editMode, setEditMode] = useState(false);
	const [hull, setHull] = useState(0);
	const [heading, setHeading] = useState(0);
	const [fluxSoft, setFluxSoft] = useState(0);
	const [fluxHard, setFluxHard] = useState(0);
	const [overloaded, setOverloaded] = useState(false);
	const [shieldActive, setShieldActive] = useState(false);
	const [selectedOwnerId, setSelectedOwnerId] = useState<string>("__none__");

	const playerList = Object.values(players).filter((p) => p.connected);

	useEffect(() => {
		if (!ship?.runtime) return;
		setHull(ship.runtime.hull ?? 0);
		setHeading(ship.runtime.heading ?? 0);
		setFluxSoft(ship.runtime.fluxSoft ?? 0);
		setFluxHard(ship.runtime.fluxHard ?? 0);
		setOverloaded(ship.runtime.overloaded ?? false);
		setShieldActive(ship.runtime.shield?.active ?? false);
		setSelectedOwnerId(ship.metadata?.owner || "__none__");
	}, [ship?.runtime, ship?.metadata?.owner]);

	const handleReset = () => {
		if (!ship?.runtime) return;
		setHull(ship.runtime.hull ?? 0);
		setHeading(ship.runtime.heading ?? 0);
		setFluxSoft(ship.runtime.fluxSoft ?? 0);
		setFluxHard(ship.runtime.fluxHard ?? 0);
		setOverloaded(ship.runtime.overloaded ?? false);
		setShieldActive(ship.runtime.shield?.active ?? false);
		setSelectedOwnerId(ship.metadata?.owner || "__none__");
		setEditMode(false);
	};

	const handleSave = async () => {
		if (!ship) return;

		try {
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/hull", value: hull });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/heading", value: heading });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/fluxSoft", value: fluxSoft });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/fluxHard", value: fluxHard });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/overloaded", value: overloaded });
			if (ship.runtime?.shield) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/shield/active", value: shieldActive });
			}

			if (selectedOwnerId !== (ship.metadata?.owner || "__none__")) {
				const newOwner = selectedOwnerId === "__none__" ? "" : selectedOwnerId;
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "metadata/owner", value: newOwner });
			}

			onSubmit?.(ship.$id, {
				hull,
				heading,
				fluxSoft,
				fluxHard,
				overloaded,
				shield: ship.runtime?.shield ? { ...ship.runtime.shield, active: shieldActive } : undefined,
			});

			notify.success("舰船数据已保存");
			setEditMode(false);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "保存失败");
		}
	};

	const handleDelete = async () => {
		if (!ship) return;
		if (!window.confirm(`确定删除舰船 "${ship.metadata?.name ?? ship.$id.slice(-6)}"？`)) return;

		try {
			await send("edit:token", { action: "remove", tokenId: ship.$id });
			notify.success("舰船已删除");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "删除失败");
		}
	};

	const handleOwnerChange = (value: string) => {
		setSelectedOwnerId(value);
	};

	const currentOwnerName = selectedOwnerId === "__none__"
		? "无所有者"
		: players[selectedOwnerId]?.nickname ?? "未知";

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
				<Text size="2" weight="bold">{ship.metadata?.name ?? ship.$id.slice(-6)}</Text>
				<Badge size="1" color={editMode ? "blue" : "gray"}>{editMode ? "编辑中" : "已锁定"}</Badge>
				{!editMode && (
					<Text size="1" color="gray">
						<User size={10} style={{ marginRight: 2 }} />
						{currentOwnerName}
					</Text>
				)}
			</Flex>

			<Box className="panel-divider" />

			<Switch checked={editMode} onCheckedChange={setEditMode} />
			<Text size="1">{editMode ? "编辑模式" : "锁定"}</Text>

			{editMode && (
				<>
					<Box className="panel-divider" />

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">所有者</Text>
						<Select.Root value={selectedOwnerId} onValueChange={handleOwnerChange}>
							<Select.Trigger style={{ width: 120 }} />
							<Select.Content>
								<Select.Item value="__none__">无所有者</Select.Item>
								{playerList.map((p) => (
									<Select.Item key={p.sessionId} value={p.sessionId}>
										{p.nickname}
										{p.role === "HOST" && " [DM]"}
									</Select.Item>
								))}
							</Select.Content>
						</Select.Root>
					</Flex>

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
						<Text size="1" className="panel-section__label">软辐能</Text>
						<TextField.Root
							size="1"
							value={fluxSoft.toString()}
							onChange={(e) => setFluxSoft(Number(e.target.value) || 0)}
							style={{ width: 60 }}
						/>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">硬辐能</Text>
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
						<IconButton variant="soft" color="red" onClick={handleDelete}>
							<Trash2 size={12} />
						</IconButton>
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