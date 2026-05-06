/**
 * CombatLogPanel - 战斗日志面板
 *
 * 特性：
 * - 类型筛选栏（7 类 + 全部）
 * - 筛选后自动滚顶 + 计数更新
 * - 导出 TXT 限当前筛选结果
 * - 重新挂载时保持筛选（组件内状态）
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Flex, Box, IconButton, Tooltip } from "@radix-ui/themes";
import { Download } from "lucide-react";
import { useGameLogs, useGameTokens } from "@/state/stores/gameStore";
import { LOG_COLORS } from "@vt/data";
import type { BattleLogEvent } from "@vt/data";
import "./combat-log.css";

// ══════════════════════════════════════════════════════
//  筛选
// ══════════════════════════════════════════════════════

type LogFilterId =
	| "all"
	| "combat"
	| "movement"
	| "shield"
	| "flux"
	| "deploy"
	| "player"
	| "admin";

interface FilterCategory {
	id: LogFilterId;
	label: string;
	types: string[];
}

const FILTERS: FilterCategory[] = [
	{ id: "all", label: "全部", types: [] },
	{
		id: "combat",
		label: "战斗",
		types: ["attack", "deviation", "destroyed", "overload", "overloaded", "overload_end"],
	},
	{ id: "movement", label: "移动", types: ["move", "rotate", "advance_phase", "end_turn"] },
	{ id: "shield", label: "护盾", types: ["shield_toggle", "shield_rotate"] },
	{ id: "flux", label: "辐能", types: ["vent", "flux_settlement"] },
	{ id: "deploy", label: "部署", types: ["deploy"] },
	{
		id: "player",
		label: "玩家",
		types: [
			"player_joined",
			"player_left",
			"player_disconnected",
			"player_reconnected",
			"host_changed",
			"kick",
		],
	},
	{
		id: "admin",
		label: "管理",
		types: ["game_started", "faction_change", "game_reload", "edit", "room_edit", "system"],
	},
];

/** 筛选函数 */
function applyFilter(
	logs: readonly BattleLogEvent[],
	filter: LogFilterId
): readonly BattleLogEvent[] {
	if (filter === "all") return logs;
	const cat = FILTERS.find((f) => f.id === filter);
	if (!cat) return logs;
	return logs.filter((l) => cat.types.includes(l.type));
}

// ══════════════════════════════════════════════════════
//  工具函数
// ══════════════════════════════════════════════════════

function formatTime(ts: number): string {
	const d = new Date(ts);
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}
function formatTimeFull(ts: number): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")} ${formatTime(ts)}`;
}
function getTokenName(tokens: Record<string, any>, id?: string): string {
	if (!id) return "";
	const t = tokens[id];
	return t?.runtime?.displayName ?? t?.metadata?.name ?? id?.slice(-6) ?? id ?? "";
}

const FACTION_LABELS: Record<string, string> = {
	PLAYER_ALLIANCE: "玩家联盟",
	FATE_GRIP: "命运之握",
};
const FACTION_COLORS: Record<string, string> = {
	PLAYER_ALLIANCE: LOG_COLORS.FACTION_PA,
	FATE_GRIP: LOG_COLORS.FACTION_FG,
};
const DMG_TYPE_LABELS: Record<string, string> = {
	KINETIC: "动能",
	HIGH_EXPLOSIVE: "高爆",
	ENERGY: "能量",
	FRAGMENTATION: "破片",
};

// ══════════════════════════════════════════════════════
//  着色辅助组件
// ══════════════════════════════════════════════════════

const Val: React.FC<{ cls: string; v?: number; unit?: string; prefix?: string }> = ({
	cls,
	v,
	unit,
	prefix,
}) => {
	if (v === undefined || v === 0) return null;
	return (
		<span className={cls}>
			{prefix}
			{v}
			{unit}
		</span>
	);
};

// ══════════════════════════════════════════════════════
//  TXT 导出
// ══════════════════════════════════════════════════════

function formatLogLine(log: BattleLogEvent, tokens: Record<string, any>): string {
	const t = formatTimeFull(log.timestamp);
	const d = log.data as Record<string, unknown>;
	const s = (k: string, fb = ""): string => (d[k] as string | undefined) ?? fb;
	const n = (k: string): number | undefined => d[k] as number | undefined;
	const p = `[${t}]`;
	switch (log.type) {
		case "attack": {
			const w = s("weaponName") || getTokenName(tokens, s("attackerId"));
			const tg = s("targetName") || getTokenName(tokens, s("targetId"));
			const dt = DMG_TYPE_LABELS[s("damageType")] || s("damageType");
			let l = `${p} ${w} → ${tg} [${dt}] ${n("distance")}u ${n("finalDamage") ?? n("hitDamage")}伤`;
			const armor = n("armorDamage");
			const aq = n("armorQuadrant");
			const hull = n("hullDamage");
			const sf = n("fluxGenerated");
			if (armor && armor > 0) l += ` 装甲-${armor}(Q${aq})`;
			if (hull && hull > 0) l += ` 结构-${hull}`;
			else l += ` 未击穿`;
			if (sf && sf > 0) l += ` 护盾+${sf}辐`;
			if (d["destroyed"]) l += " [沉没]";
			if (d["overloaded"]) l += " [过载]";
			return l;
		}
		case "deviation":
			return `${p} ${s("weaponName") || getTokenName(tokens, s("attackerId"))} → ${s("targetName") || getTokenName(tokens, s("targetId"))} 偏差未命中`;
		case "destroyed":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 被摧毁`;
		case "overload":
		case "overloaded":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 过载${s("reason") ? ` (${s("reason")})` : ""}`;
		case "overload_end":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 过载恢复`;
		case "move": {
			const parts: string[] = [];
			if (n("forward") != null && n("forward") !== 0) parts.push(`前后${n("forward")}`);
			if (n("strafe") != null && n("strafe") !== 0) parts.push(`侧移${n("strafe")}`);
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} ${parts.join(" ")}`;
		}
		case "rotate":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 旋转${n("angle")}°`;
		case "advance_phase":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} ${s("fromPhase")}→${s("toPhase")}`;
		case "end_turn":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 结束回合`;
		case "shield_toggle":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} ${d["active"] ? "开启" : "关闭"}护盾`;
		case "shield_rotate":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 护盾→${n("direction")}°`;
		case "vent":
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 排散${n("fluxCleared") ? ` (清${n("fluxCleared")}辐)` : ""}`;
		case "flux_settlement": {
			const c = n("fluxChange") ?? 0;
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 辐结算 ${n("fluxBefore")}→${n("fluxAfter")} ${c > 0 ? "↑" : c < 0 ? "↓" : "—"}${Math.abs(c)}${n("shieldUpkeep") ? ` 维持+${n("shieldUpkeep")}` : ""}${n("dissipation") ? ` 散-${n("dissipation")}` : ""}`;
		}
		case "deploy":
			return `${p} 部署 ${s("tokenName") || getTokenName(tokens, s("tokenId"))}${n("presetName") ? ` (${s("presetName")})` : ""} [${s("faction")}]`;
		case "game_started":
			return `${p} 游戏开始 — 首轮 ${s("firstFaction")}`;
		case "faction_change":
			return `${p} ${FACTION_LABELS[s("fromFaction")] || s("fromFaction")} → ${FACTION_LABELS[s("toFaction")] || s("toFaction")}${n("turn") ? ` (R${n("turn")})` : ""}`;
		case "game_reload":
			return `${p} ${s("playerName") || "系统"} 读档${s("saveName") ? ` (${s("saveName")})` : ""}`;
		case "player_joined":
			return `${p} ${s("playerName")} 加入${n("totalPlayers") ? ` (${n("totalPlayers")}人)` : ""}`;
		case "player_left":
			return `${p} ${s("playerName")} 离开${n("totalPlayers") ? ` (${n("totalPlayers")}人)` : ""}`;
		case "player_disconnected":
			return `${p} ${s("playerName")} 断线`;
		case "player_reconnected":
			return `${p} ${s("playerName")} 重连`;
		case "host_changed":
			return `${p} 房主→${s("newHostName") || s("newHostId")}${d["previousHostDisconnected"] ? " (原断线)" : ""}`;
		case "kick":
			return `${p} 踢出 ${s("targetName") || getTokenName(tokens, s("targetId"))}`;
		case "edit":
			return `${p} ${s("playerName") || "系统"} 编 ${s("tokenName") || getTokenName(tokens, s("tokenId"))}${s("reason") ? ` (${s("reason")})` : ""}`;
		case "room_edit": {
			const lb: Record<string, string> = {
				set_modifier: "修正",
				remove_modifier: "移除修正",
				set_phase: "阶段",
				set_turn: "回合",
				set_faction: "派系",
			};
			return `${p} ${s("playerName") || "DM"} ${lb[s("action")] || s("action")}${s("detail") ? ` ${s("detail")}` : ""}`;
		}
		case "system":
			return `${p} ${s("message") || JSON.stringify(d)}`;
		default:
			return `${p} ${log.type}: ${JSON.stringify(d)}`;
	}
}

// ══════════════════════════════════════════════════════
//  DataLogRenderer（仅 switch-case，颜色行内控制）
// ══════════════════════════════════════════════════════

interface LogRendererProps {
	log: BattleLogEvent;
	tokens: Record<string, any>;
}

const DataLogRenderer: React.FC<LogRendererProps> = ({ log, tokens }) => {
	const d = log.data as Record<string, unknown>;
	const s = (k: string, fb = ""): string => (d[k] as string | undefined) ?? fb;
	const n = (k: string): number | undefined => d[k] as number | undefined;
	const b = (k: string): boolean | undefined => d[k] as boolean | undefined;

	switch (log.type) {
		case "attack": {
			const dt = s("damageType");
			const dtc: Record<string, string> = {
				KINETIC: "#3498db",
				HIGH_EXPLOSIVE: "#e67e22",
				ENERGY: "#9b59b6",
				FRAGMENTATION: "#95a5a6",
			};
			return (
				<span className="log-line">
					<span className="log-weapon" style={{ color: LOG_COLORS.ATTACK }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</span>
					<span className="log-arrow"> → </span>
					<span className="log-target">
						{s("targetName") || getTokenName(tokens, s("targetId"))}
					</span>
					<span className="log-tag" style={{ color: dtc[dt] ?? "#888", marginLeft: 4 }}>
						[{DMG_TYPE_LABELS[dt] || dt}]
					</span>
					<Val cls="log-val-dist" v={n("distance")} prefix=" " unit="u" />
					<Val cls="log-val-dmg" v={n("finalDamage") ?? n("hitDamage")} prefix=" 伤害" />
					<Val
						cls="log-val-armor"
						v={n("armorDamage")}
						prefix=" 装甲-"
						unit={`(Q${n("armorQuadrant") ?? ""})`}
					/>
					{n("hullDamage") && n("hullDamage")! > 0 ? (
						<Val cls="log-val-hull" v={n("hullDamage")} prefix=" 结构-" />
					) : (
						<span className="log-nopen"> 未击穿</span>
					)}
					<Val cls="log-val-shield" v={n("fluxGenerated")} prefix=" 护盾+" unit="辐" />
					{b("destroyed") ? <span className="log-icon-destroyed"> [沉没]</span> : null}
					{b("overloaded") ? <span className="log-icon-overload"> [过载]</span> : null}
				</span>
			);
		}
		case "deviation":
			return (
				<span className="log-line">
					<span className="log-weapon" style={{ color: LOG_COLORS.DEVIATION }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</span>
					<span className="log-arrow"> → </span>
					<span className="log-target">
						{s("targetName") || getTokenName(tokens, s("targetId"))}
					</span>
					<span className="log-nopen"> 偏差未命中</span>
				</span>
			);
		case "destroyed":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.DESTROYED }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span style={{ color: LOG_COLORS.DESTROYED }}> 被摧毁</span>
				</span>
			);
		case "overload":
		case "overloaded":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.OVERLOAD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>
						{" "}
						过载{s("reason") ? ` (${s("reason")})` : ""}
					</span>
				</span>
			);
		case "overload_end":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span style={{ color: LOG_COLORS.SHIELD }}> 过载恢复</span>
				</span>
			);
		case "move": {
			const p: string[] = [];
			if (n("forward") != null && n("forward") !== 0) p.push(`前后${n("forward")}`);
			if (n("strafe") != null && n("strafe") !== 0) p.push(`侧移${n("strafe")}`);
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.MOVE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action"> {p.join(" ")}</span>
				</span>
			);
		}
		case "rotate":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.MOVE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action"> 旋转</span>
					<span className="log-val-dmg">{n("angle")}°</span>
				</span>
			);
		case "advance_phase":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.PHASE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action">
						{" "}
						{s("fromPhase")}→{s("toPhase")}
					</span>
				</span>
			);
		case "end_turn":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.PHASE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action"> 结束回合</span>
				</span>
			);
		case "shield_toggle":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action"> {b("active") ? "开启" : "关闭"}护盾</span>
				</span>
			);
		case "shield_rotate":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action"> 护盾→</span>
					<span className="log-val-dmg">{n("direction")}°</span>
				</span>
			);
		case "vent":
			return (
				<span className="log-line">
					<span className="log-ship" style={{ color: LOG_COLORS.VENT }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</span>
					<span className="log-action"> 排散</span>
					{n("fluxCleared") ? (
						<>
							<span className="log-meta"> (清</span>
							<span className="log-val-flux">{n("fluxCleared")}</span>
							<span className="log-meta">辐)</span>
						</>
					) : null}
				</span>
			);
		case "flux_settlement": {
			const ch = n("fluxChange") ?? 0;
			return (
				<span className="log-line">
					<span className="log-ship">{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span>
					<span className="log-meta"> 辐结算</span>
					<span className="log-val-dmg">
						{" "}
						{n("fluxBefore")}→{n("fluxAfter")}
					</span>
					<span
						className={ch > 0 ? "log-val-shield" : ch < 0 ? "log-val-flux" : "log-meta"}
						style={{ marginLeft: 2 }}
					>
						{" "}
						{ch > 0 ? "↑" : ch < 0 ? "↓" : "—"}
						{Math.abs(ch)}
					</span>
					<Val cls="log-val-shield" v={n("shieldUpkeep")} prefix=" 维持+" unit="辐" />
					<Val cls="log-val-flux" v={n("dissipation")} prefix=" 散-" unit="辐" />
					<Val cls="log-val-armor" v={n("ventingCleared")} prefix=" 排清清" unit="辐" />
				</span>
			);
		}
		case "deploy":
			return (
				<span className="log-line">
					<span className="log-label" style={{ color: LOG_COLORS.DEPLOY }}>
						部署
					</span>
					<span className="log-ship"> {s("tokenName") || getTokenName(tokens, s("tokenId"))}</span>
					<span className="log-meta">
						{s("faction") ? ` [${FACTION_LABELS[s("faction")] || s("faction")}]` : ""}
					</span>
				</span>
			);
		case "game_started":
			return (
				<span className="log-line">
					<span className="log-label" style={{ color: LOG_COLORS.SYSTEM }}>
						游戏开始
					</span>
					<span className="log-meta"> — 首轮 {s("firstFaction")}</span>
				</span>
			);
		case "faction_change":
			return (
				<span className="log-line">
					<span
						className="log-faction"
						style={{ color: FACTION_COLORS[s("fromFaction")] ?? LOG_COLORS.FACTION }}
					>
						{FACTION_LABELS[s("fromFaction")] || s("fromFaction")}
					</span>
					<span className="log-action"> → </span>
					<span
						className="log-faction"
						style={{ color: FACTION_COLORS[s("toFaction")] ?? LOG_COLORS.SYSTEM }}
					>
						{FACTION_LABELS[s("toFaction")] || s("toFaction")}
					</span>
					{n("turn") ? <span className="log-meta"> (R{n("turn")})</span> : null}
				</span>
			);
		case "game_reload":
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.EDIT }}>
						{s("playerName") || "系统"}
					</span>
					<span className="log-action" style={{ color: LOG_COLORS.SYSTEM }}>
						{" "}
						读档
					</span>
					{s("saveName") ? <span className="log-meta"> ({s("saveName")})</span> : null}
				</span>
			);
		case "player_joined":
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.PLAYER }}>
						{s("playerName")}
					</span>
					<span className="log-action"> 加入</span>
					{n("totalPlayers") ? <span className="log-meta"> ({n("totalPlayers")}人)</span> : null}
				</span>
			);
		case "player_left":
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.OVERLOAD }}>
						{s("playerName")}
					</span>
					<span className="log-action"> 离开</span>
					{n("totalPlayers") ? <span className="log-meta"> ({n("totalPlayers")}人)</span> : null}
				</span>
			);
		case "player_disconnected":
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.DEVIATION }}>
						{s("playerName")}
					</span>
					<span className="log-action"> 断线</span>
				</span>
			);
		case "player_reconnected":
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.SHIELD }}>
						{s("playerName")}
					</span>
					<span className="log-action"> 重连</span>
				</span>
			);
		case "host_changed":
			return (
				<span className="log-line">
					<span className="log-label" style={{ color: LOG_COLORS.SYSTEM }}>
						房主→
					</span>
					<span className="log-player" style={{ color: LOG_COLORS.PLAYER }}>
						{s("newHostName") || s("newHostId")}
					</span>
					{b("previousHostDisconnected") ? <span className="log-meta"> (原断线)</span> : null}
				</span>
			);
		case "kick":
			return (
				<span className="log-line">
					<span className="log-label" style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>
						踢出
					</span>
					<span className="log-player">
						{" "}
						{s("targetName") || getTokenName(tokens, s("targetId"))}
					</span>
				</span>
			);
		case "edit":
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.EDIT }}>
						{s("playerName") || "系统"}
					</span>
					<span className="log-action"> 编</span>
					<span className="log-ship"> {s("tokenName") || getTokenName(tokens, s("tokenId"))}</span>
					{s("reason") ? <span className="log-meta"> ({s("reason")})</span> : null}
				</span>
			);
		case "room_edit": {
			const lb: Record<string, string> = {
				set_modifier: "修正",
				remove_modifier: "移除修正",
				set_phase: "阶段→",
				set_turn: "回合→",
				set_faction: "派系→",
			};
			return (
				<span className="log-line">
					<span className="log-player" style={{ color: LOG_COLORS.EDIT }}>
						{s("playerName") || "DM"}
					</span>
					<span className="log-action"> {lb[s("action")] || s("action")}</span>
					{s("detail") ? <span className="log-meta"> {s("detail")}</span> : null}
				</span>
			);
		}
		case "system":
			return (
				<span className="log-line">
					<span className="log-meta">{s("message") || JSON.stringify(d)}</span>
				</span>
			);
		default:
			return (
				<span className="log-line">
					<span className="log-meta">
						{log.type}: {JSON.stringify(d)}
					</span>
				</span>
			);
	}
};

// ══════════════════════════════════════════════════════
//  面板
// ══════════════════════════════════════════════════════

export const CombatLogPanel: React.FC = () => {
	const [activeFilter, setActiveFilter] = useState<LogFilterId>("all");
	const logs = useGameLogs();
	const tokens = useGameTokens();
	const scrollRef = useRef<HTMLDivElement>(null);

	// 筛选后的日志（逆序用于展示）
	const filtered = useMemo(() => {
		const f = applyFilter(logs, activeFilter);
		return [...f].reverse();
	}, [logs, activeFilter]);

	// 追踪已知日志 key，新条目获得动画 class
	const seenKeysRef = useRef<Set<string>>(new Set());
	const newKeysRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		seenKeysRef.current.clear();
	}, [activeFilter]);
	useMemo(() => {
		const seen = seenKeysRef.current;
		const fresh = new Set<string>();
		for (const log of filtered) {
			const k = `${log.timestamp}-${log.type}`;
			if (!seen.has(k)) {
				fresh.add(k);
				seen.add(k);
			}
		}
		newKeysRef.current = fresh;
	}, [filtered]);

	// 筛选切换时滚到顶部
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
	}, [activeFilter, logs.length]);

	const handleExport = useCallback(() => {
		const displayLogs = activeFilter === "all" ? logs : applyFilter(logs, activeFilter);
		const text = displayLogs.map((l) => formatLogLine(l, tokens)).join("\n");
		const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `combat-log-${Date.now()}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}, [logs, tokens, activeFilter]);

	return (
		<Flex direction="column" className="combat-log-panel" style={{ height: "100%" }}>
			{/* 标题栏 */}
			<Flex align="center" gap="2" px="3" py="2" className="combat-log-header">
				<span className="log-header-title">战斗日志</span>
				<span className="log-header-count">
					({filtered.length}/{logs.length})
				</span>
				<Box style={{ flex: 1 }} />
				<Tooltip content="导出TXT">
					<IconButton size="1" variant="ghost" onClick={handleExport} disabled={logs.length === 0}>
						<Download size={14} />
					</IconButton>
				</Tooltip>
			</Flex>

			{/* 筛选栏 */}
			<div className="log-filters">
				{FILTERS.map((f) => {
					const count = f.id === "all" ? logs.length : applyFilter(logs, f.id).length;
					const active = activeFilter === f.id;
					return (
						<button
							key={f.id}
							className={`log-filter-btn${active ? " log-filter-btn--active" : ""}`}
							onClick={() => setActiveFilter(f.id)}
							title={`${f.label} (${count})`}
						>
							{f.label}
							<span className="log-filter-count">{count}</span>
						</button>
					);
				})}
			</div>

			{/* 日志列表 */}
			<div className="combat-log-list" ref={scrollRef}>
				{filtered.length === 0 ? (
					<div className="log-empty">
						<span style={{ color: "#556677", fontSize: 11 }}>
							{logs.length === 0 ? "暂无日志" : "无匹配条目"}
						</span>
					</div>
				) : (
					filtered.map((log, i) => {
						const isNew = newKeysRef.current.has(`${log.timestamp}-${log.type}`);
						return (
							<div
								key={`${log.timestamp}-${i}`}
								className={`combat-log-entry${isNew ? " log-entry-new" : ""}`}
							>
								<div style={{ flex: 1, minWidth: 0 }}>
									<DataLogRenderer log={log} tokens={tokens} />
								</div>
								<span className="log-time">{formatTime(log.timestamp)}</span>
							</div>
						);
					})
				)}
			</div>
		</Flex>
	);
};

export default CombatLogPanel;
