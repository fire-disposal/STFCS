/**
 * 舰船信息摘要组件
 * 显示舰船名称、阵营、状态条（船体/辐能/护盾）和BUFF
 */

import { Heart, Zap, Shield, AlertTriangle } from "lucide-react";
import React, { useMemo } from "react";
import { Faction } from "@/sync/types";
import type { ShipInfoSummaryProps } from "./types";
import "./ShipInfoSummary.css";

export const ShipInfoSummary: React.FC<ShipInfoSummaryProps> = ({ ship }) => {
	const isPlayer = ship?.faction === Faction.PLAYER;

	// 计算百分比
	const hullPercent = useMemo(() => {
		if (!ship?.hull) return 0;
		return Math.round(((ship.hull.current ?? 0) / (ship.hull.max ?? 1)) * 100);
	}, [ship?.hull]);

	const fluxPercent = useMemo(() => {
		if (!ship?.flux) return 0;
		const total = (ship.flux.hard ?? 0) + (ship.flux.soft ?? 0);
		return Math.round((total / (ship.flux.max ?? 1)) * 100);
	}, [ship?.flux]);

	const fluxValue = useMemo(() => {
		if (!ship?.flux) return 0;
		return Math.round((ship.flux.hard ?? 0) + (ship.flux.soft ?? 0));
	}, [ship?.flux]);

	const shieldPercent = useMemo(() => {
		if (!ship?.shield || ship.shield.max <= 0) return 0;
		return Math.round(((ship.shield.current ?? 0) / (ship.shield.max ?? 1)) * 100);
	}, [ship?.shield]);

	const hasShield = ship?.shield?.max > 0;

	// 状态条颜色
	const getHullColor = (pct: number) =>
		pct > 50 ? "var(--game-accent-green)" : pct > 25 ? "var(--game-accent-yellow)" : "var(--game-accent-red)";

	return (
		<div className="ship-info-summary">
			{/* 第一行：舰船名称 + 阵营 */}
			<div className="ship-info-summary__header">
				<span className="ship-info-summary__name">
					{ship?.name || ship?.hullType || "未知舰船"}
				</span>
				<span className={`ship-info-summary__faction ${isPlayer ? "ship-info-summary__faction--player" : "ship-info-summary__faction--enemy"}`}>
					{isPlayer ? "友军" : "敌方"}
				</span>
			</div>

			{/* 状态条区 */}
			<div className="ship-info-summary__stats">
				{/* 船体 */}
				<div className="ship-info-summary__stat-row">
					<span className="ship-info-summary__stat-label">
						<Heart className="ship-info-summary__stat-icon" style={{ color: "var(--game-accent-red)" }} />
						船体
					</span>
					<div className="ship-info-summary__stat-bar">
						<div
							className="ship-info-summary__stat-fill"
							style={{ width: `${hullPercent}%`, backgroundColor: getHullColor(hullPercent) }}
						/>
					</div>
					<span className="ship-info-summary__stat-value">
						{ship?.hull?.current ?? 0}/{ship?.hull?.max ?? 0}
					</span>
				</div>

				{/* 辐能 */}
				<div className="ship-info-summary__stat-row">
					<span className="ship-info-summary__stat-label">
						<Zap className="ship-info-summary__stat-icon" style={{ color: "var(--game-accent-purple)" }} />
						辐能
					</span>
					<div className="ship-info-summary__stat-bar">
						<div
							className="ship-info-summary__stat-fill ship-info-summary__stat-fill--flux"
							style={{ width: `${fluxPercent}%` }}
						/>
					</div>
					<span className="ship-info-summary__stat-value">
						{fluxValue}/{ship?.flux?.max ?? 0}
					</span>
				</div>

				{/* 护盾 */}
				{hasShield && (
					<div className="ship-info-summary__stat-row">
						<span className="ship-info-summary__stat-label">
							<Shield className="ship-info-summary__stat-icon" style={{ color: "var(--game-accent-blue)" }} />
							护盾
						</span>
						<div className="ship-info-summary__stat-bar">
							<div
								className="ship-info-summary__stat-fill ship-info-summary__stat-fill--shield"
								style={{ width: `${shieldPercent}%` }}
							/>
						</div>
						<span className="ship-info-summary__stat-value">
							{ship?.shield?.active ? "ON" : "OFF"}
						</span>
					</div>
				)}

				{/* 无护盾时显示护甲平均值 */}
				{!hasShield && (
					<div className="ship-info-summary__stat-row">
						<span className="ship-info-summary__stat-label">
							<Shield className="ship-info-summary__stat-icon" style={{ color: "var(--game-accent-yellow)" }} />
							护甲
						</span>
						<div className="ship-info-summary__stat-bar">
							<div
								className="ship-info-summary__stat-fill ship-info-summary__stat-fill--armor"
								style={{ width: "100%" }}
							/>
						</div>
						<span className="ship-info-summary__stat-value">
							{ship?.armor?.maxPerQuadrant ?? 0}
						</span>
					</div>
				)}
			</div>

			{/* BUFF区 */}
			<div className="ship-info-summary__buffs">
				{ship?.isOverloaded && (
					<span className="ship-info-summary__buff ship-info-summary__buff--negative">
						<AlertTriangle className="ship-info-summary__buff-icon" />
						过载
					</span>
				)}
				{ship?.shield?.active && hasShield && (
					<span className="ship-info-summary__buff ship-info-summary__buff--positive">
						护盾激活
					</span>
				)}
			</div>
		</div>
	);
};

export default ShipInfoSummary;