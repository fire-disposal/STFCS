/**
 * RealityEditSidebarPanel - 现实修改面板（右侧栏适配版）
 *
 * 纵向布局，使用 useSelectedShip hook 统一获取选中舰船
 */

import React, { useCallback, useEffect, useState } from "react";
import {
	Box,
	Button,
	Flex,
	Select,
	Switch,
	Tabs,
	Text,
	TextArea,
	TextField,
	Separator,
} from "@radix-ui/themes";
import { Save, Trash2, Code, Crosshair, Move, RotateCcw } from "lucide-react";
import type { CombatToken, TokenRuntime, TokenSpec } from "@vt/data";
import { notify } from "@/ui/shared/Notification";
import { useGameAction } from "@/hooks/useGameAction";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import { useConnectedPlayers } from "@/state/stores/gameStore";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface RealityEditSidebarPanelProps {
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function extractRuntimeDraft(ship: CombatToken): TokenRuntime {
	const r = ship.runtime;
	return {
		position: { x: r.position?.x ?? 0, y: r.position?.y ?? 0 },
		heading: r.heading ?? 0,
		hull: r.hull ?? ship.spec.maxHitPoints,
		armor: (r.armor ?? Array(6).fill(ship.spec.armorMaxPerQuadrant)) as [number, number, number, number, number, number],
		fluxSoft: r.fluxSoft ?? 0,
		fluxHard: r.fluxHard ?? 0,
		shield: r.shield ? { ...r.shield } : undefined,
		overloaded: r.overloaded ?? false,
		overloadTime: r.overloadTime ?? 1,
		destroyed: r.destroyed ?? false,
		movement: r.movement ? { ...r.movement } : undefined,
		hasFired: r.hasFired ?? false,
		weapons: r.weapons ? clone(r.weapons) : undefined,
		modifiers: r.modifiers ? clone(r.modifiers) : undefined,
		actionSequence: r.actionSequence ?? 0,
		faction: r.faction,
		venting: r.venting ?? false,
		displayName: r.displayName,
	};
}

function extractSpecDraft(ship: CombatToken): Partial<TokenSpec> {
	const s = ship.spec;
	return {
		maxHitPoints: s.maxHitPoints,
		armorMaxPerQuadrant: s.armorMaxPerQuadrant,
		fluxCapacity: s.fluxCapacity,
		fluxDissipation: s.fluxDissipation,
		maxSpeed: s.maxSpeed,
		maxTurnRate: s.maxTurnRate,
		width: s.width,
		length: s.length,
	};
}

export const RealityEditSidebarPanel: React.FC<RealityEditSidebarPanelProps> = () => {
	const { send } = useGameAction();
	const ship = useSelectedShip();

	const [editMode, setEditMode] = useState(false);
	const playerList = useConnectedPlayers();

	const [activeTab, setActiveTab] = useState("runtime");
	const [runtimeDraft, setRuntimeDraft] = useState<TokenRuntime | null>(null);
	const [specDraft, setSpecDraft] = useState<Partial<TokenSpec> | null>(null);
	const [jsonText, setJsonText] = useState("");
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [selectedOwnerId, setSelectedOwnerId] = useState<string>("__none__");


	useEffect(() => {
		if (!ship) return;
		setRuntimeDraft(extractRuntimeDraft(ship));
		setSpecDraft(extractSpecDraft(ship));
		setJsonText(JSON.stringify(ship, null, 2));
		setJsonError(null);
		setSelectedOwnerId(ship.metadata?.owner || "__none__");
	}, [ship]);

	const updateRuntime = useCallback((field: string, value: unknown) => {
		setRuntimeDraft((prev) => {
			if (!prev) return prev;
			const next = clone(prev);
			const parts = field.split("/");
			let obj: any = next;
			for (let i = 0; i < parts.length - 1; i++) {
				if (!obj[parts[i]]) obj[parts[i]] = {};
				obj = obj[parts[i]];
			}
			obj[parts[parts.length - 1]] = value;
			return next;
		});
	}, []);

	const updateRuntimeNested = useCallback((field: string, subField: string, value: unknown) => {
		setRuntimeDraft((prev) => {
			if (!prev) return prev;
			const next = clone(prev);
			const parent = (next as any)[field];
			if (parent) parent[subField] = value;
			return next;
		});
	}, []);

	const updateSpec = useCallback((field: string, value: unknown) => {
		setSpecDraft((prev) => {
			if (!prev) return prev;
			return { ...prev, [field]: value };
		});
	}, []);

	const handleReset = useCallback(() => {
		if (!ship) return;
		setRuntimeDraft(extractRuntimeDraft(ship));
		setSpecDraft(extractSpecDraft(ship));
		setJsonText(JSON.stringify(ship, null, 2));
		setJsonError(null);
		setSelectedOwnerId(ship.metadata?.owner || "__none__");
		setEditMode(false);
	}, [ship]);

	const handleSave = useCallback(async () => {
		if (!ship || !runtimeDraft) return;

		try {
			const r = runtimeDraft;
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/position", value: r.position });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/heading", value: r.heading });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/hull", value: r.hull });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/armor", value: r.armor });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/fluxSoft", value: r.fluxSoft });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/fluxHard", value: r.fluxHard });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/overloaded", value: r.overloaded });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/destroyed", value: r.destroyed });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/hasFired", value: r.hasFired });
			await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/venting", value: r.venting ?? false });

			if (r.shield) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/shield", value: r.shield });
			}
			if (r.movement) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/movement", value: r.movement });
			}
			if (r.weapons) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/weapons", value: r.weapons });
			}
			if (r.faction !== undefined) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/faction", value: r.faction });
			}
			if (r.displayName !== undefined) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/displayName", value: r.displayName });
			}

			if (specDraft) {
				for (const [key, value] of Object.entries(specDraft)) {
					if (value !== undefined && (ship.spec as any)[key] !== value) {
						await send("edit:token", { action: "modify", tokenId: ship.$id, path: `spec/${key}`, value });
					}
				}
			}

			if (selectedOwnerId !== (ship.metadata?.owner || "__none__")) {
				const newOwner = selectedOwnerId === "__none__" ? "" : selectedOwnerId;
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "metadata/owner", value: newOwner });
			}

			notify.success("舰船数据已保存");
			setEditMode(false);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "保存失败");
		}
	}, [ship, runtimeDraft, specDraft, selectedOwnerId, send]);

	const handleJsonSave = useCallback(async () => {
		if (!ship) return;
		try {
			const parsed = JSON.parse(jsonText);
			if (!parsed.$id) throw new Error("缺少 $id");
			if (!parsed.runtime) throw new Error("缺少 runtime");

			for (const [key, value] of Object.entries(parsed.runtime)) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: `runtime/${key}`, value });
			}
			if (parsed.spec) {
				for (const [key, value] of Object.entries(parsed.spec)) {
					if (value !== undefined) {
						await send("edit:token", { action: "modify", tokenId: ship.$id, path: `spec/${key}`, value });
					}
				}
			}
			if (parsed.metadata?.owner !== undefined) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "metadata/owner", value: parsed.metadata.owner });
			}

			notify.success("JSON 数据已保存");
			setJsonError(null);
		} catch (error) {
			setJsonError(error instanceof Error ? error.message : "JSON 解析失败");
		}
	}, [ship, jsonText, send]);

	const handleDelete = useCallback(async () => {
		if (!ship) return;
		if (!window.confirm(`确定删除舰船 "${ship.metadata?.name ?? ship.$id.slice(-6)}"？`)) return;
		try {
			await send("edit:token", { action: "remove", tokenId: ship.$id });
			notify.success("舰船已删除");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "删除失败");
		}
	}, [ship, send]);

	const handleQuickHeal = useCallback(async () => {
		if (!ship) return;
		try {
			await send("edit:token", { action: "restore", tokenId: ship.$id });
			notify.success("舰船已完全修复");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "修复失败");
		}
	}, [ship, send]);

	const handleQuickDamage = useCallback(async (amount: number) => {
		if (!ship) return;
		try {
			await send("edit:token", { action: "damage", tokenId: ship.$id, amount });
			notify.success(`造成 ${amount} 点伤害`);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "伤害失败");
		}
	}, [ship, send]);

	if (!ship) {
		return (
			<Flex align="center" justify="center" className="sidebar-panel-content" style={{ height: "100%", minHeight: 150 }}>
				<Text size="2" color="gray">选择舰船后可编辑</Text>
			</Flex>
		);
	}

	return (
		<Flex direction="column" gap="2" style={{ height: "100%", overflowY: "auto", minHeight: 0 }}>
			{/* 锁定/编辑开关 */}
			<Flex align="center" justify="between" className="sidebar-header-row" style={{ flexShrink: 0 }}>
				<Flex align="center" gap="2">
					<Text size="1" weight="bold" style={{ color: "#cfe8ff" }}>
						{ship.runtime.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6)}
					</Text>
				</Flex>
				<Flex align="center" gap="2">
					<Text size="1" style={{ color: "#6b8aaa" }}>编辑</Text>
					<Switch size="1" checked={editMode} onCheckedChange={setEditMode} />
				</Flex>
			</Flex>

			<Separator size="4" style={{ flexShrink: 0 }} />

			{/* Tab 切换 */}
			<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
				<Tabs.List style={{ width: "100%" }}>
					<Tabs.Trigger value="runtime" style={{ flex: 1, justifyContent: "center" }}>
						<Move size={12} /> 状态
					</Tabs.Trigger>
					<Tabs.Trigger value="spec" style={{ flex: 1, justifyContent: "center" }}>
						<Crosshair size={12} /> 规格
					</Tabs.Trigger>
					<Tabs.Trigger value="json" style={{ flex: 1, justifyContent: "center" }}>
						<Code size={12} /> JSON
					</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>

			{/* Tab 内容 + 编辑按钮（一起在滚动区内） */}
			<Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
				{/* Tab 内容区域 */}
				{activeTab === "runtime" && runtimeDraft && (
					<Flex direction="column" gap="2" style={{ flexShrink: 0 }}>
						<Box className="sidebar-edit-section">
							<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 4 }}>基础</Text>
							<Flex direction="column" gap="1">
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 36 }}>船体</Text>
									<TextField.Root
										size="1"
										type="number"
										value={runtimeDraft.hull}
										onChange={(e) => updateRuntime("hull", Math.max(0, Number(e.target.value) || 0))}
										disabled={!editMode}
										style={{ width: 50 }}
									/>
									<Text size="1" style={{ color: "#8ba4c7" }}>/ {ship.spec.maxHitPoints}</Text>
								</Flex>
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 36 }}>软辐</Text>
									<TextField.Root
										size="1"
										type="number"
										value={runtimeDraft.fluxSoft}
										onChange={(e) => updateRuntime("fluxSoft", Math.max(0, Number(e.target.value) || 0))}
										disabled={!editMode}
										style={{ width: 50 }}
									/>
									<Text size="1" style={{ color: "#6b8aaa", width: 36 }}>硬辐</Text>
									<TextField.Root
										size="1"
										type="number"
										value={runtimeDraft.fluxHard}
										onChange={(e) => updateRuntime("fluxHard", Math.max(0, Number(e.target.value) || 0))}
										disabled={!editMode}
										style={{ width: 50 }}
									/>
								</Flex>
							</Flex>
						</Box>

						<Box className="sidebar-edit-section">
							<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 4 }}>位置</Text>
							<Flex direction="column" gap="1">
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 36 }}>X</Text>
									<TextField.Root
										size="1"
										type="number"
										value={runtimeDraft.position.x}
										onChange={(e) => updateRuntimeNested("position", "x", Number(e.target.value) || 0)}
										disabled={!editMode}
										style={{ width: 60 }}
									/>
									<Text size="1" style={{ color: "#6b8aaa", width: 36 }}>Y</Text>
									<TextField.Root
										size="1"
										type="number"
										value={runtimeDraft.position.y}
										onChange={(e) => updateRuntimeNested("position", "y", Number(e.target.value) || 0)}
										disabled={!editMode}
										style={{ width: 60 }}
									/>
								</Flex>
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 36 }}>朝向</Text>
									<TextField.Root
										size="1"
										type="number"
										value={runtimeDraft.heading}
										onChange={(e) => updateRuntime("heading", Number(e.target.value) || 0)}
										disabled={!editMode}
										style={{ width: 60 }}
									/>
									<Text size="1" style={{ color: "#6b8aaa" }}>°</Text>
								</Flex>
							</Flex>
						</Box>

						<Box className="sidebar-edit-section">
							<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 4 }}>状态</Text>
							<Flex direction="column" gap="1">
								<Flex align="center" gap="2">
									<Text size="1" style={{ color: "#6b8aaa" }}>过载</Text>
									<Switch size="1" checked={runtimeDraft.overloaded} onCheckedChange={(v) => updateRuntime("overloaded", v)} disabled={!editMode} />
									<Text size="1" style={{ color: "#6b8aaa" }}>摧毁</Text>
									<Switch size="1" checked={runtimeDraft.destroyed} onCheckedChange={(v) => updateRuntime("destroyed", v)} disabled={!editMode} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="1" style={{ color: "#6b8aaa" }}>排热</Text>
									<Switch size="1" checked={runtimeDraft.venting ?? false} onCheckedChange={(v) => updateRuntime("venting", v)} disabled={!editMode} />
								</Flex>
							</Flex>
						</Box>

						<Box className="sidebar-edit-section">
							<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 4 }}>所有者</Text>
							<Select.Root value={selectedOwnerId} onValueChange={setSelectedOwnerId} disabled={!editMode}>
								<Select.Trigger style={{ width: "100%" }} />
								<Select.Content>
									<Select.Item value="__none__">无所有者</Select.Item>
									{playerList.map((p) => (
										<Select.Item key={p.sessionId} value={p.sessionId}>
											{p.nickname}{p.role === "HOST" && " [DM]"}
										</Select.Item>
									))}
								</Select.Content>
							</Select.Root>
						</Box>
					</Flex>
				)}

				{activeTab === "spec" && specDraft && (
					<Flex direction="column" gap="2" style={{ flexShrink: 0 }}>
						<Box className="sidebar-edit-section">
							<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 4 }}>战斗</Text>
							<Flex direction="column" gap="1">
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 60 }}>最大HP</Text>
									<TextField.Root size="1" type="number" value={specDraft.maxHitPoints} onChange={(e) => updateSpec("maxHitPoints", Math.max(1, Number(e.target.value) || 1))} disabled={!editMode} style={{ width: 60 }} />
								</Flex>
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 60 }}>护甲/象限</Text>
									<TextField.Root size="1" type="number" value={specDraft.armorMaxPerQuadrant} onChange={(e) => updateSpec("armorMaxPerQuadrant", Math.max(0, Number(e.target.value) || 0))} disabled={!editMode} style={{ width: 60 }} />
								</Flex>
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 60 }}>辐能容量</Text>
									<TextField.Root size="1" type="number" value={specDraft.fluxCapacity ?? 0} onChange={(e) => updateSpec("fluxCapacity", Math.max(0, Number(e.target.value) || 0))} disabled={!editMode} style={{ width: 60 }} />
								</Flex>
							</Flex>
						</Box>

						<Box className="sidebar-edit-section">
							<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 4 }}>机动</Text>
							<Flex direction="column" gap="1">
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 60 }}>最大速度</Text>
									<TextField.Root size="1" type="number" value={specDraft.maxSpeed} onChange={(e) => updateSpec("maxSpeed", Math.max(0, Number(e.target.value) || 0))} disabled={!editMode} style={{ width: 60 }} />
								</Flex>
								<Flex align="center" gap="1">
									<Text size="1" style={{ color: "#6b8aaa", width: 60 }}>最大转向</Text>
									<TextField.Root size="1" type="number" value={specDraft.maxTurnRate} onChange={(e) => updateSpec("maxTurnRate", Math.max(0, Number(e.target.value) || 0))} disabled={!editMode} style={{ width: 60 }} />
								</Flex>
							</Flex>
						</Box>
					</Flex>
				)}

				{activeTab === "json" && (
					<Flex direction="column" gap="2" style={{ flex: 1, minHeight: 0, display: "flex" }}>
						<TextArea
							size="1"
							value={jsonText}
							onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
							disabled={!editMode}
							style={{
								width: "100%",
								flex: 1,
								minHeight: 0,
								fontFamily: '"Fira Code", monospace',
								fontSize: 11,
							}}
						/>
						{jsonError && <Text size="1" color="red">{jsonError}</Text>}
						<Button size="1" variant="solid" color="green" onClick={handleJsonSave} disabled={!editMode} style={{ width: "100%", flexShrink: 0 }}>
							<Save size={12} /> 应用JSON
						</Button>
					</Flex>
				)}

				{/* 编辑模式按钮（在滚动区内） */}
				{editMode && (
					<Flex direction="column" gap="1" style={{ flexShrink: 0, marginTop: 4 }}>
						<Separator size="4" />
						<Button size="1" variant="soft" color="green" onClick={handleQuickHeal} style={{ width: "100%" }}>修复</Button>
						<Button size="1" variant="soft" color="orange" onClick={() => handleQuickDamage(100)} style={{ width: "100%" }}>-100伤害</Button>
						<Button size="1" variant="soft" color="red" onClick={handleDelete} style={{ width: "100%" }}>
							<Trash2 size={12} /> 删除
						</Button>
						<Button size="1" variant="soft" onClick={handleReset} style={{ width: "100%" }}>
							<RotateCcw size={12} /> 重置
						</Button>
						<Button size="1" variant="solid" color="green" onClick={handleSave} style={{ width: "100%" }}>
							<Save size={12} /> 保存
						</Button>
					</Flex>
				)}
			</Box>
		</Flex>
	);
};

export default RealityEditSidebarPanel;