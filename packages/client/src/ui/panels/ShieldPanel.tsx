/**
 * ShieldPanel - 护盾管理面板（完整重设计 v2）
 *
 * 护盾机制：
 * - 护盾拦截攻击，将伤害转换为硬辐能
 * - 伤害类型修正：KIN×2.0, HE×0.5, ENERGY×1.0, FRAG×0.25
 * - 硬辐能 = shieldDamage × efficiency
 * - 辐能满载 → 过载 → 护盾强制关闭
 *
 * 回合末辐能变化：
 * - 护盾开启：soft flux + upkeep（硬辐能不散失）
 * - 护盾关闭：soft/hard flux - dissipation
 *
 * 布局：
 * - 左列：操作按钮（开启/关闭/散辐 三行）
 * - 中列：辐能信息（容量、护盾信息、辐散、回合末预估）
 * - 右列：护盾朝向控制（非固定护盾）
 * - 最右：承伤预估
 */

import React, { useState, useEffect, useMemo } from "react";
import { Shield, Zap, AlertTriangle, RotateCw, Check, X } from "lucide-react";
import { Button, Flex, Box, Text, Badge, Progress, TextField } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import { DamageType, GAME_RULES } from "@vt/data";
import "./battle-panel-row.css";

const DAMAGE_TYPE_INFO: Record<DamageType, { label: string; color: string; multiplier: number }> = {
	KINETIC: { label: "动能", color: "#ff6f8f", multiplier: GAME_RULES.combat.damageModifiers.KINETIC?.shieldMultiplier ?? 2.0 },
	HIGH_EXPLOSIVE: { label: "高爆", color: "#ffaa00", multiplier: GAME_RULES.combat.damageModifiers.HIGH_EXPLOSIVE?.shieldMultiplier ?? 0.5 },
	ENERGY: { label: "能量", color: "#6ab4ff", multiplier: GAME_RULES.combat.damageModifiers.ENERGY?.shieldMultiplier ?? 1.0 },
	FRAGMENTATION: { label: "破片", color: "#8b8b8b", multiplier: GAME_RULES.combat.damageModifiers.FRAGMENTATION?.shieldMultiplier ?? 0.25 },
};

export interface ShieldPanelProps {
	canControl?: boolean;
}

export const ShieldPanel: React.FC<ShieldPanelProps> = ({ canControl = true }) => {
	const { isAvailable, sendShieldToggle, sendShieldRotate, sendVent } = useGameAction();

	const ship = useSelectedShip();
	const hasShip = ship && ship.runtime;
	const hasShieldSpec = Boolean(hasShip && ship.spec?.shield);

	const shieldSpec = hasShip ? ship.spec.shield : null;
	const shieldRuntime = hasShip ? ship.runtime.shield : null;

	const shieldActive = shieldRuntime?.active ?? false;
	const shieldDirection = shieldRuntime?.direction ?? 0;
	const shieldArc = shieldSpec?.arc ?? 360;
	const shieldEfficiency = shieldSpec?.efficiency ?? 1.0;
	const shieldUpkeep = shieldSpec?.upkeep ?? 0;
	const shieldFixed = shieldSpec?.fixed ?? false;
	const isOmniShield = shieldArc >= 360;

	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const venting = hasShip ? ship.runtime.venting : false;
	const destroyed = hasShip ? ship.runtime.destroyed : false;

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxCapacity = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;
	const fluxRemaining = fluxCapacity - fluxTotal;
	const fluxPct = fluxCapacity > 0 ? (fluxTotal / fluxCapacity) * 100 : 0;

	const fluxDissipation = hasShip ? (ship.spec.fluxDissipation ?? 0) : 0;

	const canAct = canControl && hasShip && isAvailable() && !destroyed;
	const canToggleShield = canAct && hasShieldSpec && !overloaded && !venting;
	const canRotateShield = canAct && hasShieldSpec && shieldActive && !overloaded && !shieldFixed && !isOmniShield;
	const canVent = canAct && fluxTotal > 0 && !venting && !overloaded;

	const [previewDirection, setPreviewDirection] = useState(shieldDirection);
	const [pendingDirection, setPendingDirection] = useState<number | null>(null);
	const [inputDamage, setInputDamage] = useState<number>(100);
	const [inputDamageStr, setInputDamageStr] = useState<string>("100");

	useEffect(() => {
		setPreviewDirection(shieldDirection);
		setPendingDirection(null);
	}, [shieldDirection]);

	// 处理输入变化，允许空值
	const handleInputDamageChange = (value: string) => {
		setInputDamageStr(value);
		if (value === "" || value === "0") {
			setInputDamage(1);
		} else {
			const num = Number(value);
			if (num > 0) setInputDamage(num);
		}
	};

	// 失焦时确保有效值
	const handleInputDamageBlur = () => {
		const num = Number(inputDamageStr);
		if (num <= 0 || !inputDamageStr) {
			setInputDamage(1);
			setInputDamageStr("1");
		}
	};

	// 计算回合末辐能变化
	const turnEndFluxChange = useMemo(() => {
		if (!hasShip) return null;

		// 护盾维持：添加软辐能
		const upkeep = shieldActive ? shieldUpkeep : 0;

		// 自然散失：
		// - 软辐能总是散失
		// - 硬辐能仅在护盾关闭时散失
		const softDissipation = Math.min(fluxSoft, fluxDissipation);
		const hardDissipation = shieldActive ? 0 : Math.min(fluxHard, fluxDissipation);

		const softChange = upkeep - softDissipation;
		const hardChange = -hardDissipation;
		const totalChange = softChange + hardChange;

		const projectedSoft = fluxSoft + softChange;
		const projectedHard = fluxHard + hardChange;
		const projectedTotal = projectedSoft + projectedHard;
		const projectedPct = (projectedTotal / fluxCapacity) * 100;

		return {
			upkeep,
			dissipation: fluxDissipation,
			softDissipation,
			hardDissipation,
			softChange,
			hardChange,
			totalChange,
			projectedSoft,
			projectedHard,
			projectedTotal,
			projectedPct,
			willOverload: projectedTotal >= fluxCapacity && !overloaded,
		};
	}, [hasShip, shieldActive, shieldUpkeep, fluxSoft, fluxHard, fluxDissipation, fluxCapacity, overloaded]);

	// 承伤预估（基于输入伤害）
	const damageCapacity = useMemo(() => {
		if (!hasShieldSpec || !shieldActive || inputDamage <= 0) return null;

		const result: Record<DamageType, { maxDamage: number; maxHits: number }> = {} as any;

		for (const type of Object.keys(DAMAGE_TYPE_INFO) as DamageType[]) {
			const info = DAMAGE_TYPE_INFO[type];
			const maxDamage = fluxRemaining / (info.multiplier * shieldEfficiency);
			const maxHits = Math.floor(maxDamage / inputDamage);
			result[type] = {
				maxDamage: Math.floor(maxDamage),
				maxHits,
			};
		}

		return result;
	}, [hasShieldSpec, shieldActive, fluxRemaining, shieldEfficiency, inputDamage]);

	const handleOpenShield = async () => {
		if (!canToggleShield || shieldActive) return;
		await sendShieldToggle(ship.$id, true);
	};

	const handleCloseShield = async () => {
		if (!canToggleShield || !shieldActive) return;
		await sendShieldToggle(ship.$id, false);
	};

	const handleVent = async () => {
		if (!canVent) return;
		await sendVent(ship.$id);
	};

	const handleDirectionPreview = (direction: number) => {
		setPreviewDirection(direction);
		setPendingDirection(direction);
		if (ship) useUIStore.getState().setShieldDirectionPreview(ship.$id, direction);
	};

	const handleConfirmDirection = async () => {
		if (!canRotateShield || pendingDirection === null) return;
		await sendShieldRotate(ship.$id, pendingDirection);
		setPendingDirection(null);
		if (ship) useUIStore.getState().setShieldDirectionPreview(ship.$id, undefined);
	};

	const handleCancelDirection = () => {
		setPreviewDirection(shieldDirection);
		setPendingDirection(null);
		if (ship) useUIStore.getState().setShieldDirectionPreview(ship.$id, undefined);
	};

	if (!hasShip) {
		return <Box className="battle-row battle-row--empty"><Text size="2" color="gray">选择舰船后可管理护盾</Text></Box>;
	}

	if (!hasShieldSpec) {
		return <Box className="battle-row battle-row--empty"><Shield size={14} style={{ color: "#6b8aaa" }} /><Text size="2" color="gray">无护盾装备</Text></Box>;
	}

	return (
		<Box className="battle-row">
			{/* 左列：操作按钮（三行） */}
			<Box className="battle-col battle-col--narrow" style={{ maxWidth: 70, padding: 0 }}>
				<Box style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "6px 4px" }}>
					<Button size="2" variant={shieldActive ? "soft" : "solid"} color="blue" onClick={handleOpenShield} disabled={!canToggleShield || shieldActive} style={{ flex: 1, minHeight: 36 }}>
						<Shield size={14} /> 开启
					</Button>
					<Button size="2" variant={!shieldActive ? "soft" : "solid"} color="gray" onClick={handleCloseShield} disabled={!canToggleShield || !shieldActive} style={{ flex: 1, minHeight: 36 }}>
						<X size={14} /> 关闭
					</Button>
					<Button size="2" variant="soft" color="purple" onClick={handleVent} disabled={!canVent} style={{ flex: 1, minHeight: 36 }}>
						<Zap size={14} /> 散辐
					</Button>
				</Box>
			</Box>

			<Box className="battle-divider" />

			{/* 中列：辐能信息 */}
			<Box className="battle-col" style={{ flex: 1.5, minWidth: 140 }}>
				<Flex className="battle-col__header" align="center" gap="1">
					<Zap size={12} style={{ color: overloaded ? "#ff4444" : fluxPct > 80 ? "#ffaa00" : "#6ab4ff" }} />
					<Text size="1" weight="bold">辐能</Text>
					{overloaded && <Badge size="1" color="red"><AlertTriangle size={10} /> 过载</Badge>}
					{venting && <Badge size="1" color="purple">散辐中</Badge>}
				</Flex>
				<Box className="battle-col__content" style={{ padding: "4px 6px" }}>
					{/* 进度条 */}
					<Box style={{ marginBottom: 4 }}>
						<Progress value={fluxPct} color={fluxPct > 90 ? "red" : fluxPct > 70 ? "yellow" : "blue"} style={{ height: 8, borderRadius: 2 }} />
						<Flex justify="between" style={{ marginTop: 2 }}>
							<Flex gap="2" align="center">
								<Box style={{ width: 6, height: 6, borderRadius: 2, background: "#6ab4ff" }} />
								<Text size="1" color="gray">{fluxSoft}</Text>
								<Box style={{ width: 6, height: 6, borderRadius: 2, background: "#ff6f8f" }} />
								<Text size="1" color="gray">{fluxHard}</Text>
							</Flex>
							<Text size="1" weight="bold" style={{ color: "#cfe8ff" }}>{fluxTotal}/{fluxCapacity}</Text>
						</Flex>
					</Box>
					
					{/* 两列信息 */}
					<Flex className="battle-info__cols" gap="2">
						<Flex direction="column" gap="1" style={{ flex: 1 }}>
							<Flex className="battle-stat-row" justify="between">
								<Text size="1" color="gray">辐散</Text>
								<Text size="1">{fluxDissipation}</Text>
							</Flex>
							<Flex className="battle-stat-row" justify="between">
								<Text size="1" color="gray">剩余</Text>
								<Text size="1">{fluxRemaining}</Text>
							</Flex>
							{turnEndFluxChange && (
								<Flex className="battle-stat-row" justify="between">
									<Text size="1" color="gray">回合末</Text>
									<Text size="1" style={{ color: turnEndFluxChange.totalChange > 0 ? "#ff6f8f" : turnEndFluxChange.totalChange < 0 ? "#2ecc71" : "#6b8aaa" }}>
										{turnEndFluxChange.projectedTotal}
									</Text>
								</Flex>
							)}
						</Flex>
						<Flex direction="column" gap="1" style={{ flex: 1 }}>
							<Flex className="battle-stat-row" justify="between">
								<Text size="1" color="gray">护盾</Text>
								<Text size="1" style={{ color: shieldActive ? "#4a9eff" : "#6b8aaa" }}>{isOmniShield ? "360°" : `${shieldArc}°`}</Text>
							</Flex>
							<Flex className="battle-stat-row" justify="between">
								<Text size="1" color="gray">效率</Text>
								<Text size="1">{shieldEfficiency.toFixed(1)}</Text>
							</Flex>
							<Flex className="battle-stat-row" justify="between">
								<Text size="1" color="gray">维持</Text>
								<Text size="1" style={{ color: shieldActive ? "orange" : "gray" }}>{shieldActive ? `+${shieldUpkeep}` : "—"}</Text>
							</Flex>
						</Flex>
					</Flex>
				</Box>
			</Box>

			{/* 护盾朝向 */}
			<Box className="battle-divider" />
			<Box className="battle-col" style={{ flex: 1, minWidth: 90, opacity: shieldFixed ? 0.4 : 1 }}>
				<Flex className="battle-col__header" align="center" gap="1">
					<RotateCw size={12} />
					<Text size="1" weight="bold">转向</Text>
					{shieldFixed && <Badge size="1" color="gray">固定</Badge>}
					{isOmniShield && <Badge size="1" color="blue">全向</Badge>}
				</Flex>
				<Box className="battle-col__content" style={{ flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 6px" }}>
					{/* 角度显示器 */}
					<Text size="2" weight="bold" style={{ color: shieldFixed ? "#6b8aaa" : "#cfe8ff" }}>
						{previewDirection}°
					</Text>
					
					{/* 竖直滑动条 */}
					<Box style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
						<input
							type="range"
							min={0}
							max={360}
							step={15}
							value={previewDirection}
							onChange={(e) => handleDirectionPreview(Number(e.target.value))}
							disabled={shieldFixed || isOmniShield || !canRotateShield}
							style={{
								width: 80,
								transform: "rotate(-90deg)",
								opacity: shieldFixed || isOmniShield ? 0.3 : 1,
							}}
						/>
					</Box>
					
					{/* 执行按钮 */}
					{!shieldFixed && !isOmniShield && (
						pendingDirection !== null && pendingDirection !== shieldDirection ? (
							<Flex gap="1">
								<Button size="1" variant="solid" color="green" onClick={handleConfirmDirection} disabled={!canRotateShield}>
									<Check size={12} />
								</Button>
								<Button size="1" variant="soft" color="gray" onClick={handleCancelDirection}>
									<X size={12} />
								</Button>
							</Flex>
						) : (
							<Text size="1" color="gray">{!shieldActive ? "需开启" : "调整滑块"}</Text>
						)
					)}
				</Box>
			</Box>

			<Box className="battle-divider" />

			{/* 承伤预估 */}
			<Box className="battle-col" style={{ flex: 1.2, minWidth: 120 }}>
				<Flex className="battle-col__header" align="center" gap="2">
					<Text size="1" weight="bold">承伤</Text>
					{!shieldActive && <Badge size="1" color="gray">关闭</Badge>}
				</Flex>
				<Box className="battle-col__content" style={{ padding: "4px 6px" }}>
					{damageCapacity ? (
						<>
							{/* 伤害输入 */}
							<Flex align="center" gap="2" style={{ marginBottom: 4, padding: "2px 4px", background: "rgba(10, 25, 50, 0.3)", borderRadius: 2 }}>
								<Text size="1" color="gray">武器伤害</Text>
								<TextField.Root
									size="1"
									value={inputDamageStr}
									onChange={(e) => handleInputDamageChange(e.target.value)}
									onBlur={handleInputDamageBlur}
									style={{ width: 60 }}
								/>
							</Flex>
							
							{/* 各类型：一行显示伤害和击数 */}
							<Flex direction="column" gap="1">
								{(Object.keys(DAMAGE_TYPE_INFO) as DamageType[]).map((type) => {
									const info = DAMAGE_TYPE_INFO[type];
									const cap = damageCapacity[type];
									return (
										<Flex key={type} className="battle-stat-row" justify="between" align="center" gap="2">
											<Flex gap="1" align="center" style={{ minWidth: 50 }}>
												<Box style={{ width: 6, height: 6, borderRadius: 2, background: info.color }} />
												<Text size="1" color="gray">{info.label}</Text>
											</Flex>
											<Text size="1" style={{ minWidth: 40 }}>~{cap.maxDamage}</Text>
											<Text size="1" weight="bold" style={{ minWidth: 30, color: cap.maxHits > 3 ? "#2ecc71" : cap.maxHits > 1 ? "#f1c40f" : "#e74c3c" }}>
												{cap.maxHits}击
											</Text>
										</Flex>
									);
								})}
							</Flex>
						</>
					) : (
						<Text size="1" color="gray" style={{ textAlign: "center", padding: 8 }}>护盾关闭</Text>
					)}
				</Box>
			</Box>
		</Box>
	);
};

export default ShieldPanel;