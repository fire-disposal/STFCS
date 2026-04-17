/**
 * 状态条模块
 * 显示船体、辐能、护甲、护盾状态
 * 支持紧凑模式（用于底部面板）
 */

import { Heart, Shield, Zap } from "lucide-react";
import React, { useMemo } from "react";
import type { StatBlocksProps } from "./types";
import "./StatBlocks.css";

export const StatBlocks: React.FC<StatBlocksProps> = ({ ship, compact = false }) => {
	// 计算各项百分比
	const hullPercent = useMemo(() => {
		if (!ship?.hull) return 0;
		return Math.round(((ship.hull.current ?? 0) / (ship.hull.max ?? 1)) * 100);
	}, [ship?.hull]);

	const fluxPercent = useMemo(() => {
		if (!ship?.flux) return 0;
		const total = (ship.flux.hard ?? 0) + (ship.flux.soft ?? 0);
		return Math.round((total / (ship.flux.max ?? 1)) * 100);
	}, [ship?.flux]);

	const fluxHardPercent = useMemo(() => {
		if (!ship?.flux) return 0;
		return ((ship.flux.hard ?? 0) / (ship.flux.max ?? 1)) * 100;
	}, [ship?.flux]);

	const armorAverage = useMemo(() => {
		if (!ship?.armor?.quadrants) return 0;
		let total = 0;
		for (let i = 0; i < 6; i++) total += ship.armor.quadrants[i] ?? 0;
		return Math.round(total / 6);
	}, [ship?.armor?.quadrants]);

	const armorMaxPerQuadrant = ship?.armor?.maxPerQuadrant ?? 0;

	const shieldPercent = useMemo(() => {
		if (!ship?.shield) return 0;
		return Math.round(((ship.shield.current ?? 0) / (ship.shield.max ?? 1)) * 100);
	}, [ship?.shield]);

	// 颜色计算
	const getHullColor = (pct: number) =>
		pct > 50 ? "var(--game-accent-green)" : pct > 25 ? "var(--game-accent-yellow)" : "var(--game-accent-red)";

	const getArmorColor = (pct: number) =>
		pct > 75 ? "var(--game-accent-green)" : pct > 50 ? "var(--game-accent-yellow)" : pct > 25 ? "var(--game-accent-orange)" : "var(--game-accent-red)";

	return (
		<div className={`stat-blocks ${compact ? "stat-blocks--compact" : ""}`}>
			{/* 船体 */}
			<div className="stat-block">
				<div className="stat-block__header">
					<Heart className="stat-block__icon" style={{ color: "var(--game-accent-red)" }} />
					<span className="stat-block__label">船体</span>
					<span className="stat-block__value">{hullPercent}%</span>
				</div>
				<div className="game-bar">
					<div
						className="game-bar__fill game-bar__fill--structure"
						style={{ width: `${hullPercent}%`, backgroundColor: getHullColor(hullPercent) }}
					/>
				</div>
			</div>

			{/* 辐能 */}
			<div className="stat-block">
				<div className="stat-block__header">
					<Zap className="stat-block__icon" style={{ color: "var(--game-accent-purple)" }} />
					<span className="stat-block__label">辐能</span>
					<span className="stat-block__value">
						{Math.round((ship?.flux?.soft ?? 0) + (ship?.flux?.hard ?? 0))}/{ship?.flux?.max ?? 0}
					</span>
				</div>
				<div className="game-bar game-bar--flux">
					<div className="game-bar__fill game-bar__fill--flux" style={{ width: `${fluxPercent}%`, opacity: 0.6 }} />
					<div className="game-bar__fill game-bar__fill--hard" style={{ width: `${fluxHardPercent}%` }} />
				</div>
				{ship?.isOverloaded && (
					<div className="stat-block__warning">
						<Zap className="stat-block__warning-icon" />
						过载
					</div>
				)}
			</div>

			{/* 护甲（紧凑模式隐藏网格） */}
			{!compact && (
				<div className="stat-block">
					<div className="stat-block__header">
						<Shield className="stat-block__icon" style={{ color: "var(--game-accent-yellow)" }} />
						<span className="stat-block__label">护甲</span>
						<span className="stat-block__value">
							{armorAverage}/{armorMaxPerQuadrant}
						</span>
					</div>
					<div className="armor-grid">
						{Array.from({ length: 6 }, (_, idx) => {
							const val = ship?.armor?.quadrants?.[idx] ?? 0;
							const pct = armorMaxPerQuadrant > 0 ? (val / armorMaxPerQuadrant) * 100 : 0;
							return (
								<div key={idx} className="armor-cell" style={{ backgroundColor: getArmorColor(pct) }}>
									{Math.round(val)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* 护盾 */}
			{ship?.shield?.max > 0 && (
				<div className="stat-block">
					<div className="stat-block__header">
						<Shield className="stat-block__icon" style={{ color: "var(--game-accent-blue)" }} />
						<span className="stat-block__label">护盾</span>
						<span className="stat-block__value">{ship.shield.active ? "激活" : "关闭"}</span>
					</div>
					<div className="game-bar">
						<div
							className="game-bar__fill game-bar__fill--shield"
							style={{ width: `${shieldPercent}%` }}
						/>
					</div>
				</div>
			)}
		</div>
	);
};

export default StatBlocks;