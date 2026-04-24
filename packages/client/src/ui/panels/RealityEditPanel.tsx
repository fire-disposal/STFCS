/**
 * 现实修改面板 - 横向布局，支持表单/JSON 双模式
 * 参考 LoadoutCustomizerDialog 风格，提供 CombatToken 的运行时和规格编辑
 */

import React, { useCallback, useEffect, useState } from "react";
import {
	Badge,
	Box,
	Button,
	Flex,
	Select,
	Switch,
	Tabs,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { RotateCcw, Save, Trash2, User, Code, ShieldCheck, Crosshair, Zap, Move } from "lucide-react";
import type { CombatToken, RoomPlayerState, TokenRuntime, TokenSpec } from "@vt/data";
import { notify } from "@/ui/shared/Notification";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel.css";

export interface RealityEditPanelProps {
	ship: CombatToken | null;
	players: Record<string, RoomPlayerState>;
	onSubmit?: (shipId: string, runtimeData: Partial<TokenRuntime>) => void;
}

// ===== 辅助函数 =====

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function shortId(id: string): string {
	if (id.startsWith("preset:")) return id.slice(7);
	return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

/** 从 CombatToken 提取可编辑的运行时草稿 */
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
		faction: r.faction,
		venting: r.venting ?? false,
		displayName: r.displayName,
	};
}

/** 从 CombatToken 提取可编辑的规格草稿 */
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

// ===== 武器运行时编辑子组件 =====

// ===== 主面板 =====

export const RealityEditPanel: React.FC<RealityEditPanelProps> = ({ ship, players, onSubmit }) => {
	const { send } = useGameAction();
	const [editMode, setEditMode] = useState(false);
	const [activeTab, setActiveTab] = useState("runtime");

	// 运行时草稿
	const [runtimeDraft, setRuntimeDraft] = useState<TokenRuntime | null>(null);
	// 规格草稿
	const [specDraft, setSpecDraft] = useState<Partial<TokenSpec> | null>(null);
	// JSON 草稿
	const [jsonText, setJsonText] = useState("");
	// JSON 解析错误
	const [jsonError, setJsonError] = useState<string | null>(null);

	const [selectedOwnerId, setSelectedOwnerId] = useState<string>("__none__");

	const playerList = Object.values(players).filter((p) => p.connected);

	// 当选中舰船变化时初始化草稿
	useEffect(() => {
		if (!ship) return;
		setRuntimeDraft(extractRuntimeDraft(ship));
		setSpecDraft(extractSpecDraft(ship));
		setJsonText(JSON.stringify(ship, null, 2));
		setJsonError(null);
		setSelectedOwnerId(ship.metadata?.owner || "__none__");
	}, [ship]);

	// ===== 运行时字段更新辅助 =====
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

	// ===== 规格字段更新 =====
	const updateSpec = useCallback((field: string, value: unknown) => {
		setSpecDraft((prev) => {
			if (!prev) return prev;
			return { ...prev, [field]: value };
		});
	}, []);

	// ===== 重置 =====
	const handleReset = useCallback(() => {
		if (!ship) return;
		setRuntimeDraft(extractRuntimeDraft(ship));
		setSpecDraft(extractSpecDraft(ship));
		setJsonText(JSON.stringify(ship, null, 2));
		setJsonError(null);
		setSelectedOwnerId(ship.metadata?.owner || "__none__");
		setEditMode(false);
	}, [ship]);

	// ===== 保存 =====
	const handleSave = useCallback(async () => {
		if (!ship || !runtimeDraft) return;

		try {
			const r = runtimeDraft;

			// 逐个字段发送修改
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
			if (r.modifiers) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/modifiers", value: r.modifiers });
			}
			if (r.faction !== undefined) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/faction", value: r.faction });
			}
			if (r.displayName !== undefined) {
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "runtime/displayName", value: r.displayName });
			}

			// 保存规格字段
			if (specDraft) {
				for (const [key, value] of Object.entries(specDraft)) {
					if (value !== undefined && (ship.spec as any)[key] !== value) {
						await send("edit:token", { action: "modify", tokenId: ship.$id, path: `spec/${key}`, value });
					}
				}
			}

			// 更新所有者
			if (selectedOwnerId !== (ship.metadata?.owner || "__none__")) {
				const newOwner = selectedOwnerId === "__none__" ? "" : selectedOwnerId;
				await send("edit:token", { action: "modify", tokenId: ship.$id, path: "metadata/owner", value: newOwner });
			}

			onSubmit?.(ship.$id, r);
			notify.success("舰船数据已保存");
			setEditMode(false);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "保存失败");
		}
	}, [ship, runtimeDraft, specDraft, selectedOwnerId, send, onSubmit]);

	// ===== JSON 保存 =====
	const handleJsonSave = useCallback(async () => {
		if (!ship) return;
		try {
			const parsed = JSON.parse(jsonText);
			if (!parsed.$id) throw new Error("缺少 $id");
			if (!parsed.runtime) throw new Error("缺少 runtime");

			// 通过 modify 逐个字段应用
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

	// ===== 删除 =====
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

	// ===== 快速操作 =====
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

	const handleQuickReset = useCallback(async () => {
		if (!ship) return;
		try {
			await send("edit:token", { action: "reset", tokenId: ship.$id });
			notify.success("舰船状态已重置");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "重置失败");
		}
	}, [ship, send]);

	// ===== 当前所有者名称 =====
	const currentOwnerName = selectedOwnerId === "__none__"
		? "无所有者"
		: players[selectedOwnerId]?.nickname ?? "未知";

	if (!ship) {
		return (
			<Flex align="center" gap="4" className="panel-row">
				<Text size="7">📝</Text>
				<Text size="2" color="gray">选择舰船后可编辑</Text>
			</Flex>
		);
	}

	return (
		<Flex className="panel-row" gap="3" style={{ minWidth: 0, flex: 1 }}>
			{/* ===== 左列：锁定状态 + Tab 切换 ===== */}
			<Flex direction="column" gap="2" style={{ minWidth: 80 }}>
				{/* 锁定/编辑开关 */}
				<Flex className="panel-section panel-section--vertical" gap="1" align="center" style={{ padding: "8px 12px" }}>
					<Switch checked={editMode} onCheckedChange={setEditMode} />
					<Badge size="2" color={editMode ? "blue" : "gray"}>{editMode ? "编辑中" : "已锁定"}</Badge>
				</Flex>

				{/* Tab 切换 — 垂直排列 */}
				<Flex className="panel-section panel-section--vertical" gap="1" style={{ padding: "8px 8px" }}>
					<Text className="panel-section__label" style={{ paddingLeft: 4, marginBottom: 2 }}>模式</Text>
					<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
						<Tabs.List style={{ flexDirection: "column", gap: 2, width: "100%" }}>
							<Tabs.Trigger value="runtime" style={{ justifyContent: "flex-start", width: "100%", padding: "6px 10px", fontSize: 13 }}>
								<Move size={14} /> 运行时
							</Tabs.Trigger>
							<Tabs.Trigger value="spec" style={{ justifyContent: "flex-start", width: "100%", padding: "6px 10px", fontSize: 13 }}>
								<Crosshair size={14} /> 规格
							</Tabs.Trigger>
							<Tabs.Trigger value="json" style={{ justifyContent: "flex-start", width: "100%", padding: "6px 10px", fontSize: 13 }}>
								<Code size={14} /> JSON
							</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* ===== 中间：Tab 内容区 ===== */}
			<Flex className="panel-section panel-section--vertical" gap="2" style={{ flex: 1, minWidth: 280, overflow: "hidden" }}>
				<Box style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
					{/* ===== 运行时 Tab ===== */}
					{activeTab === "runtime" && runtimeDraft && (
						<Flex gap="3" wrap="wrap">
							{/* 基础属性 */}
							<Flex direction="column" gap="2" className="panel-section">
								<Text className="panel-section__label">基础</Text>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>位置X</Text>
									<TextField.Root
										size="2"
										type="number"
										value={runtimeDraft.position.x}
										onChange={(e) => updateRuntimeNested("position", "x", Number(e.target.value) || 0)}
										style={{ width: 70 }}
									/>
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>位置Y</Text>
									<TextField.Root
										size="2"
										type="number"
										value={runtimeDraft.position.y}
										onChange={(e) => updateRuntimeNested("position", "y", Number(e.target.value) || 0)}
										style={{ width: 70 }}
									/>
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>朝向</Text>
									<TextField.Root
										size="2"
										type="number"
										value={runtimeDraft.heading}
										onChange={(e) => updateRuntime("heading", Number(e.target.value) || 0)}
										style={{ width: 70 }}
									/>
									<Text size="2" style={{ color: "#6b8aaa" }}>°</Text>
								</Flex>
							</Flex>

							{/* 状态 */}
							<Flex direction="column" gap="2" className="panel-section">
								<Text className="panel-section__label">状态</Text>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>船体</Text>
									<TextField.Root
										size="2"
										type="number"
										value={runtimeDraft.hull}
										onChange={(e) => updateRuntime("hull", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }}
									/>
									<Text size="2" style={{ color: "#8ba4c7" }}>/ {ship.spec.maxHitPoints}</Text>
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>软辐能</Text>
									<TextField.Root
										size="2"
										type="number"
										value={runtimeDraft.fluxSoft}
										onChange={(e) => updateRuntime("fluxSoft", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }}
									/>
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>硬辐能</Text>
									<TextField.Root
										size="2"
										type="number"
										value={runtimeDraft.fluxHard}
										onChange={(e) => updateRuntime("fluxHard", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }}
									/>
								</Flex>
								<Flex align="center" gap="3">
									<Flex align="center" gap="2">
										<Text size="2" style={{ color: "#6b8aaa" }}>过载</Text>
										<Switch
											checked={runtimeDraft.overloaded}
											onCheckedChange={(v) => updateRuntime("overloaded", v)}
										/>
									</Flex>
									<Flex align="center" gap="2">
										<Text size="2" style={{ color: "#6b8aaa" }}>摧毁</Text>
										<Switch
											checked={runtimeDraft.destroyed}
											onCheckedChange={(v) => updateRuntime("destroyed", v)}
										/>
									</Flex>
									<Flex align="center" gap="2">
										<Text size="2" style={{ color: "#6b8aaa" }}>排热</Text>
										<Switch
											checked={runtimeDraft.venting ?? false}
											onCheckedChange={(v) => updateRuntime("venting", v)}
										/>
									</Flex>
								</Flex>
							</Flex>

							{/* 护盾 + 移动 + 所有者 */}
							<Flex gap="3" wrap="wrap">
								{runtimeDraft.shield && (
									<Flex direction="column" gap="2" className="panel-section">
										<Text className="panel-section__label"><ShieldCheck size={14} /> 护盾</Text>
										<Flex align="center" gap="2">
											<Text size="2" style={{ color: "#6b8aaa" }}>激活</Text>
											<Switch
												checked={runtimeDraft.shield.active}
												onCheckedChange={(v) => updateRuntimeNested("shield", "active", v)}
											/>
										</Flex>
										<Flex align="center" gap="2">
											<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>方向</Text>
											<TextField.Root
												size="2"
												type="number"
												value={runtimeDraft.shield.direction ?? 0}
												onChange={(e) => updateRuntimeNested("shield", "direction", Number(e.target.value) || 0)}
												style={{ width: 70 }}
											/>
											<Text size="2" style={{ color: "#6b8aaa" }}>°</Text>
										</Flex>
									</Flex>
								)}

								<Flex direction="column" gap="2" className="panel-section">
									<Text className="panel-section__label"><Zap size={14} /> 移动</Text>
									<Flex align="center" gap="2">
										<Text size="2" style={{ color: "#6b8aaa", minWidth: 44 }}>阶段</Text>
										<Select.Root
											value={runtimeDraft.movement?.currentPhase ?? "A"}
											onValueChange={(v) => updateRuntime("movement", { ...runtimeDraft.movement, currentPhase: v })}
										>
											<Select.Trigger style={{ width: 80 }} />
											<Select.Content>
												<Select.Item value="A">A</Select.Item>
												<Select.Item value="B">B</Select.Item>
												<Select.Item value="C">C</Select.Item>
												<Select.Item value="DONE">完成</Select.Item>
											</Select.Content>
										</Select.Root>
									</Flex>
									<Flex align="center" gap="3">
										<Flex align="center" gap="2">
											<Text size="2" style={{ color: "#6b8aaa" }}>移动</Text>
											<Switch
												checked={runtimeDraft.movement?.hasMoved ?? false}
												onCheckedChange={(v) => updateRuntime("movement", { ...runtimeDraft.movement, hasMoved: v })}
											/>
										</Flex>
										<Flex align="center" gap="2">
											<Text size="2" style={{ color: "#6b8aaa" }}>开火</Text>
											<Switch
												checked={runtimeDraft.hasFired}
												onCheckedChange={(v) => updateRuntime("hasFired", v)}
											/>
										</Flex>
									</Flex>
								</Flex>

								<Flex direction="column" gap="2" className="panel-section">
									<Text className="panel-section__label"><User size={14} /> 所有者</Text>
									<Select.Root value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
										<Select.Trigger style={{ width: 130 }} />
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
							</Flex>
						</Flex>
					)}

					{/* ===== 规格 Tab ===== */}
					{activeTab === "spec" && specDraft && (
						<Flex gap="3" wrap="wrap">
							<Flex direction="column" gap="2" className="panel-section">
								<Text className="panel-section__label">战斗属性</Text>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>最大HP</Text>
									<TextField.Root size="2" type="number" value={specDraft.maxHitPoints}
										onChange={(e) => updateSpec("maxHitPoints", Math.max(1, Number(e.target.value) || 1))}
										style={{ width: 70 }} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>护甲/象限</Text>
									<TextField.Root size="2" type="number" value={specDraft.armorMaxPerQuadrant}
										onChange={(e) => updateSpec("armorMaxPerQuadrant", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>辐能容量</Text>
									<TextField.Root size="2" type="number" value={specDraft.fluxCapacity ?? 0}
										onChange={(e) => updateSpec("fluxCapacity", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>辐能耗散</Text>
									<TextField.Root size="2" type="number" value={specDraft.fluxDissipation ?? 0}
										onChange={(e) => updateSpec("fluxDissipation", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }} />
								</Flex>
							</Flex>
							<Flex direction="column" gap="2" className="panel-section">
								<Text className="panel-section__label">机动属性</Text>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>最大速度</Text>
									<TextField.Root size="2" type="number" value={specDraft.maxSpeed}
										onChange={(e) => updateSpec("maxSpeed", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>最大转向</Text>
									<TextField.Root size="2" type="number" value={specDraft.maxTurnRate}
										onChange={(e) => updateSpec("maxTurnRate", Math.max(0, Number(e.target.value) || 0))}
										style={{ width: 70 }} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>宽度</Text>
									<TextField.Root size="2" type="number" value={specDraft.width ?? 30}
										onChange={(e) => updateSpec("width", Math.max(1, Number(e.target.value) || 1))}
										style={{ width: 70 }} />
								</Flex>
								<Flex align="center" gap="2">
									<Text size="2" style={{ color: "#6b8aaa", minWidth: 70 }}>长度</Text>
									<TextField.Root size="2" type="number" value={specDraft.length ?? 50}
										onChange={(e) => updateSpec("length", Math.max(1, Number(e.target.value) || 1))}
										style={{ width: 70 }} />
								</Flex>
							</Flex>
						</Flex>
					)}

					{/* ===== JSON Tab ===== */}
					{activeTab === "json" && (
						<Flex gap="3" align="start" style={{ width: "100%" }}>
							<Box style={{ flex: 1, minWidth: 0 }}>
								<TextArea size="2" value={jsonText}
									onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
									style={{
										width: "100%", minHeight: 100,
										fontFamily: '"Fira Code", "Consolas", monospace',
										fontSize: 12, background: "rgba(0,8,18,0.6)",
										borderColor: "rgba(43,66,97,0.4)", color: "#cfe8ff",
									}} />
								{jsonError && <Text size="2" color="red" style={{ marginTop: 4 }}>{jsonError}</Text>}
							</Box>
							<Button size="2" variant="solid" color="green" onClick={handleJsonSave}>
								<Save size={14} /> 应用
							</Button>
						</Flex>
					)}
				</Box>
			</Flex>

			{editMode && (
				<>
					<Box className="panel-divider" />

					{/* ===== 右列：快捷功能按钮（纵向排列） ===== */}
					<Flex direction="column" gap="1" className="panel-section" style={{ minWidth: 70, padding: "8px 10px" }}>
						<Text className="panel-section__label" style={{ textAlign: "center", width: "100%", marginBottom: 4 }}>操作</Text>
						<Button size="2" variant="soft" color="green" onClick={handleQuickHeal} title="完全修复" style={{ width: "100%" }}>
							修复
						</Button>
						<Button size="2" variant="soft" color="orange" onClick={() => handleQuickDamage(100)} title="造成100伤害" style={{ width: "100%" }}>
							-100
						</Button>
						<Button size="2" variant="soft" color="red" onClick={() => handleQuickDamage(500)} title="造成500伤害" style={{ width: "100%" }}>
							-500
						</Button>
						<Button size="2" variant="soft" color="gray" onClick={handleQuickReset} title="重置状态" style={{ width: "100%" }}>
							状态
						</Button>
						<Box style={{ width: "100%", height: 1, background: "rgba(74,158,255,0.15)", margin: "2px 0" }} />
						<Button size="2" variant="soft" color="red" onClick={handleDelete} style={{ width: "100%" }}>
							删除
						</Button>
						<Button size="2" variant="soft" onClick={handleReset} style={{ width: "100%" }}>
							重置
						</Button>
						<Button size="2" variant="solid" color="green" onClick={handleSave} style={{ width: "100%" }}>
							保存
						</Button>
					</Flex>
				</>
			)}
		</Flex>
	);
};

export default RealityEditPanel;
