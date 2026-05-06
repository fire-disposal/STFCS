/**
 * CombatLogPanel - 战斗日志面板
 *
 * 后端只存纯结构化数据（type + data + timestamp），
 * 前端按 event type 匹配规则自动着色/格式化。
 *
 * 渲染原则：
 * - 使用语义 CSS 类名，颜色在 combat-log.css 集中管理
 * - 伤害计算过程用不同颜色标注每步结果：
 *   · 伤害类型标签 = 小字着色徽标
 *   · 总伤害 = 亮白粗体
 *   · 护甲损伤 = 橙色
 *   · 结构损伤 = 红色粗体
 *   · 护盾辐能 = 绿色
 *   · 距离 = 暗灰小字
 *   · 未穿透 = 灰色斜体
 * - 纯文本导出 formatLogLine() 保持相同信息密度
 */

import React, { useCallback } from "react";
import { Flex, Box, IconButton, Tooltip } from "@radix-ui/themes";
import { Download } from "lucide-react";
import { useGameLogs, useGameTokens } from "@/state/stores/gameStore";
import { LOG_COLORS } from "@vt/data";
import type { BattleLogEvent } from "@vt/data";
import "./combat-log.css";

// ==================== 工具函数 ====================

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

/** 伤害类型 → 中文 */
const DMG_TYPE_LABELS: Record<string, string> = {
	KINETIC: "动能",
	HIGH_EXPLOSIVE: "高爆",
	ENERGY: "能量",
	FRAGMENTATION: "破片",
};

// ==================== 纯文本导出 ====================

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
			const dist = n("distance");
			const dmg = n("finalDamage") ?? n("hitDamage");
			const armor = n("armorDamage");
			const aq = n("armorQuadrant");
			const hull = n("hullDamage");
			const sf = n("fluxGenerated");
			let l = `${p} ${w} → ${tg} [${dt}] ${dist}u ${dmg}伤`;
			if (armor && armor > 0) l += ` 装甲-${armor}(Q${aq})`;
			if (hull && hull > 0) l += ` 结构-${hull}`;
			else l += ` 未击穿`;
			if (sf && sf > 0) l += ` 护盾+${sf}辐`;
			if (d["destroyed"]) l += " 💀";
			if (d["overloaded"]) l += " ⚡";
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
			const cs = c > 0 ? `↑${c}` : c < 0 ? `↓${Math.abs(c)}` : "—";
			return `${p} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 辐结算 ${n("fluxBefore")}→${n("fluxAfter")} ${cs}${n("shieldUpkeep") ? ` 维持+${n("shieldUpkeep")}` : ""}${n("dissipation") ? ` 散-${n("dissipation")}` : ""}`;
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
			const lb: Record<string, string> = { set_modifier: "修正", remove_modifier: "移除修正", set_phase: "阶段", set_turn: "回合", set_faction: "派系" };
			return `${p} ${s("playerName") || "DM"} ${lb[s("action")] || s("action")}${s("detail") ? ` ${s("detail")}` : ""}`;
		}
		case "system":
			return `${p} ${s("message") || JSON.stringify(d)}`;
		default:
			return `${p} ${log.type}: ${JSON.stringify(d)}`;
	}
}

// ==================== 着色值组件 ====================

/** 着色数值辅助组件：<span class="log-val-xxx">±{value}{unit}</span> */
const Val: React.FC<{ cls: string; v?: number; unit?: string; prefix?: string }> = ({ cls, v, unit, prefix }) => {
	if (v === undefined || v === 0) return null;
	return <span className={cls}>{prefix}{v}{unit}</span>;
};

// ==================== DataLogRenderer ====================

interface LogRendererProps { log: BattleLogEvent; tokens: Record<string, any>; }

const DataLogRenderer: React.FC<LogRendererProps> = ({ log, tokens }) => {
	const d = log.data as Record<string, unknown>;
	const s = (k: string, fb = ""): string => (d[k] as string | undefined) ?? fb;
	const n = (k: string): number | undefined => d[k] as number | undefined;
	const b = (k: string): boolean | undefined => d[k] as boolean | undefined;

	switch (log.type) {
		// ═══════ 战斗 ═══════
		case "attack": {
			const dmgType = s("damageType");
			const dmgTypeLabel = DMG_TYPE_LABELS[dmgType] || dmgType;
			const dmgTypeColor: Record<string, string> = {
				KINETIC: "#3498db", HIGH_EXPLOSIVE: "#e67e22", ENERGY: "#9b59b6", FRAGMENTATION: "#95a5a6",
			};
			return (
				<span className="log-line">
					<span className="log-weapon" style={{ color: LOG_COLORS.ATTACK }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</span>
					<span className="log-arrow"> → </span>
					<span className="log-target">{s("targetName") || getTokenName(tokens, s("targetId"))}</span>
					<span className="log-tag" style={{ color: dmgTypeColor[dmgType] ?? "#888", marginLeft: 4 }}>
						[{dmgTypeLabel}]
					</span>
					<Val cls="log-val-dist" v={n("distance")} prefix=" " unit="u" />
					<Val cls="log-val-dmg" v={n("finalDamage") ?? n("hitDamage")} prefix=" 伤害" />
					{/* 护甲/结构/护盾 用不同颜色标注 */}
					<Val cls="log-val-armor" v={n("armorDamage")} prefix=" 装甲-" unit={`(Q${n("armorQuadrant") ?? ""})`} />
					{n("hullDamage") && n("hullDamage")! > 0
						? <Val cls="log-val-hull" v={n("hullDamage")} prefix=" 结构-" />
						: <span className="log-nopen"> 未击穿</span>}
					<Val cls="log-val-shield" v={n("fluxGenerated")} prefix=" 护盾+" unit="辐" />
					{b("destroyed") ? <span className="log-icon-destroyed"> 💀</span> : null}
					{b("overloaded") ? <span className="log-icon-overload"> ⚡</span> : null}
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
					<span className="log-target">{s("targetName") || getTokenName(tokens, s("targetId"))}</span>
					<span className="log-nopen"> 偏差未命中</span>
				</span>
			);
		case "destroyed":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.DESTROYED }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span style={{ color: LOG_COLORS.DESTROYED }}> 被摧毁</span></span>;
		case "overload":
		case "overloaded":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.OVERLOAD }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}> 过载{s("reason") ? ` (${s("reason")})` : ""}</span></span>;
		case "overload_end":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span style={{ color: LOG_COLORS.SHIELD }}> 过载恢复</span></span>;

		// ═══════ 移动 ═══════
		case "move": {
			const parts: string[] = [];
			if (n("forward") != null && n("forward") !== 0) parts.push(`前后${n("forward")}`);
			if (n("strafe") != null && n("strafe") !== 0) parts.push(`侧移${n("strafe")}`);
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.MOVE }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> {parts.join(" ")}</span></span>;
		}
		case "rotate":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.MOVE }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> 旋转</span><span className="log-val-dmg">{n("angle")}°</span></span>;
		case "advance_phase":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.PHASE }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> {s("fromPhase")}→{s("toPhase")}</span></span>;
		case "end_turn":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.PHASE }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> 结束回合</span></span>;

		// ═══════ 护盾 ═══════
		case "shield_toggle":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> {b("active") ? "开启" : "关闭"}护盾</span></span>;
		case "shield_rotate":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> 护盾→</span><span className="log-val-dmg">{n("direction")}°</span></span>;

		// ═══════ 辐能 ═══════
		case "vent":
			return <span className="log-line"><span className="log-ship" style={{ color: LOG_COLORS.VENT }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-action"> 排散</span>{n("fluxCleared") ? <span className="log-meta"> (清</span> : null}<span className="log-val-flux">{n("fluxCleared")}</span>{n("fluxCleared") ? <span className="log-meta">辐)</span> : null}</span>;
		case "flux_settlement": {
			const ch = n("fluxChange") ?? 0;
			return <span className="log-line"><span className="log-ship">{s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-meta"> 辐结算</span><span className="log-val-dmg"> {n("fluxBefore")}→{n("fluxAfter")}</span><span className={ch > 0 ? "log-val-shield" : ch < 0 ? "log-val-flux" : "log-meta"} style={{ marginLeft: 2 }}> {ch > 0 ? "↑" : ch < 0 ? "↓" : "—"}{Math.abs(ch)}</span><Val cls="log-val-shield" v={n("shieldUpkeep")} prefix=" 维持+" unit="辐" /><Val cls="log-val-flux" v={n("dissipation")} prefix=" 散-" unit="辐" /><Val cls="log-val-armor" v={n("ventingCleared")} prefix=" 排清清" unit="辐" /></span>;
		}

		// ═══════ 部署 ═══════
		case "deploy":
			return <span className="log-line"><span className="log-label" style={{ color: LOG_COLORS.DEPLOY }}>部署</span><span className="log-ship"> {s("tokenName") || getTokenName(tokens, s("tokenId"))}</span><span className="log-meta">{s("faction") ? ` [${FACTION_LABELS[s("faction")] || s("faction")}]` : ""}</span></span>;

		// ═══════ 游戏管理 ═══════
		case "game_started":
			return <span className="log-line"><span className="log-label" style={{ color: LOG_COLORS.SYSTEM }}>游戏开始</span><span className="log-meta"> — 首轮 {s("firstFaction")}</span></span>;
		case "faction_change":
			return <span className="log-line"><span className="log-faction" style={{ color: FACTION_COLORS[s("fromFaction")] ?? LOG_COLORS.FACTION }}>{FACTION_LABELS[s("fromFaction")] || s("fromFaction")}</span><span className="log-action"> → </span><span className="log-faction" style={{ color: FACTION_COLORS[s("toFaction")] ?? LOG_COLORS.SYSTEM }}>{FACTION_LABELS[s("toFaction")] || s("toFaction")}</span>{n("turn") ? <span className="log-meta"> (R{n("turn")})</span> : null}</span>;
		case "game_reload":
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "系统"}</span><span className="log-action" style={{ color: LOG_COLORS.SYSTEM }}> 读档</span>{s("saveName") ? <span className="log-meta"> ({s("saveName")})</span> : null}</span>;

		// ═══════ 玩家事件 ═══════
		case "player_joined":
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.PLAYER }}>{s("playerName")}</span><span className="log-action"> 加入</span>{n("totalPlayers") ? <span className="log-meta"> ({n("totalPlayers")}人)</span> : null}</span>;
		case "player_left":
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.OVERLOAD }}>{s("playerName")}</span><span className="log-action"> 离开</span>{n("totalPlayers") ? <span className="log-meta"> ({n("totalPlayers")}人)</span> : null}</span>;
		case "player_disconnected":
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.DEVIATION }}>{s("playerName")}</span><span className="log-action"> 断线</span></span>;
		case "player_reconnected":
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.SHIELD }}>{s("playerName")}</span><span className="log-action"> 重连</span></span>;
		case "host_changed":
			return <span className="log-line"><span className="log-label" style={{ color: LOG_COLORS.SYSTEM }}>房主→</span><span className="log-player" style={{ color: LOG_COLORS.PLAYER }}>{s("newHostName") || s("newHostId")}</span>{b("previousHostDisconnected") ? <span className="log-meta"> (原断线)</span> : null}</span>;
		case "kick":
			return <span className="log-line"><span className="log-label" style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>踢出</span><span className="log-player"> {s("targetName") || getTokenName(tokens, s("targetId"))}</span></span>;

		// ═══════ 编辑操作 ═══════
		case "edit":
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "系统"}</span><span className="log-action"> 编</span><span className="log-ship"> {s("tokenName") || getTokenName(tokens, s("tokenId"))}</span>{s("reason") ? <span className="log-meta"> ({s("reason")})</span> : null}</span>;
		case "room_edit": {
			const lb: Record<string, string> = { set_modifier: "修正", remove_modifier: "移除修正", set_phase: "阶段→", set_turn: "回合→", set_faction: "派系→" };
			return <span className="log-line"><span className="log-player" style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "DM"}</span><span className="log-action"> {lb[s("action")] || s("action")}</span>{s("detail") ? <span className="log-meta"> {s("detail")}</span> : null}</span>;
		}

		// ═══════ 系统/回退 ═══════
		case "system":
			return <span className="log-line"><span className="log-meta">{s("message") || JSON.stringify(d)}</span></span>;
		default:
			return <span className="log-line"><span className="log-meta">{log.type}: {JSON.stringify(d)}</span></span>;
	}
};

// ==================== 面板 ====================

export const CombatLogPanel: React.FC = () => {
	const logs = useGameLogs();
	const tokens = useGameTokens();
	const reversed = [...logs].reverse();

	const handleExport = useCallback(() => {
		const blob = new Blob([logs.map(l => formatLogLine(l, tokens)).join("\n")], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url; a.download = `combat-log-${Date.now()}.txt`; a.click();
		URL.revokeObjectURL(url);
	}, [logs, tokens]);

	return (
		<Flex direction="column" className="combat-log-panel" style={{ height: "100%" }}>
			<Flex align="center" gap="2" px="3" py="2" className="combat-log-header">
				<span className="log-header-title">战斗日志</span>
				<span className="log-header-count">({logs.length})</span>
				<Box style={{ flex: 1 }} />
				<Tooltip content="导出TXT">
					<IconButton size="1" variant="ghost" onClick={handleExport} disabled={logs.length === 0}>
						<Download size={14} />
					</IconButton>
				</Tooltip>
			</Flex>
			<Box className="combat-log-list">
				{reversed.length === 0 ? (
					<Flex align="center" justify="center" style={{ height: "100%", opacity: 0.5 }}>
						<span style={{ color: "#556677", fontSize: 11 }}>暂无日志</span>
					</Flex>
				) : (
					reversed.map((log, i) => (
						<div key={`${log.timestamp}-${i}`} className="combat-log-entry">
							<div style={{ flex: 1, minWidth: 0 }}>
								<DataLogRenderer log={log} tokens={tokens} />
							</div>
							<span className="log-time">{formatTime(log.timestamp)}</span>
						</div>
					))
				)}
			</Box>
		</Flex>
	);
};

export default CombatLogPanel;
