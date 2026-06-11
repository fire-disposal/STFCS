/**
 * CombatLogPanel - 战斗日志面板
 *
 * 功能：
 * - 分类过滤（战斗/移动/防御/结算/阶段/系统）
 * - 自动滚动到最新日志
 * - 数值彩色可视化（伤害红、辐能金、护盾绿、移动蓝）
 * - React.memo 优化
 */

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Flex, Text, Box } from "@radix-ui/themes";
import { useGameLogs, useGameTokens } from "@/state/stores/gameStore";
import { BattleLogCategory, BATTLE_LOG_CATEGORY_MAP, BattleLogType } from "@vt/data";
import type { BattleLogEvent } from "@vt/data";
import "./combat-log.css";

const COLLAPSE_THRESHOLD = 10;

const CATEGORY_META: Record<string, { label: string; color: string }> = {
	[BattleLogCategory.COMBAT]: { label: "战斗", color: "#e74c3c" },
	[BattleLogCategory.MOVEMENT]: { label: "移动", color: "#3498db" },
	[BattleLogCategory.DEFENSE]: { label: "防御", color: "#2ecc71" },
	[BattleLogCategory.SETTLEMENT]: { label: "结算", color: "#f39c12" },
	[BattleLogCategory.PHASE]: { label: "阶段", color: "#9b59b6" },
	[BattleLogCategory.SYSTEM]: { label: "系统", color: "#6b8aaa" },
};

const FILTER_CATEGORIES = [
	null,
	BattleLogCategory.COMBAT,
	BattleLogCategory.MOVEMENT,
	BattleLogCategory.DEFENSE,
	BattleLogCategory.SETTLEMENT,
	BattleLogCategory.PHASE,
	BattleLogCategory.SYSTEM,
] as const;

const NC = {
	DAMAGE: "#e74c3c",
	HULL: "#e74c3c",
	ARMOR: "#e67e22",
	FLUX: "#f1c40f",
	DISSIPATION: "#2ecc71",
	SHIELD: "#2ecc71",
	MOVE: "#3498db",
	ROTATE: "#3498db",
	MUTED: "gray",
} as const;

const DICE_COLORS: Record<string, string> = {
	d4: "#9b59b6",
	d6: "#3498db",
	d8: "#2ecc71",
	d10: "#f39c12",
	d12: "#e74c3c",
	d20: "#e67e22",
	d100: "#c0392b",
};

function formatTime(ts: number): string {
	const d = new Date(ts);
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function getTokenName(tokens: Record<string, any>, id?: string): string {
	if (!id) return "";
	const token = tokens[id];
	return token?.runtime?.displayName ?? token?.metadata?.name ?? id?.slice(-6) ?? id ?? "";
}

function formatPosition(pos: unknown): string {
	const p = pos as Record<string, unknown> | null | undefined;
	if (!p || typeof p !== "object") return String(pos ?? "");
	const x = typeof p.x === "number" ? Math.round(p.x) : p.x;
	const y = typeof p.y === "number" ? Math.round(p.y) : p.y;
	return `(${x}, ${y})`;
}

interface LogRendererProps {
	log: BattleLogEvent;
	tokens: Record<string, any>;
}

/** 数值片段，根据语义着色 */
function Num({ color, value }: { color: string; value?: number | string }) {
	if (value == null) return null;
	return <Text style={{ color }}>{value}</Text>;
}

const LogRenderer: React.FC<LogRendererProps> = React.memo(({ log, tokens }) => {
	const d = log.data as Record<string, unknown>;
	const s = (key: string, fallback = ""): string => (d[key] as string | undefined) ?? fallback;
	const n = (key: string): number | undefined => d[key] as number | undefined;
	const b = (key: string): boolean | undefined => d[key] as boolean | undefined;

	const cat = BATTLE_LOG_CATEGORY_MAP[log.type] ?? BattleLogCategory.SYSTEM;
	const catColor = CATEGORY_META[cat]?.color ?? "#6b8aaa";

	switch (log.type) {
		case BattleLogType.ATTACK: {
			const shieldHit = b("shieldHit") && n("fluxGenerated");
			const armorHit = n("armorDamage") != null && n("armorDamage")! > 0;
			const hullHit = n("hullDamage") != null;
			return (
				<span>
					<Text style={{ color: catColor }}>
						{s("weaponName") || s("attackerName") || getTokenName(tokens, s("attackerId"))}
					</Text>
					{" → "}
					<Text>{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					{" "}
					<Text color="gray">
						{s("damageType")} 距<Num color={NC.MUTED} value={n("distance")} />
					</Text>
					<Text style={{ color: NC.DAMAGE }}> {n("hitDamage")}伤害</Text>
					{armorHit ? <Text style={{ color: NC.ARMOR }}> 护甲-{n("armorDamage")}(象限{n("armorQuadrant")})</Text> : null}
					{hullHit ? <Text style={{ color: NC.HULL }}> 结构-{n("hullDamage")}</Text> : !hullHit && !shieldHit ? <Text color="gray"> 未穿透</Text> : null}
					{shieldHit ? <Text style={{ color: NC.SHIELD }}> 护盾拦截+{n("fluxGenerated")}辐能</Text> : null}
				</span>
			);
		}
		case BattleLogType.DEVIATION:
			return (
				<span>
					<Text style={{ color: catColor }}>
						{s("weaponName") || s("attackerName") || getTokenName(tokens, s("attackerId"))}
					</Text>
					{" → "}
					<Text>{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					{" "}
					<Text color="gray">偏差未命中</Text>
				</span>
			);
		case BattleLogType.DESTROYED:
			return (
				<span>
					<Text style={{ color: NC.DAMAGE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text style={{ color: NC.DAMAGE }}>被摧毁</Text>
				</span>
			);
		case BattleLogType.MOVE: {
			const fwd = n("forward");
			const str = n("strafe");
			const hasFwd = fwd != null && fwd !== 0;
			const hasStr = str != null && str !== 0;
			if (!hasFwd && !hasStr) {
				return (
					<span>
						<Text style={{ color: catColor }}>{s("tokenName")}</Text>
						<Text color="gray">移动 无位移</Text>
					</span>
				);
			}
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					{" 移动"}
					{hasFwd ? <><Text style={{ color: NC.MOVE }}>前后 {fwd}</Text>{" "}</> : null}
					{hasStr ? <Text style={{ color: NC.MOVE }}>侧移 {str}</Text> : null}
				</span>
			);
		}
		case BattleLogType.ROTATE:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					{" 旋转 "}
					<Text style={{ color: NC.ROTATE }}>{n("angle")}°</Text>
				</span>
			);
		case BattleLogType.SHIELD_TOGGLE:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					<Text style={{ color: NC.SHIELD }}>{b("active") ? "开启" : "关闭"}护盾</Text>
				</span>
			);
		case BattleLogType.SHIELD_ROTATE:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					{" 护盾转向 "}
					<Text style={{ color: NC.SHIELD }}>{n("direction")}°</Text>
				</span>
			);
		case BattleLogType.VENT:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					<Text style={{ color: NC.DISSIPATION }}>开始排散</Text>
				</span>
			);
		case BattleLogType.OVERLOADED:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					<Text style={{ color: NC.DAMAGE }}>舰船过载</Text>
				</span>
			);
		case BattleLogType.OVERLOAD_END:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					<Text style={{ color: NC.DISSIPATION }}>过载恢复</Text>
				</span>
			);
		case BattleLogType.FLUX_SETTLEMENT: {
			const changetype = s("changeType", "neutral");
			const sign = changetype === "increase" ? "+" : changetype === "decrease" ? "-" : "";
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					{" 辐能结算 "}
					<Text style={{ color: NC.FLUX }}>{n("fluxBefore")}→{n("fluxAfter")}({sign}{n("fluxChange")})</Text>
					{n("shieldUpkeep") ? <Text style={{ color: NC.SHIELD }}> 护盾维持+{n("shieldUpkeep")}</Text> : null}
					{n("ventingCleared") && n("ventingCleared")! > 0 ? <Text style={{ color: NC.DISSIPATION }}> 排散{n("ventingCleared")}</Text> : null}
				</span>
			);
		}
		case BattleLogType.ROUND_END:
			return (
				<span>
					<Text style={{ color: catColor }}>
						第{n("round")}回合结束
					</Text>
					<Text color="gray"> 阶段 {s("phase")}</Text>
				</span>
			);
		case BattleLogType.END_TURN:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					<Text color="gray">结束回合</Text>
				</span>
			);
		case BattleLogType.ADVANCE_PHASE:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("tokenName")}</Text>
					<Text color="gray">推进 {s("fromPhase")}→{s("toPhase")}</Text>
				</span>
			);
		case BattleLogType.DEPLOY: {
			const posStr = d["position"] ? formatPosition(d["position"]) : "";
			return (
				<span>
					<Text style={{ color: catColor }}>{s("playerName")}</Text>
					<Text color="gray">部署了</Text>
					{s("presetName") ? <Text style={{ color: catColor }}>{s("presetName")}</Text> : <Text style={{ color: catColor }}>{s("tokenName")}</Text>}
					{posStr ? <Text style={{ color: NC.MOVE }}> {posStr}偏向{s("heading")}°</Text> : null}
				</span>
			);
		}
		case BattleLogType.EDIT:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("playerName")}</Text>
					<Text color="gray">编辑 {s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					{s("reason") ? <Text color="gray">({s("reason")})</Text> : null}
				</span>
			);
		case BattleLogType.GAME_STARTED:
			return (
				<span>
					<Text style={{ color: "#4fc3ff" }}>游戏开始</Text>
					<Text color="gray"> 首轮 {s("firstFaction")}</Text>
				</span>
			);
		case BattleLogType.FACTION_CHANGE: {
			const turnInfo = n("turn") ? ` 第${n("turn")}回合` : "";
			return (
				<span>
					<Text style={{ color: catColor }}>{s("fromFaction")}</Text>
					{" → "}
					<Text style={{ color: "#4fc3ff" }}>{s("toFaction")}</Text>
					<Text color="gray">{turnInfo}</Text>
				</span>
			);
		}
		case BattleLogType.PLAYER_JOIN:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("playerName")}</Text>
					<Text color="gray">加入游戏</Text>
					{s("faction") ? <Text color="gray">({s("faction")})</Text> : null}
				</span>
			);
		case BattleLogType.PLAYER_LEAVE:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("playerName")}</Text>
					<Text color="gray">离开游戏</Text>
				</span>
			);
		case BattleLogType.PING:
			return (
				<span>
					<Text style={{ color: catColor }}>{s("playerName")}</Text>
					<Text color="gray">标定了一处坐标</Text>
					<Text style={{ color: NC.MOVE }}> ({n("x")}, {n("y")})</Text>
				</span>
			);
		case BattleLogType.ROLL: {
			const diceColor = DICE_COLORS[s("diceType", "d20")];
			const results = (d["results"] as number[]) ?? [];
			return (
				<span>
					<Text style={{ color: catColor }}>{s("playerName")}</Text>
					<Text style={{ color: diceColor }}>
						{" "}{s("diceType")}×{n("count")}
					</Text>
					<Text color="gray">
						{" → "}[{results.join(", ")}] =<Text style={{ color: diceColor }}> {n("sum")}</Text>
					</Text>
				</span>
			);
		}
		case BattleLogType.SYSTEM:
			return <span><Text color="gray">{s("message")}</Text></span>;
		default:
			return <span><Text color="gray">{log.type}: {JSON.stringify(d)}</Text></span>;
	}
});

LogRenderer.displayName = "LogRenderer";

export const CombatLogPanel: React.FC = () => {
	const logs = useGameLogs();
	const tokens = useGameTokens();

	const [filter, setFilter] = useState<string | null>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const listRef = useRef<HTMLDivElement>(null);

	const filteredLogs = useMemo(() => {
		if (logs.length === 0) return [];
		const filtered = filter
			? logs.filter((log) => BATTLE_LOG_CATEGORY_MAP[log.type] === filter)
			: logs;
		const reversed = [...filtered].reverse();
		return reversed;
	}, [logs, filter]);

	useEffect(() => {
		if (autoScroll && listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [filteredLogs, autoScroll]);

	const handleScroll = useCallback(() => {
		const el = listRef.current;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
		if (atBottom && !autoScroll) {
			setAutoScroll(true);
		} else if (!atBottom && autoScroll) {
			setAutoScroll(false);
		}
	}, [autoScroll]);

	return (
		<Flex direction="column" className="combat-log-panel" style={{ height: "100%" }}>
			<Flex align="center" gap="1" px="2" py="1" className="combat-log-header" wrap="wrap">
				<Text size="1" weight="bold">日志</Text>
				<Text size="1" color="gray">({logs.length})</Text>
				<Box style={{ flex: 1 }} />
				{FILTER_CATEGORIES.map((cat) => {
					const isActive = filter === cat;
					const meta = cat ? CATEGORY_META[cat] : null;
					return (
						<button
							key={cat ?? "__all__"}
							type="button"
							className={`combat-log-filter-btn ${isActive ? "combat-log-filter-btn--active" : ""}`}
							style={isActive && meta ? { backgroundColor: meta.color, color: "#fff" } : undefined}
							onClick={() => setFilter(isActive ? null : cat)}
						>
							{meta ? meta.label : "全部"}
						</button>
					);
				})}
			</Flex>
			<Box
				ref={listRef}
				className="combat-log-list"
				style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
				onScroll={handleScroll}
			>
				{filteredLogs.length === 0 ? (
					<Flex align="center" justify="center" style={{ height: "100%", opacity: 0.5 }}>
						<Text size="1" color="gray">{logs.length === 0 ? "暂无日志" : "无匹配日志"}</Text>
					</Flex>
				) : (
					filteredLogs.map((log, idx) => {
						const cat = BATTLE_LOG_CATEGORY_MAP[log.type] ?? BattleLogCategory.SYSTEM;
						const catColor = CATEGORY_META[cat]?.color ?? "#6b8aaa";
						return (
							<Flex
								key={`${log.timestamp}-${idx}`}
								className="combat-log-entry"
								gap="1"
								px="2"
								py="1"
							>
								<Box
									className="combat-log-dot"
									style={{ backgroundColor: catColor }}
								/>
								<Box style={{ flex: 1, minWidth: 0 }} className="combat-log-entry__body">
									<LogRenderer log={log} tokens={tokens} />
								</Box>
								<Text
									size="1"
									color="gray"
									style={{
										flexShrink: 0,
										lineHeight: "18px",
										opacity: 0.6,
									}}
								>
									{formatTime(log.timestamp)}
								</Text>
							</Flex>
						);
					})
				)}
			</Box>
			{!autoScroll && filteredLogs.length > COLLAPSE_THRESHOLD && (
				<Box className="combat-log-scroll-hint">
					<button
						type="button"
						className="combat-log-filter-btn combat-log-filter-btn--active"
						onClick={() => setAutoScroll(true)}
					>
						回到底部
					</button>
				</Box>
			)}
		</Flex>
	);
};

export default CombatLogPanel;
