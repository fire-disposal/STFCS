/**
 * useFireControl - 火控系统数据订阅 Hook
 *
 * 从 Colyseus Schema 直接订阅火控数据（服务端权威）
 * 无需 CustomEvent，数据通过 Schema 自动同步
 *
 * 设计原则：
 * - 服务端权威：所有计算在服务端完成
 * - Schema 同步：数据直接通过 Colyseus Schema 传递
 * - 稳定依赖：使用 useRef 存储对象引用，避免无限重渲染
 */

import type { Room } from "@colyseus/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClientCommand } from "@vt/data";

/** 目标可攻击性数据（从 Schema 转换） */
export interface TargetAttackability {
	shipId: string;
	canAttack: boolean;
	reason: string;
	inRange: boolean;
	inArc: boolean;
	distance: number;
	estimatedDamage: number;
	isFriendly: boolean;
}

/** 单个武器的目标数据 */
export interface WeaponTargetsData {
	weaponMountId: string;
	targets: TargetAttackability[];
	weaponCanFire: boolean;
	weaponFireReason: string;
}

/** 舰船的火控数据 */
export interface ShipFireControlData {
	shipId: string;
	lastUpdateTime: number;
	weapons: Map<string, WeaponTargetsData>; // weaponMountId -> data
}

/**
 * 订阅指定舰船的火控数据
 *
 * @param room Colyseus 房间实例
 * @param shipId 舰船 ID
 * @returns 火控数据或 null
 */
export function useShipFireControl(
	room: Room | null,
	shipId: string | null | undefined
): ShipFireControlData | null {
	const [data, setData] = useState<ShipFireControlData | null>(null);
	const lastUpdateTimeRef = useRef<number>(0);

	// ⚠️ 使用 ref 存储 room 对象，避免作为 useEffect 依赖
	const roomRef = useRef(room);
	roomRef.current = room;

	// ⚠️ 使用 ref 存储 shipId，避免频繁变化时重新订阅
	const shipIdRef = useRef(shipId);
	shipIdRef.current = shipId;

	// ⚠️ 使用 roomId 作为稳定的依赖标识
	const roomId = room?.roomId;

	useEffect(() => {
		const currentRoom = roomRef.current;
		const currentShipId = shipIdRef.current;

		if (!currentRoom?.state?.fireControlCache || !currentShipId) {
			setData(null);
			lastUpdateTimeRef.current = 0;
			return;
		}

		// 触发查询请求（服务端会计算并写入 Schema）
		currentRoom.send(ClientCommand.CMD_GET_ALL_ATTACKABLE_TARGETS, { shipId: currentShipId });

		// 订阅 Schema 变化
		const handleStateChange = () => {
			const cache = currentRoom.state.fireControlCache;
			const shipFireControl = cache?.ships?.get(currentShipId);

			if (!shipFireControl) {
				setData(null);
				lastUpdateTimeRef.current = 0;
				return;
			}

			// 仅在时间戳变化时更新（避免不必要的重渲染）
			if (shipFireControl.lastUpdateTime <= lastUpdateTimeRef.current) {
				return;
			}

			lastUpdateTimeRef.current = shipFireControl.lastUpdateTime;

			// 转换 Schema 数据为普通 JS 对象
			const weapons = new Map<string, WeaponTargetsData>();
			shipFireControl.weapons.forEach((weaponData: any) => {
				const targets: TargetAttackability[] = [];
				weaponData.targets.forEach((t: any) => {
					targets.push({
						shipId: t.shipId,
						canAttack: t.canAttack,
						reason: t.reason,
						inRange: t.inRange,
						inArc: t.inArc,
						distance: t.distance,
						estimatedDamage: t.estimatedDamage,
						isFriendly: t.isFriendly,
					});
				});

				weapons.set(weaponData.weaponMountId, {
					weaponMountId: weaponData.weaponMountId,
					targets,
					weaponCanFire: weaponData.weaponCanFire,
					weaponFireReason: weaponData.weaponFireReason,
				});
			});

			setData({
				shipId: shipFireControl.shipId,
				lastUpdateTime: shipFireControl.lastUpdateTime,
				weapons,
			});
		};

		// 初始调用
		handleStateChange();

		// 订阅后续变化
		currentRoom.onStateChange(handleStateChange);

		return () => {
			currentRoom.onStateChange.remove(handleStateChange);
		};
	}, [roomId]); // ⚠️ 仅依赖 roomId，不依赖 room 对象

	return data;
}

/**
 * 订阅指定武器的可攻击目标列表
 *
 * @param room Colyseus 房间实例
 * @param shipId 舰船 ID
 * @param weaponMountId 武器挂载点 ID
 * @returns 可攻击目标列表
 */
export function useWeaponAttackableTargets(
	room: Room | null,
	shipId: string | null | undefined,
	weaponMountId: string | null | undefined
): TargetAttackability[] {
	const shipFireControl = useShipFireControl(room, shipId);

	return useMemo(() => {
		if (!shipFireControl || !weaponMountId) return [];
		const weaponData = shipFireControl.weapons.get(weaponMountId);
		if (!weaponData) return [];
		return weaponData.targets.filter(t => t.canAttack);
	}, [shipFireControl, weaponMountId]);
}

/**
 * 订阅指定武器的开火状态
 *
 * @param room Colyseus 房间实例
 * @param shipId 舰船 ID
 * @param weaponMountId 武器挂载点 ID
 * @returns 武器开火状态
 */
export function useWeaponFireStatus(
	room: Room | null,
	shipId: string | null | undefined,
	weaponMountId: string | null | undefined
): { canFire: boolean; reason: string } {
	const shipFireControl = useShipFireControl(room, shipId);

	return useMemo(() => {
		if (!shipFireControl || !weaponMountId) {
			return { canFire: true, reason: "" };
		}
		const weaponData = shipFireControl.weapons.get(weaponMountId);
		if (!weaponData) {
			return { canFire: true, reason: "" };
		}
		return {
			canFire: weaponData.weaponCanFire,
			reason: weaponData.weaponFireReason,
		};
	}, [shipFireControl, weaponMountId]);
}

/**
 * 刷新火控数据
 *
 * 发送查询请求，触发服务端重新计算并写入 Schema
 */
export function refreshFireControlData(
	room: Room | null,
	shipId: string
): void {
	if (!room || !shipId) return;
	room.send(ClientCommand.CMD_GET_ALL_ATTACKABLE_TARGETS, { shipId });
}