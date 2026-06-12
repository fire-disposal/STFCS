import React from "react";
import type { CombatToken } from "@vt/data";
import { getFactionColor } from "@/utils/factionColor";
import "./ship-status-bar.css";

/**
 * 顶栏舰船状态条：船体/辐能/坐标
 */
export const ShipStatusBar: React.FC<{ ship: CombatToken }> = ({ ship }) => {
	const runtime = ship.runtime;
	const spec = ship.spec;

	const hull = runtime.hull ?? 0;
	const hullMax = spec.maxHitPoints ?? 100;
	const hullPct = Math.min(100, (hull / hullMax) * 100);

	const fluxSoft = runtime.fluxSoft ?? 0;
	const fluxHard = runtime.fluxHard ?? 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = spec.fluxCapacity ?? 100;
	const fluxSoftPct = fluxMax > 0 ? Math.min(100, (fluxSoft / fluxMax) * 100) : 0;
	const fluxHardPct = fluxMax > 0 ? Math.min(100, (fluxHard / fluxMax) * 100) : 0;

	const position = runtime.position ?? { x: 0, y: 0 };
	const heading = runtime.heading ?? 0;

	const displayName = runtime.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6);
	const faction = runtime.faction;
	const factionColor = faction ? getFactionColor(faction) : undefined;

	return (
		<div className="ship-status-bar">
			<div className="ship-status-bar__header">
				{factionColor && (
					<div
						className="ship-status-bar__faction-dot"
						style={{ background: `#${factionColor.toString(16).padStart(6, "0")}` }}
					/>
				)}
				<span className="ship-status-bar__name">{displayName}</span>
			</div>
			<div className="ship-status-bar__stat">
				<span className="ship-status-bar__stat-label">船体</span>
				<div className="ship-status-bar__stat-bar-container">
					<div className="ship-status-bar__stat-bar ship-status-bar__stat-bar--hull">
						<div
							className="ship-status-bar__stat-bar-fill"
							style={{
								width: `${hullPct}%`,
								background: hullPct > 50 ? "#2ecc71" : hullPct > 25 ? "#f1c40f" : "#e74c3c",
							}}
						/>
					</div>
					<span className="ship-status-bar__stat-value">{hull}/{hullMax}</span>
				</div>
			</div>
			<div className="ship-status-bar__stat">
				<span className="ship-status-bar__stat-label">辐能</span>
				<div className="ship-status-bar__stat-bar-container">
					<div className="ship-status-bar__stat-bar ship-status-bar__stat-bar--flux">
						<div className="ship-status-bar__stat-bar-fill ship-status-bar__stat-bar-fill--hard" style={{ width: `${fluxHardPct}%` }} />
						<div className="ship-status-bar__stat-bar-fill ship-status-bar__stat-bar-fill--soft" style={{ width: `${fluxSoftPct}%`, left: `${fluxHardPct}%` }} />
					</div>
					<span className="ship-status-bar__stat-value">{fluxTotal}/{fluxMax}</span>
				</div>
			</div>
			<div className="ship-status-bar__position">
				<span className="ship-status-bar__position-value">({Math.round(position.x)}, {Math.round(position.y)})</span>
				<span className="ship-status-bar__position-heading">{Math.round(heading)}°</span>
			</div>
		</div>
	);
};
