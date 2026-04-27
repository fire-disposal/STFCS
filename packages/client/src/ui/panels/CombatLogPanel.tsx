/**
 * CombatLogPanel - 战斗日志面板
 *
 * 从 game state 的 logs 字段读取日志条目，按时间线渲染。
 */

import React from "react";
import { FileText, Swords, Crosshair, Shield, Zap, Move, RotateCw, Skull, AlertTriangle, Eye, Edit3, Send, Play, Flag } from "lucide-react";
import { Flex, Text, Box } from "@radix-ui/themes";
import { useGameLogs, useGameTokens } from "@/state/stores/gameStore";
import type { BattleLogEvent } from "@vt/data";
import "./combat-log.css";

function formatTime(ts: number): string {
	const d = new Date(ts);
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function getTokenName(tokens: Record<string, any>, id?: string): string {
	if (!id) return "";
	const token = tokens[id];
	return token?.runtime?.displayName ?? token?.metadata?.name ?? id?.slice(-6) ?? id ?? "";
}

interface LogRendererProps {
	log: BattleLogEvent;
	tokens: Record<string, any>;
}

const LogIcon: Record<string, React.ReactNode> = {
	attack: <Swords size={12} />,
	deviation: <Crosshair size={12} />,
	destroyed: <Skull size={12} />,
	move: <Move size={12} />,
	rotate: <RotateCw size={12} />,
	shield_toggle: <Shield size={12} />,
	shield_rotate: <Shield size={12} />,
	vent: <Zap size={12} />,
	overloaded: <AlertTriangle size={12} />,
	end_turn: <Send size={12} />,
	advance_phase: <Send size={12} />,
	edit: <Edit3 size={12} />,
	system: <Eye size={12} />,
	game_started: <Play size={12} />,
	faction_change: <Flag size={12} />,
};

const LogRenderer: React.FC<LogRendererProps> = ({ log, tokens }) => {
	const d = log.data as Record<string, unknown>;
	const s = (key: string, fallback = ""): string => (d[key] as string | undefined) ?? fallback;
	const n = (key: string): number | undefined => d[key] as number | undefined;
	const b = (key: string): boolean | undefined => d[key] as boolean | undefined;

	switch (log.type) {
		case "attack":
			const shieldLine = b("shieldHit") && n("fluxGenerated")
				? ` | 护盾拦截 +${n("fluxGenerated")}辐能`
				: "";
			const armorLine = n("armorDamage") && n("armorDamage")! > 0
				? ` | 护甲-${n("armorDamage")}(象限${n("armorQuadrant")})`
				: "";
			const dmgLine = n("hullDamage")
				? ` | 结构-${n("hullDamage")}`
				: " | 未穿透";
			return (
				<span>
					<Text weight="bold" style={{ color: "#e74c3c" }}>{s("weaponName") || s("attackerName") || getTokenName(tokens, s("attackerId"))}</Text>
					{" → "}
					<Text weight="bold">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					<Text size="1" color="gray" style={{ fontSize: 10 }}>
						{s("damageType")} 距离{n("distance")} 伤害{n("hitDamage")}
						{armorLine}{dmgLine}{shieldLine}
					</Text>
				</span>
			);
		case "deviation":
			return (
				<span>
					<Text weight="bold" style={{ color: "#f39c12" }}>{s("weaponName") || s("attackerName") || getTokenName(tokens, s("attackerId"))}</Text>
					{" → "}
					<Text weight="bold">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					<Text size="1" color="gray" style={{ fontSize: 10 }}> 偏差未命中</Text>
				</span>
			);
		case "destroyed":
			return (
				<span>
					<Text weight="bold" style={{ color: "#c0392b" }}>{s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					被摧毁
				</span>
			);
		case "move":
			return (
				<span>
					<Text weight="bold" style={{ color: "#3498db" }}>{s("tokenName")}</Text>
					移动 {n("forward") != null && n("forward") !== 0 ? `前后 ${n("forward")}` : ""}{n("strafe") != null && n("strafe") !== 0 ? `侧移 ${n("strafe")}` : ""}
				</span>
			);
		case "rotate":
			return (
				<span>
					<Text weight="bold" style={{ color: "#3498db" }}>{s("tokenName")}</Text>
					旋转 {n("angle")}°
				</span>
			);
		case "shield_toggle":
			return (
				<span>
					<Text weight="bold" style={{ color: "#2ecc71" }}>{s("tokenName")}</Text>
					{b("active") ? "开启" : "关闭"}护盾
				</span>
			);
		case "shield_rotate":
			return (
				<span>
					<Text weight="bold" style={{ color: "#2ecc71" }}>{s("tokenName")}</Text>
					护盾转向 {n("direction")}°
				</span>
			);
		case "vent":
			return (
				<span>
					<Text weight="bold" style={{ color: "#f1c40f" }}>{s("tokenName")}</Text>
					开始排散
				</span>
			);
		case "overloaded":
			return (
				<span>
					<Text weight="bold" style={{ color: "#e74c3c" }}>{s("tokenName")}</Text>
					舰船过载
				</span>
			);
		case "end_turn":
			return (
				<span>
					<Text weight="bold" style={{ color: "#9b59b6" }}>{s("tokenName")}</Text>
					结束回合
				</span>
			);
		case "advance_phase":
			return (
				<span>
					<Text weight="bold" style={{ color: "#9b59b6" }}>{s("tokenName")}</Text>
					推进阶段 {s("fromPhase")}→{s("toPhase")}
				</span>
			);
		case "edit":
			return (
				<span>
					<Text style={{ color: "#6b8aaa" }}>{s("playerName")}</Text>
					{" "}编辑 {s("tokenName") || getTokenName(tokens, s("tokenId"))}
					{s("reason") ? <Text color="gray"> ({s("reason")})</Text> : null}
				</span>
			);
		case "game_started":
			return (
				<span>
					<Text style={{ color: "#4fc3ff" }}>游戏开始</Text>
					<Text size="1" color="gray" style={{ fontSize: 10 }}>
						{" "}首轮 {s("firstFaction")}
					</Text>
				</span>
			);
		case "faction_change":
			const turnInfo = n("turn") ? ` 第${n("turn")}回合` : "";
			return (
				<span>
					<Text style={{ color: "#9b59b6" }}>{s("fromFaction")}</Text>
					{" → "}
					<Text style={{ color: "#4fc3ff" }}>{s("toFaction")}</Text>
					<Text size="1" color="gray" style={{ fontSize: 10 }}>{turnInfo}</Text>
				</span>
			);
		case "system":
			return <span><Text color="gray">{s("message")}</Text></span>;
		default:
			return <span><Text color="gray">{log.type}: {JSON.stringify(d)}</Text></span>;
	}
};

export const CombatLogPanel: React.FC = () => {
	const logs = useGameLogs();
	const tokens = useGameTokens();
	const reversed = logs.length === 0 ? [] : [...logs].reverse();

	return (
		<Flex direction="column" className="combat-log-panel" style={{ height: "100%" }}>
			<Flex align="center" gap="2" px="3" py="2" className="combat-log-header">
				<FileText size={14} />
				<Text size="1" weight="bold">战斗日志</Text>
				<Text size="1" color="gray">({logs.length})</Text>
			</Flex>
			<Box className="combat-log-list" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
		{reversed.length === 0 ? (
			<Flex align="center" justify="center" style={{ height: "100%", opacity: 0.5 }}>
				<Text size="1" color="gray">暂无日志</Text>
			</Flex>
		) : (
			reversed.map((log, idx) => (
						<Flex key={`${log.timestamp}-${idx}`} className="combat-log-entry" gap="2" px="3" py="1">
							<Box className="combat-log-icon" style={{ flexShrink: 0, width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
								{LogIcon[log.type] ?? <Eye size={12} />}
							</Box>
							<Box style={{ flex: 1, minWidth: 0 }}>
								<LogRenderer log={log} tokens={tokens} />
							</Box>
							<Text size="1" color="gray" style={{ flexShrink: 0, fontSize: 10 }}>{formatTime(log.timestamp)}</Text>
						</Flex>
					))
				)}
			</Box>
		</Flex>
	);
};

export default CombatLogPanel;
