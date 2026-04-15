import { getAvailableShips } from "@vt/data";
import type { FactionValue, ShipHullSpec } from "@vt/types";
import { Faction } from "@vt/types";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Palette, Rocket, Sparkles } from "lucide-react";
import React, { useMemo, useState } from "react";

type TokenType = "ship" | "station" | "asteroid";

interface DMObjectCreatorProps {
	onCreateObject: (params: {
		type: TokenType;
		hullId?: string;
		x: number;
		y: number;
		heading: number;
		faction: FactionValue;
		ownerId?: string;
		name?: string;
	}) => void;
	players: Array<{ sessionId: string; name: string; role: string }>;
	mapCursor: { x: number; y: number; r: number } | null;
}

interface FormState {
	type: TokenType;
	hullId: string;
	heading: string;
	x: string;
	y: string;
	faction: FactionValue;
	ownerId: string;
	name: string;
}

const styles = {
	panel: { backgroundColor: "rgba(6, 16, 26, 0.95)", border: "1px solid rgba(255, 111, 143, 0.3)" },
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "10px 12px",
		backgroundColor: "rgba(90, 42, 58, 0.6)",
		borderBottom: "1px solid rgba(255, 111, 143, 0.3)",
		cursor: "pointer",
	},
	headerTitle: {
		fontSize: "11px",
		fontWeight: "bold" as const,
		color: "#ff6f8f",
		textTransform: "uppercase" as const,
		display: "flex",
		alignItems: "center",
		gap: "6px",
	},
	content: { padding: "12px", display: "flex", flexDirection: "column" as const, gap: "10px" },
	sectionTitle: { fontSize: "10px", color: "#ff6f8f", fontWeight: "bold" as const },
	input: {
		width: "100%",
		padding: "7px",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(26, 45, 66, 0.8)",
		color: "#cfe8ff",
		fontSize: "11px",
	},
	row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
	typeGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" },
	typeButton: {
		padding: "8px",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(58, 42, 74, 0.6)",
		color: "#ff6f8f",
		fontSize: "10px",
		fontWeight: "bold" as const,
		cursor: "pointer",
	},
	typeButtonActive: { backgroundColor: "rgba(90, 42, 58, 0.95)", borderColor: "#ff6f8f" },
	infoCard: {
		padding: "8px",
		border: "1px solid rgba(74, 158, 255, 0.35)",
		backgroundColor: "rgba(74, 158, 255, 0.12)",
		fontSize: "10px",
		color: "#9dc5ef",
	},
	errorCard: {
		padding: "8px",
		border: "1px solid rgba(255,111,143,0.5)",
		backgroundColor: "rgba(255,111,143,0.12)",
		fontSize: "10px",
		color: "#ffd2dc",
		display: "flex",
		alignItems: "center",
		gap: "6px",
	},
	submit: {
		padding: "9px",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(90, 42, 58, 0.95)",
		color: "#ff6f8f",
		fontWeight: "bold" as const,
		cursor: "pointer",
	},
	submitDisabled: { opacity: 0.5, cursor: "not-allowed" },
};

const objectTypes = [
	{ id: "ship" as TokenType, label: "舰船", icon: "🚀" },
	{ id: "station" as TokenType, label: "空间站", icon: "🛰️" },
	{ id: "asteroid" as TokenType, label: "小行星", icon: "☄️" },
] as const;

function parseFinite(value: string): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function getShipDetailLines(ship: ShipHullSpec | undefined): string[] {
	if (!ship) return [];
	return [
		`尺寸: ${ship.size} / 级别: ${ship.class}`,
		`船体: ${ship.hitPoints}  装甲: ${ship.armorMax}`,
		`辐能: ${ship.fluxCapacity} / 散逸: ${ship.fluxDissipation}`,
		`航速: ${ship.maxSpeed}  转向: ${ship.maxTurnRate}`,
		`武器位: ${ship.weaponMounts.length}`,
	];
}

export const DMObjectCreator: React.FC<DMObjectCreatorProps> = ({ onCreateObject, players, mapCursor }) => {
	const [collapsed, setCollapsed] = useState(false);
	const [showTypeDetails, setShowTypeDetails] = useState(true);
	const [form, setForm] = useState<FormState>({
		type: "ship",
		hullId: "frigate",
		heading: "0",
		x: "0",
		y: "0",
		faction: Faction.DM,
		ownerId: "",
		name: "",
	});

	const availableShips = useMemo(() => getAvailableShips(), []);
	const selectedShip = useMemo(() => availableShips.find((s) => s.id === form.hullId), [availableShips, form.hullId]);

	const heading = parseFinite(form.heading);
	const x = parseFinite(form.x);
	const y = parseFinite(form.y);
	const cursorX = mapCursor ? Number(mapCursor.x.toFixed(1)) : null;
	const cursorY = mapCursor ? Number(mapCursor.y.toFixed(1)) : null;
	const cursorHeading = mapCursor ? Number(mapCursor.r.toFixed(2)) : null;

	const effectiveX = x ?? cursorX;
	const effectiveY = y ?? cursorY;
	const effectiveHeading = heading ?? cursorHeading;

	const errors: string[] = [];
	if (form.type === "ship" && !selectedShip) errors.push("请选择有效舰船型号");
	if (effectiveX === null || effectiveY === null) errors.push("缺少有效坐标（可使用地图游标）");
	if (effectiveHeading === null) errors.push("缺少有效朝向");
	if (effectiveHeading !== null && (effectiveHeading < -3600 || effectiveHeading > 3600)) {
		errors.push("朝向输入超出可接受范围");
	}
	if (form.name.length > 32) errors.push("对象名称最多 32 字符");
	if (form.ownerId && !players.some((p) => p.sessionId === form.ownerId)) errors.push("操作者不存在");

	const isValid = errors.length === 0;

	const submit = () => {
		if (!isValid || effectiveX === null || effectiveY === null || effectiveHeading === null) return;
		onCreateObject({
			type: form.type,
			hullId: form.type === "ship" ? form.hullId : undefined,
			x: effectiveX,
			y: effectiveY,
			heading: ((effectiveHeading % 360) + 360) % 360,
			faction: form.faction,
			ownerId: form.ownerId || undefined,
			name: form.name.trim() || undefined,
		});
	};

	return (
		<div style={styles.panel}>
			<div style={styles.header} onClick={() => setCollapsed(!collapsed)}>
				<div style={styles.headerTitle}>
					<Sparkles className="game-icon--sm" />对象创建工具
				</div>
				{collapsed ? <ChevronRight className="game-icon--xs" /> : <ChevronDown className="game-icon--xs" />}
			</div>
			{!collapsed && (
				<div style={styles.content}>
					<div style={styles.sectionTitle}><Palette className="game-icon--xs" />对象类型</div>
					<div style={styles.typeGrid}>
						{objectTypes.map((t) => (
							<button
								key={t.id}
								data-magnetic
								className="game-btn game-btn--small"
								style={{ ...styles.typeButton, ...(form.type === t.id ? styles.typeButtonActive : {}) }}
								onClick={() => setForm((prev) => ({ ...prev, type: t.id }))}
							>
								{t.icon} {t.label}
							</button>
						))}
					</div>

					{form.type === "ship" && (
						<>
							<div style={styles.sectionTitle}><Rocket className="game-icon--xs" />舰船型号</div>
							<select
								style={styles.input}
								value={form.hullId}
								onChange={(e) => setForm((prev) => ({ ...prev, hullId: e.target.value }))}
							>
								{availableShips.map((ship) => (
									<option key={ship.id} value={ship.id}>
										{ship.name}
									</option>
								))}
							</select>

							<button
								data-magnetic
								className="game-btn game-btn--small"
								onClick={() => setShowTypeDetails((v) => !v)}
							>
								{showTypeDetails ? "隐藏舰船属性" : "展开舰船属性"}
							</button>
							{showTypeDetails && (
								<div style={styles.infoCard}>
									{getShipDetailLines(selectedShip).map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							)}
						</>
					)}

					{form.type !== "ship" && (
						<div style={styles.infoCard}>
							{form.type === "station" ? "空间站将使用固定耐久模板（高护甲、不可移动）。" : "小行星将使用障碍模板（固定耐久、默认不可操作）。"}
						</div>
					)}

					<div style={styles.row}>
						<input style={styles.input} type="number" placeholder={cursorX !== null ? `X(游标:${cursorX})` : "X"} value={form.x} onChange={(e) => setForm((prev) => ({ ...prev, x: e.target.value }))} />
						<input style={styles.input} type="number" placeholder={cursorY !== null ? `Y(游标:${cursorY})` : "Y"} value={form.y} onChange={(e) => setForm((prev) => ({ ...prev, y: e.target.value }))} />
					</div>
					<div style={styles.row}>
						<input style={styles.input} type="number" placeholder={cursorHeading !== null ? `朝向(游标:${cursorHeading}°)` : "朝向"} value={form.heading} onChange={(e) => setForm((prev) => ({ ...prev, heading: e.target.value }))} />
						<input style={styles.input} placeholder="对象名称(可选)" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
					</div>

					<div style={styles.row}>
						<select style={styles.input} value={form.faction} onChange={(e) => setForm((prev) => ({ ...prev, faction: e.target.value as FactionValue }))}>
							{Object.values(Faction).map((f) => (
								<option key={f} value={f}>{f}</option>
							))}
						</select>
						<select style={styles.input} value={form.ownerId} onChange={(e) => setForm((prev) => ({ ...prev, ownerId: e.target.value }))}>
							<option value="">无操作者</option>
							{players.map((p) => <option key={p.sessionId} value={p.sessionId}>{p.name}</option>)}
						</select>
					</div>

					<div style={styles.infoCard}>
						<div>实时验证: {isValid ? <><CheckCircle2 className="game-icon--xs" /> 可创建</> : "输入未通过"}</div>
						<div>最终坐标: ({effectiveX ?? "--"}, {effectiveY ?? "--"})，朝向: {effectiveHeading ?? "--"}°</div>
					</div>

					{!isValid && (
						<div style={styles.errorCard}>
							<AlertTriangle className="game-icon--xs" />
							<div>{errors.join("；")}</div>
						</div>
					)}

					<button
						data-magnetic
						className="game-btn game-btn--small"
						style={{ ...styles.submit, ...(!isValid ? styles.submitDisabled : {}) }}
						onClick={submit}
						disabled={!isValid}
					>
						创建到游标 / 指定坐标
					</button>
				</div>
			)}
		</div>
	);
};

export default DMObjectCreator;
