/**
 * WeaponPanel - 武器火控面板
 *
 * 使用 useSelectedShip hook 统一获取选中舰船
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Crosshair, Swords, Loader2 } from "lucide-react";
import { Button, Flex, Box, Text, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import { useUIStore } from "@/state/stores/uiStore";
import { notify } from "@/ui/shared/Notification";
import { UI_CONFIG } from "@/config/constants";
import "./weapon-panel.css";

const DAMAGE_TYPE_COLORS = UI_CONFIG.COLORS.DAMAGE_TYPE;

interface WeaponStatus {
	mountId: string;
	name: string;
	damageType: string;
	damage: number;
	state: string;
	canFire: boolean;
	hasFired: boolean;
	cooldown: number;
	fluxCost: number;
	range: number;
	minRange: number;
	arc: number;
	burstCount: number;
	tags: string[];
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
	canControl?: boolean;
}

export const WeaponPanel: React.FC<WeaponPanelProps> = ({ canControl = true }) => {
	const [localSelectedWeaponId, setLocalSelectedWeaponId] = useState<string | null>(null);
	const setGlobalSelectedWeaponMountId = useUIStore((state) => state.setSelectedWeaponMountId);
	const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [allWeaponsTargeting, setAllWeaponsTargeting] = useState<Map<string, WeaponTargetingData>>(new Map());

	const { isAvailable, sendAttack, sendDeviation, sendQuery } = useGameAction();

	const ship = useSelectedShip();
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
					damage: weaponSpec.damage ?? 0,
					state,
					canFire,
					hasFired,
					cooldown,
					fluxCost: weaponSpec.fluxCostPerShot ?? 0,
					range: weaponSpec.range ?? 1000,
					minRange: weaponSpec.minRange ?? 0,
					arc: m.arc,
					burstCount: weaponSpec.burstCount ?? 1,
					tags: weaponSpec.tags ?? [],
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

	// 同步本地选中到全局 store
	useEffect(() => {
		setGlobalSelectedWeaponMountId(localSelectedWeaponId);
	}, [localSelectedWeaponId, setGlobalSelectedWeaponMountId]);

	// 默认选中第一个可用武器
	useEffect(() => {
		if (weapons.length > 0 && !localSelectedWeaponId) {
			const firstAvailable = weapons.find((w) => w.canFire);
			if (firstAvailable) {
				setLocalSelectedWeaponId(firstAvailable.mountId);
			} else {
				setLocalSelectedWeaponId(weapons[0].mountId);
			}
		}
	}, [weapons, localSelectedWeaponId]);

	// 当前武器
	const currentWeapon = useMemo(() => {
		return weapons.find((w) => w.mountId === localSelectedWeaponId) ?? null;
	}, [weapons, localSelectedWeaponId]);

	// 可攻击目标列表（当前选中武器）
	const attackableTargets = useMemo(() => {
		const weaponData = allWeaponsTargeting.get(localSelectedWeaponId ?? "");
		if (!weaponData) return [];
		return weaponData.validTargets.filter((t) => t.canAttack);
	}, [allWeaponsTargeting, localSelectedWeaponId]);

	// 选择武器
	const handleSelectWeapon = useCallback((weapon: WeaponStatus) => {
		setLocalSelectedWeaponId(weapon.mountId);
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
		if (!canAct || !localSelectedWeaponId || selectedTargetIds.length === 0) return;

		try {
			await sendAttack(ship!.$id, [{
				mountId: localSelectedWeaponId,
				targets: selectedTargetIds.map((t) => ({ targetId: t, shots: 1 })),
			}]);
			setSelectedTargetIds([]);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "开火失败");
		}
	}, [canAct, localSelectedWeaponId, selectedTargetIds, ship, sendAttack]);

	// 偏差（模拟未命中）
	const handleDeviation = useCallback(async () => {
		if (!canAct || !localSelectedWeaponId || selectedTargetIds.length === 0) return;

		try {
			await sendDeviation(ship!.$id, [{
				mountId: localSelectedWeaponId,
				targets: selectedTargetIds.map((t) => ({ targetId: t, shots: 1 })),
			}]);
			setSelectedTargetIds([]);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "偏差操作失败");
		}
	}, [canAct, localSelectedWeaponId, selectedTargetIds, ship, sendDeviation]);

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
								className={`weapon-item ${!w.canFire ? "weapon-item--blocked" : ""} ${w.hasFired ? "weapon-item--fired" : ""} ${localSelectedWeaponId === w.mountId ? "weapon-item--selected" : ""}`}
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

			{/* 列2：武器信息（两列子布局）— 始终显示，未选中时使用第一个武器 */}
			<Box className="weapon-col weapon-col--info">
				{(() => {
					const infoWeapon = currentWeapon ?? weapons[0];
					if (!infoWeapon) return null;
					return (
						<>
							<Flex className="weapon-col__header" align="center" gap="2">
								<Text size="1" weight="bold" className="weapon-info__name">{infoWeapon.name}</Text>
								<Badge size="1" style={{ color: DAMAGE_TYPE_COLORS[infoWeapon.damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? "#888" }}>
									{infoWeapon.damageType}
								</Badge>
							</Flex>
							<Box className="weapon-col__content">
								<Flex className="weapon-info__cols" gap="2">
									{/* 左列：基础参数 */}
									<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">射程</Text>
											<Text size="1">{infoWeapon.minRange > 0 ? `${infoWeapon.minRange}-${infoWeapon.range}` : infoWeapon.range}</Text>
										</Flex>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">射界</Text>
											<Text size="1">{infoWeapon.arc}°</Text>
										</Flex>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">连射</Text>
											<Text size="1">{infoWeapon.burstCount}</Text>
										</Flex>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">伤害</Text>
											<Text size="1">{infoWeapon.damage}</Text>
										</Flex>
									</Flex>
									{/* 右列：武器参数 */}
									<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">类型</Text>
											<Text size="1" style={{ color: DAMAGE_TYPE_COLORS[infoWeapon.damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? "#888" }}>
												{infoWeapon.damageType}
											</Text>
										</Flex>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">辐能</Text>
											<Text size="1">{infoWeapon.fluxCost}</Text>
										</Flex>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">冷却</Text>
											<Text size="1">{infoWeapon.cooldown > 0 ? `${infoWeapon.cooldown}s` : "就绪"}</Text>
										</Flex>
										<Flex className="weapon-stat-row" justify="between">
											<Text size="1" color="gray">状态</Text>
											<Text size="1" style={{ color: infoWeapon.canFire ? "#2ecc71" : "#e74c3c" }}>
												{infoWeapon.canFire ? "可用" : infoWeapon.hasFired ? "已射击" : infoWeapon.state}
											</Text>
										</Flex>
									</Flex>
								</Flex>
							</Box>
							<Box className="weapon-info__tags">
								{infoWeapon.tags.length > 0 ? (
									<Flex gap="1" wrap="wrap">
										{infoWeapon.tags.map((tag) => (
											<Badge key={tag} size="1" variant="soft" color="blue">
												{tag}
											</Badge>
										))}
									</Flex>
								) : (
									<Text size="1" color="gray">无标签</Text>
								)}
							</Box>
						</>
					);
				})()}
			</Box>

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
								<Box className={`target-item__check ${isSelected ? "target-item__check--selected" : ""}`}>
									{isSelected ? (
										<Box className="target-item__check-fill" />
									) : (
										<Box className="target-item__check-placeholder" />
									)}
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

			{/* 列4：开火/命中/偏差 */}
			<Box className="weapon-col weapon-col--fire">
				<Flex className="weapon-col__header" align="center" gap="1">
					<Text size="1" weight="bold">指令</Text>
				</Flex>
				<Flex direction="column" gap="1" className="weapon-col__content">
					<Button
						className="fire-col-btn"
						size="2"
						variant="solid"
						color="red"
						onClick={handleFire}
						disabled={selectedTargetIds.length === 0 || !currentWeapon?.canFire}
						data-magnetic
					>
						<Text size="1" weight="bold">开火</Text>
					</Button>
					<Button
						className="fire-col-btn"
						size="2"
						variant="soft"
						color="gray"
						disabled
					>
						<Text size="1">命中</Text>
					</Button>
					<Button
						className="fire-col-btn"
						size="2"
						variant="soft"
						color="gray"
						onClick={handleDeviation}
						disabled={selectedTargetIds.length === 0 || !currentWeapon?.canFire}
						data-magnetic
					>
						<Text size="1">偏差</Text>
					</Button>
				</Flex>
			</Box>
		</Flex>
	);
};

export default WeaponPanel;
