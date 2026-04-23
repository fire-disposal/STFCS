/**
 * WeaponPanel - 武器火控面板（参考主分支四列布局）
 * 
 * 数据流设计：
 * 1. 火控数据通过 game:query { type: "targets" } 获取（服务端权威）
 * 2. UI 状态通过 useState 存储（仅 ID）
 * 3. 支持多目标选择、武器状态指示、距离显示
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Crosshair, Bomb, CheckCircle, XCircle, Swords, Loader2 } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Button, Flex, Box, Text, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import { UI_CONFIG } from "@/config/constants";
import "./weapon-panel.css";

const DAMAGE_TYPE_COLORS = UI_CONFIG.COLORS.DAMAGE_TYPE;

interface WeaponStatus {
	mountId: string;
	name: string;
	damageType: string;
	state: string;
	canFire: boolean;
	hasFired: boolean;
	cooldown: number;
	fluxCost: number;
	range: number;
	minRange: number;
	arc: number;
	burstCount: number;
	ammo?: { current: number; max: number };
	reason?: string;
	mountName?: string;
	weaponDisplayName?: string;
}

interface TargetInfo {
	id: string;
	name: string;
	distance: number;
	inRange: boolean;
	inArc: boolean;
	canAttack: boolean;
	isFriendly: boolean;
}

interface WeaponTargetingData {
	mountId: string;
	validTargets: TargetInfo[];
	uiStatus: "FIRED" | "UNAVAILABLE" | "READY" | "READY_WITH_TARGETS";
}

export interface WeaponPanelProps {
	ship: CombatToken | null;
	canControl: boolean;
}

export const WeaponPanel: React.FC<WeaponPanelProps> = ({ ship, canControl }) => {
	const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
	const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [allWeaponsTargeting, setAllWeaponsTargeting] = useState<Map<string, WeaponTargetingData>>(new Map());

	const { isAvailable, sendAttack, sendQuery } = useGameAction();

	const hasShip = ship && ship.runtime;
	const canAct = canControl && hasShip && isAvailable;

	// 计算武器列表和状态
	const weapons = useMemo<WeaponStatus[]>(() => {
		if (!hasShip) return [];

		const spec = ship.spec;
		const runtime = ship.runtime;

		return (spec.mounts ?? [])
			.filter((m) => m.weapon)
			.map((m) => {
				const weaponSpec = m.weapon!.spec;
				const weaponRuntime = runtime?.weapons?.find((w) => w.mountId === m.id);
				const hasFired = weaponRuntime?.state === "FIRED";
				const cooldown = weaponRuntime?.cooldownRemaining ?? 0;
				const state = weaponRuntime?.state ?? "READY";

				let canFire = state === "READY" && cooldown === 0 && !hasFired && !runtime?.overloaded;
				let reason: string | undefined;

				if (runtime?.overloaded) {
					canFire = false;
					reason = "舰船过载";
				} else if (state !== "READY") {
					canFire = false;
					reason = state === "COOLDOWN" ? `冷却中 (${cooldown}s)` : `状态: ${state}`;
				} else if (hasFired) {
					canFire = false;
					reason = "本回合已射击";
				}

				return {
					mountId: m.id,
					name: (weaponSpec as any).displayName ?? (weaponSpec as any).name ?? m.id,
					damageType: weaponSpec.damageType,
					state,
					canFire,
					hasFired,
					cooldown,
					fluxCost: (weaponSpec as any).fluxPerShot ?? (weaponSpec as any).fluxCost ?? 0,
					range: weaponSpec.range ?? 1000,
					minRange: weaponSpec.minRange ?? 0,
					arc: m.arc,
					burstCount: weaponSpec.burstCount ?? 1,
					ammo: undefined,
					reason,
					mountName: m.id,
					weaponDisplayName: (m.weapon as any)?.metadata?.name ?? (m.weapon as any)?.$id ?? m.id,
				};
			});
	}, [hasShip, ship]);

	// 查询火控数据（整个舰船所有武器）
	useEffect(() => {
		if (!canAct) {
			setAllWeaponsTargeting(new Map());
			return;
		}

		const fetchTargeting = async () => {
			setIsLoading(true);
			try {
				const result = await sendQuery("targets", ship!.$id);
				if (result && result.weapons) {
					const map = new Map<string, WeaponTargetingData>();
					for (const weaponData of result.weapons) {
						const validTargets: TargetInfo[] = (weaponData.validTargets ?? []).map((t: any) => ({
							id: t.targetId,
							name: t.targetName ?? t.targetId.slice(-6),
							distance: t.distance ?? 0,
							inRange: t.inRange ?? false,
							inArc: t.inArc ?? false,
							canAttack: t.inRange && t.inArc,
							isFriendly: t.faction === "PLAYER",
						}));
						map.set(weaponData.mountId, {
							mountId: weaponData.mountId,
							validTargets,
							uiStatus: weaponData.uiStatus ?? "READY",
						});
					}
					setAllWeaponsTargeting(map);
				}
			} catch (error) {
				console.warn("Failed to query targeting data:", error);
			}
			setIsLoading(false);
		};

		fetchTargeting();
	}, [canAct, ship, sendQuery]);

	// 默认选中第一个可用武器
	useEffect(() => {
		if (weapons.length > 0 && !selectedWeaponId) {
			const firstAvailable = weapons.find((w) => w.canFire);
			if (firstAvailable) {
				setSelectedWeaponId(firstAvailable.mountId);
			} else {
				setSelectedWeaponId(weapons[0].mountId);
			}
		}
	}, [weapons, selectedWeaponId]);

	// 当前武器
	const currentWeapon = useMemo(() => {
		return weapons.find((w) => w.mountId === selectedWeaponId) ?? null;
	}, [weapons, selectedWeaponId]);

	// 可攻击目标列表（当前选中武器）
	const attackableTargets = useMemo(() => {
		const weaponData = allWeaponsTargeting.get(selectedWeaponId ?? "");
		if (!weaponData) return [];
		return weaponData.validTargets.filter((t) => t.canAttack);
	}, [allWeaponsTargeting, selectedWeaponId]);

	// 选择武器
	const handleSelectWeapon = useCallback((weapon: WeaponStatus) => {
		setSelectedWeaponId(weapon.mountId);
		setSelectedTargetIds([]);
	}, []);

	// 选择目标（支持多选）
	const handleSelectTarget = useCallback((targetId: string) => {
		if (selectedTargetIds.includes(targetId)) {
			setSelectedTargetIds(selectedTargetIds.filter((id) => id !== targetId));
		} else {
			setSelectedTargetIds([...selectedTargetIds, targetId]);
		}
	}, [selectedTargetIds]);

	// 开火
	const handleFire = useCallback(async () => {
		if (!canAct || !selectedWeaponId || selectedTargetIds.length === 0) return;

		try {
			await sendAttack(ship!.$id, [{
				mountId: selectedWeaponId,
				targets: selectedTargetIds.map((t) => ({ targetId: t, shots: 1 })),
			}]);
			setSelectedTargetIds([]);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "开火失败");
		}
	}, [canAct, selectedWeaponId, selectedTargetIds, ship, sendAttack]);

	// 空状态
	if (!hasShip || weapons.length === 0) {
		return (
			<Flex className="weapon-panel weapon-panel--empty" gap="2" align="center">
				<Crosshair size={14} />
				<Text size="1" color="gray">无武器</Text>
			</Flex>
		);
	}

	return (
		<Flex className="weapon-panel" gap="2">
			{/* 列1：武器列表 */}
			<Box className="weapon-col weapon-col--list">
				<Flex className="weapon-col__header" align="center" gap="1">
					<Crosshair size={12} />
					<Text size="1" weight="bold">武器</Text>
				</Flex>
				<Box className="weapon-col__content">
					{weapons.map((w) => {
						// 指示灯颜色：从目标数据获取 uiStatus
						// 红=不可用, 黄=已开火, 绿=待命无目标, 蓝=待命有目标
						const targetingData = allWeaponsTargeting.get(w.mountId);
						let indicatorColor: string;
						if (targetingData) {
							switch (targetingData.uiStatus) {
								case "UNAVAILABLE": indicatorColor = "red"; break;
								case "FIRED": indicatorColor = "yellow"; break;
								case "READY": indicatorColor = "green"; break;
								case "READY_WITH_TARGETS": indicatorColor = "blue"; break;
								default: indicatorColor = "green";
							}
						} else {
							// 回退逻辑
							indicatorColor = !w.canFire ? "red" : w.hasFired ? "yellow" : "green";
						}

						return (
							<Flex
								key={w.mountId}
								className={`weapon-item ${!w.canFire ? "weapon-item--blocked" : ""} ${w.hasFired ? "weapon-item--fired" : ""} ${selectedWeaponId === w.mountId ? "weapon-item--selected" : ""}`}
								align="center"
								gap="2"
								onClick={() => handleSelectWeapon(w)}
								title={w.reason ?? w.name}
							>
								<Box className={`weapon-indicator weapon-indicator--${indicatorColor}`} />
								<Text size="1" className="weapon-item__name">{w.mountName} / {w.weaponDisplayName}</Text>
							</Flex>
						);
					})}
				</Box>
			</Box>

			{/* 列2：武器信息 */}
			{currentWeapon && (
				<Box className="weapon-col weapon-col--info">
					<Flex className="weapon-col__header" align="center" gap="2">
						<Text size="1" weight="bold" className="weapon-info__name">{currentWeapon.name}</Text>
						<Badge size="1" style={{ color: DAMAGE_TYPE_COLORS[currentWeapon.damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? "#888" }}>
							{currentWeapon.damageType}
						</Badge>
					</Flex>
					<Box className="weapon-col__content">
						<Flex className="weapon-stat-row" justify="between">
							<Text size="1" color="gray">射程</Text>
							<Text size="1">{currentWeapon.minRange > 0 ? `${currentWeapon.minRange}-${currentWeapon.range}` : currentWeapon.range}</Text>
						</Flex>
						<Flex className="weapon-stat-row" justify="between">
							<Text size="1" color="gray">射界</Text>
							<Text size="1">{currentWeapon.arc}°</Text>
						</Flex>
						<Flex className="weapon-stat-row" justify="between">
							<Text size="1" color="gray">连射</Text>
							<Text size="1">{currentWeapon.burstCount}</Text>
						</Flex>
						<Flex className="weapon-stat-row" justify="between">
							<Text size="1" color="gray">辐能</Text>
							<Text size="1">{currentWeapon.fluxCost}</Text>
						</Flex>
					</Box>
					<Box className={`weapon-info__status ${currentWeapon.canFire ? "weapon-info__status--ready" : "weapon-info__status--blocked"}`}>
						<Flex align="center" gap="1">
							{currentWeapon.canFire ? <CheckCircle size={12} /> : <XCircle size={12} />}
							<Text size="1" weight="bold">
								{currentWeapon.canFire ? "就绪" : currentWeapon.hasFired ? "已射击" : currentWeapon.state}
							</Text>
						</Flex>
						{currentWeapon.reason && !currentWeapon.canFire && (
							<Text size="1" color="gray">{currentWeapon.reason}</Text>
						)}
					</Box>
				</Box>
			)}

			{/* 列3：目标列表 */}
			<Box className="weapon-col weapon-col--targets">
				<Flex className="weapon-col__header" align="center" gap="1">
					<Swords size={12} />
					<Text size="1" weight="bold">目标</Text>
					{selectedTargetIds.length > 0 && (
						<Badge size="1" color="blue">{selectedTargetIds.length}</Badge>
					)}
				</Flex>
				<Box className="weapon-col__content target-list">
					{isLoading && (
						<Flex className="target-list__loading" align="center" justify="center">
							<Loader2 size={14} className="spin" />
						</Flex>
					)}
					{!isLoading && attackableTargets.length === 0 && (
						<Text size="1" color="gray" className="target-list__empty">无可用目标</Text>
					)}
					{!isLoading && attackableTargets.map((target) => {
						const isSelected = selectedTargetIds.includes(target.id);
						return (
							<Flex
								key={target.id}
								className={`target-item ${isSelected ? "target-item--selected" : ""} ${target.isFriendly ? "target-item--friendly" : ""} ${!target.canAttack ? "target-item--blocked" : ""}`}
								align="center"
								gap="2"
								onClick={() => target.canAttack && handleSelectTarget(target.id)}
								title={target.isFriendly ? "⚠ 友军目标" : !target.canAttack ? "不在射程/射界内" : undefined}
							>
								<Box className="target-item__check">
									{isSelected ? <CheckCircle size={12} /> : <Box className="target-item__check-placeholder" />}
								</Box>
								<Text size="1" className="target-item__name">
									{target.name}
									{target.isFriendly && <Badge size="1" color="amber">友军</Badge>}
								</Text>
								<Text size="1" color="gray" className="target-item__dist">{Math.round(target.distance)}</Text>
							</Flex>
						);
					})}
				</Box>
			</Box>

			{/* 列4：开火按钮 */}
			<Box className="weapon-col weapon-col--fire">
				<Button
					className={`fire-btn ${!currentWeapon?.canFire ? "fire-btn--locked" : ""}`}
					size="2"
					variant="solid"
					color="red"
					onClick={handleFire}
					disabled={selectedTargetIds.length === 0 || !currentWeapon?.canFire}
				>
					<Flex direction="column" align="center" gap="1">
						{currentWeapon?.canFire ? <Bomb size={18} /> : <Loader2 size={18} className="spin" />}
						<Text size="1" weight="bold">
							{currentWeapon?.canFire ? "开火" : currentWeapon?.reason ?? "锁定"}
						</Text>
						{selectedTargetIds.length > 0 && currentWeapon?.canFire && (
							<Text size="1">×{selectedTargetIds.length}</Text>
						)}
					</Flex>
				</Button>
			</Box>
		</Flex>
	);
};

export default WeaponPanel;