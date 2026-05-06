/**
 * CombatLogPanel - 战斗日志面板
 *
 * 后端只存纯结构化数据（type + data + timestamp），
 * 前端按 event type 匹配规则自动着色/格式化。
 *
 * 数据字段命名约定（`s()` = string, `n()` = number, `b()` = boolean）：
 *   attack:      weaponName, targetName, damageType, distance, finalDamage, hullDamage,
 *                armorDamage, armorQuadrant, shieldHit, fluxGenerated, destroyed, overloaded
 *   move/rotate: tokenName, forward, strafe, angle
 *   shield:      tokenName, active, direction
 *   vent:        tokenName, fluxCleared
 *   flux_settlement: tokenName, fluxChange, fluxBefore, fluxAfter, shieldUpkeep, dissipation
 *   deploy:      tokenName, presetName, faction
 *   player:      playerName, totalPlayers
 *   host_changed: newHostName, previousHostDisconnected
 *   edit/room_edit: playerName, tokenName, reason, path, action, detail
 *   ...其他见具体 case
 */

import React, { useCallback } from "react";
import { Flex, Text, Box, IconButton, Tooltip } from "@radix-ui/themes";
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
	const token = tokens[id];
	return token?.runtime?.displayName ?? token?.metadata?.name ?? id?.slice(-6) ?? id ?? "";
}

const FACTION_LABELS: Record<string, string> = {
	PLAYER_ALLIANCE: "玩家联盟",
	FATE_GRIP: "命运之握",
};

const FACTION_COLORS: Record<string, string> = {
	PLAYER_ALLIANCE: LOG_COLORS.FACTION_PA,
	FATE_GRIP: LOG_COLORS.FACTION_FG,
};

// ==================== TXT 导出 ====================

/**
 * 将日志条目格式化为纯文本行
 */
function formatLogLine(log: BattleLogEvent, tokens: Record<string, any>): string {
	const time = formatTimeFull(log.timestamp);
	const d = log.data as Record<string, unknown>;
	const s = (key: string, fallback = ""): string => (d[key] as string | undefined) ?? fallback;
	const n = (key: string): number | undefined => d[key] as number | undefined;

	const prefix = `[${time}]`;

	switch (log.type) {
		case "attack": {
			const weapon = s("weaponName") || getTokenName(tokens, s("attackerId"));
			const target = s("targetName") || getTokenName(tokens, s("targetId"));
			const dmgType = s("damageType");
			const dist = n("distance");
			const dmg = n("finalDamage") ?? n("hitDamage");
			const hull = n("hullDamage");
			const armor = n("armorDamage");
			const armorQ = n("armorQuadrant");
			const shieldFlux = n("fluxGenerated");
			const destroyed = d["destroyed"];
			const overloaded = d["overloaded"];

			let line = `${prefix} ${weapon} → ${target} [${dmgType}] ${dist}u ${dmg}伤害`;
			if (armor && armor > 0) line += ` 护甲-${armor}(Q${armorQ})`;
			if (hull && hull > 0) line += ` 结构-${hull}`;
			else line += ` 未穿透`;
			if (shieldFlux && shieldFlux > 0) line += ` 护盾+${shieldFlux}辐`;
			if (destroyed) line += " 💀";
			if (overloaded) line += " ⚡";
			return line;
		}
		case "deviation":
			return `${prefix} ${s("weaponName") || getTokenName(tokens, s("attackerId"))} → ${s("targetName") || getTokenName(tokens, s("targetId"))} 偏差未命中`;
		case "destroyed":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 被摧毁`;
		case "overload":
		case "overloaded":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 过载${s("reason") ? ` (${s("reason")})` : ""}`;
		case "overload_end":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 过载恢复`;
		case "move": {
			const parts: string[] = [];
			if (n("forward") != null && n("forward") !== 0) parts.push(`前后${n("forward")}`);
			if (n("strafe") != null && n("strafe") !== 0) parts.push(`侧移${n("strafe")}`);
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} ${parts.join(" ")}`;
		}
		case "rotate":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 旋转${n("angle")}°`;
		case "advance_phase":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} ${s("fromPhase")}→${s("toPhase")}`;
		case "end_turn":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 结束回合`;
		case "shield_toggle":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} ${d["active"] ? "开启" : "关闭"}护盾`;
		case "shield_rotate":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 护盾→${n("direction")}°`;
		case "vent":
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 排散${n("fluxCleared") ? ` (清除${n("fluxCleared")}辐)` : ""}`;
		case "flux_settlement": {
			const change = n("fluxChange") ?? 0;
			const changeStr = change > 0 ? `↑${change}` : change < 0 ? `↓${Math.abs(change)}` : "—";
			return `${prefix} ${s("tokenName") || getTokenName(tokens, s("tokenId"))} 辐能结算 ${n("fluxBefore")}→${n("fluxAfter")} ${changeStr}${n("shieldUpkeep") ? ` 维持+${n("shieldUpkeep")}` : ""}${n("dissipation") ? ` 散热-${n("dissipation")}` : ""}`;
		}
		case "deploy": {
			const presetInfo = n("presetName") ? ` (${s("presetName")})` : "";
			return `${prefix} 部署 ${s("tokenName") || getTokenName(tokens, s("tokenId"))}${presetInfo} 派系:${s("faction")}`;
		}
		case "game_started":
			return `${prefix} 游戏开始 — 首轮 ${s("firstFaction")}`;
		case "faction_change":
			return `${prefix} ${FACTION_LABELS[s("fromFaction")] || s("fromFaction")} → ${FACTION_LABELS[s("toFaction")] || s("toFaction")}${n("turn") ? ` (第${n("turn")}回合)` : ""}`;
		case "game_reload":
			return `${prefix} ${s("playerName") || "系统"} 读取存档${s("saveName") ? ` (${s("saveName")})` : ""}`;
		case "player_joined":
			return `${prefix} ${s("playerName")} 加入房间${n("totalPlayers") ? ` (${n("totalPlayers")}人)` : ""}`;
		case "player_left":
			return `${prefix} ${s("playerName")} 离开房间${n("totalPlayers") ? ` (${n("totalPlayers")}人)` : ""}`;
		case "player_disconnected":
			return `${prefix} ${s("playerName")} 断开连接`;
		case "player_reconnected":
			return `${prefix} ${s("playerName")} 重新连接`;
		case "host_changed":
			return `${prefix} 房主转移至 ${s("newHostName") || s("newHostId")}${d["previousHostDisconnected"] ? " (原房主断线)" : ""}`;
		case "kick":
			return `${prefix} 踢出 ${s("targetName") || getTokenName(tokens, s("targetId"))}`;
		case "edit":
			return `${prefix} ${s("playerName") || "系统"} 编辑 ${s("tokenName") || getTokenName(tokens, s("tokenId"))}${s("reason") ? ` (${s("reason")})` : ""}`;
		case "room_edit": {
			const labels: Record<string, string> = {
				set_modifier: "修改全局修正",
				remove_modifier: "移除全局修正",
				set_phase: "切换阶段",
				set_turn: "调整回合",
				set_faction: "调整派系",
			};
			return `${prefix} ${s("playerName") || "DM"} ${labels[s("action")] || s("action")}${s("detail") ? ` (${s("detail")})` : ""}`;
		}
		case "system":
			return `${prefix} ${s("message") || JSON.stringify(d)}`;
		default:
			return `${prefix} ${log.type}: ${JSON.stringify(d)}`;
	}
}

// ==================== 数据驱动渲染器 ====================

interface LogRendererProps {
	log: BattleLogEvent;
	tokens: Record<string, any>;
}

const DataLogRenderer: React.FC<LogRendererProps> = ({ log, tokens }) => {
	const d = log.data as Record<string, unknown>;
	const s = (key: string, fallback = ""): string => (d[key] as string | undefined) ?? fallback;
	const n = (key: string): number | undefined => d[key] as number | undefined;
	const b = (key: string): boolean | undefined => d[key] as boolean | undefined;

	switch (log.type) {
		case "attack": {
			const shieldLine = b("shieldHit") && n("fluxGenerated") ? ` 护盾+${n("fluxGenerated")}辐` : "";
			const armorLine = n("armorDamage") && n("armorDamage")! > 0 ? ` 护甲-${n("armorDamage")}(Q${n("armorQuadrant")})` : "";
			const dmgLine = n("hullDamage") && n("hullDamage")! > 0 ? ` 结构-${n("hullDamage")}` : " 未穿透";
			return (
				<span className="log-line">
					<Text className="log-weapon" style={{ color: LOG_COLORS.ATTACK }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</Text>
					<Text className="log-arrow"> → </Text>
					<Text className="log-target">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					<Text className="log-meta">
						{" "}[{s("damageType")}] {n("distance")}u 伤害{n("finalDamage") ?? n("hitDamage")}
						{armorLine}{dmgLine}{shieldLine}
						{b("destroyed") ? " 💀" : ""}{b("overloaded") ? " ⚡" : ""}
					</Text>
				</span>
			);
		}
		case "deviation":
			return (
				<span className="log-line">
					<Text className="log-weapon" style={{ color: LOG_COLORS.DEVIATION }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</Text>
					<Text className="log-arrow"> → </Text>
					<Text className="log-target">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					<Text className="log-meta"> 偏差未命中</Text>
				</span>
			);
		case "destroyed":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.DESTROYED }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action" style={{ color: LOG_COLORS.DESTROYED }}> 被摧毁</Text>
				</span>
			);
		case "overloaded":
		case "overload":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.OVERLOAD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action" style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>
						 过载{s("reason") ? ` (${s("reason")})` : ""}
					</Text>
				</span>
			);
		case "overload_end":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action" style={{ color: LOG_COLORS.SHIELD }}> 过载恢复</Text>
				</span>
			);
		case "move": {
			const parts: string[] = [];
			if (n("forward") != null && n("forward") !== 0) parts.push(`前后${n("forward")}`);
			if (n("strafe") != null && n("strafe") !== 0) parts.push(`侧移${n("strafe")}`);
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.MOVE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> {parts.join(" ")}</Text>
				</span>
			);
		}
		case "rotate":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.MOVE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> 旋转{n("angle")}°</Text>
				</span>
			);
		case "advance_phase":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.PHASE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> {s("fromPhase")}→{s("toPhase")}</Text>
				</span>
			);
		case "end_turn":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.PHASE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> 结束回合</Text>
				</span>
			);
		case "shield_toggle":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> {b("active") ? "开启" : "关闭"}护盾</Text>
				</span>
			);
		case "shield_rotate":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> 护盾→{n("direction")}°</Text>
				</span>
			);
		case "vent":
			return (
				<span className="log-line">
					<Text className="log-ship" style={{ color: LOG_COLORS.VENT }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text className="log-action"> 排散</Text>
					{n("fluxCleared") ? <Text className="log-meta"> (清除{n("fluxCleared")}辐)</Text> : null}
				</span>
			);
		case "flux_settlement": {
			const change = n("fluxChange") ?? 0;
			const changeIcon = change > 0 ? "↑" : change < 0 ? "↓" : "—";
			const changeColor = change > 0 ? LOG_COLORS.OVERLOAD : change < 0 ? LOG_COLORS.SHIELD : LOG_COLORS.GRAY;
			return (
				<span className="log-line">
					<Text className="log-ship">{s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					<Text className="log-meta">
						{" "}辐能结算 {n("fluxBefore") != null ? `${n("fluxBefore")}→${n("fluxAfter")}` : ""}{" "}
						<Text style={{ color: changeColor }}>{changeIcon}{Math.abs(change)}</Text>
						{n("shieldUpkeep") && n("shieldUpkeep")! > 0 ? ` 维持+${n("shieldUpkeep")}` : ""}
						{n("dissipation") && n("dissipation")! > 0 ? ` 散热-${n("dissipation")}` : ""}
						{n("ventingCleared") && n("ventingCleared")! > 0 ? ` 排散清除${n("ventingCleared")}辐` : ""}
					</Text>
				</span>
			);
		}
		case "deploy":
			return (
				<span className="log-line">
					<Text className="log-label" style={{ color: LOG_COLORS.DEPLOY }}>部署</Text>
					<Text className="log-ship"> {s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					<Text className="log-meta">
						{s("faction") ? ` [${FACTION_LABELS[s("faction")] || s("faction")}]` : ""}
					</Text>
				</span>
			);
		case "game_started":
			return (
				<span className="log-line">
					<Text className="log-label" style={{ color: LOG_COLORS.SYSTEM }}>游戏开始</Text>
					<Text className="log-meta"> — 首轮 {s("firstFaction")}</Text>
				</span>
			);
		case "faction_change": {
			const turnInfo = n("turn") ? ` (第${n("turn")}回合)` : "";
			return (
				<span className="log-line">
					<Text className="log-faction" style={{ color: FACTION_COLORS[s("fromFaction")] ?? LOG_COLORS.FACTION }}>
						{FACTION_LABELS[s("fromFaction")] || s("fromFaction")}
					</Text>
					<Text className="log-action"> → </Text>
					<Text className="log-faction" style={{ color: FACTION_COLORS[s("toFaction")] ?? LOG_COLORS.SYSTEM }}>
						{FACTION_LABELS[s("toFaction")] || s("toFaction")}
					</Text>
					<Text className="log-meta">{turnInfo}</Text>
				</span>
			);
		}
		case "game_reload":
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "系统"}</Text>
					<Text className="log-action" style={{ color: LOG_COLORS.SYSTEM }}> 读取存档</Text>
					{s("saveName") ? <Text className="log-meta"> ({s("saveName")})</Text> : null}
				</span>
			);
		case "player_joined":
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.PLAYER }}>{s("playerName")}</Text>
					<Text className="log-action"> 加入</Text>
					{n("totalPlayers") ? <Text className="log-meta"> ({n("totalPlayers")}人)</Text> : null}
				</span>
			);
		case "player_left":
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.OVERLOAD }}>{s("playerName")}</Text>
					<Text className="log-action"> 离开</Text>
					{n("totalPlayers") ? <Text className="log-meta"> ({n("totalPlayers")}人)</Text> : null}
				</span>
			);
		case "player_disconnected":
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.DEVIATION }}>{s("playerName")}</Text>
					<Text className="log-action"> 断线</Text>
				</span>
			);
		case "player_reconnected":
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.SHIELD }}>{s("playerName")}</Text>
					<Text className="log-action"> 重连</Text>
				</span>
			);
		case "host_changed":
			return (
				<span className="log-line">
					<Text className="log-label" style={{ color: LOG_COLORS.SYSTEM }}>房主→</Text>
					<Text className="log-player" style={{ color: LOG_COLORS.PLAYER }}>{s("newHostName") || s("newHostId")}</Text>
					{b("previousHostDisconnected") ? <Text className="log-meta"> (原房主断线)</Text> : null}
				</span>
			);
		case "kick":
			return (
				<span className="log-line">
					<Text className="log-label" style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>踢出</Text>
					<Text className="log-player"> {s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
				</span>
			);
		case "edit":
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "系统"}</Text>
					<Text className="log-action"> 编辑</Text>
					<Text className="log-ship"> {s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					{s("reason") ? <Text className="log-meta"> ({s("reason")})</Text> : null}
				</span>
			);
		case "room_edit": {
			const subAction = s("action");
			const labels: Record<string, string> = {
				set_modifier: "全局修正", remove_modifier: "移除修正",
				set_phase: "阶段→", set_turn: "回合→", set_faction: "派系→",
			};
			return (
				<span className="log-line">
					<Text className="log-player" style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "DM"}</Text>
					<Text className="log-action"> {labels[subAction] || subAction}</Text>
					{s("detail") ? <Text className="log-meta"> {s("detail")}</Text> : null}
				</span>
			);
		}
		case "system":
			return <span className="log-line"><Text className="log-meta">{s("message") || JSON.stringify(d)}</Text></span>;
		default:
			return <span className="log-line"><Text className="log-meta">{log.type}: {JSON.stringify(d)}</Text></span>;
	}
};

// ==================== 面板组件 ====================

export const CombatLogPanel: React.FC = () => {
	const logs = useGameLogs();
	const tokens = useGameTokens();
	const reversed = logs.length === 0 ? [] : [...logs].reverse();

	const handleExport = useCallback(() => {
		const lines = logs.map((log) => formatLogLine(log, tokens));
		const text = lines.join("\n");
		const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `combat-log-${Date.now()}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}, [logs, tokens]);

	return (
		<Flex direction="column" className="combat-log-panel" style={{ height: "100%" }}>
			<Flex align="center" gap="2" px="3" py="2" className="combat-log-header">
				<Text size="1" weight="bold" className="log-header-title">战斗日志</Text>
				<Text size="1" color="gray" className="log-header-count">({logs.length})</Text>
				<Box style={{ flex: 1 }} />
				<Tooltip content="导出TXT">
					<IconButton size="1" variant="ghost" onClick={handleExport} disabled={logs.length === 0}>
						<Download size={14} />
					</IconButton>
				</Tooltip>
			</Flex>
			<Box className="combat-log-list" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
				{reversed.length === 0 ? (
					<Flex align="center" justify="center" style={{ height: "100%", opacity: 0.5 }}>
						<Text size="1" color="gray">暂无日志</Text>
					</Flex>
				) : (
					reversed.map((log, idx) => (
						<Flex key={`${log.timestamp}-${idx}`} className="combat-log-entry" gap="1" px="3" py="1">
							<Box style={{ flex: 1, minWidth: 0 }}>
								<DataLogRenderer log={log} tokens={tokens} />
							</Box>
							<Text size="1" color="gray" className="log-time">{formatTime(log.timestamp)}</Text>
						</Flex>
					))
				)}
			</Box>
		</Flex>
	);
};

export default CombatLogPanel;
