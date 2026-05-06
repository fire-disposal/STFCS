/**
 * CombatLogPanel - 战斗日志面板（统一增强版）
 *
 * 从 game state 的 logs 字段读取日志条目，按时间线渲染。
 *
 * 渲染原则：
 * - 有 richText 字段 → 使用富文本渲染（着色、加粗）
 * - 无 richText → 使用 type + data 字段兼容渲染
 *
 * 支持的事件类型（完整列表）：
 *  combat:    attack, deviation, destroyed, overloaded
 *  movement:  move, rotate, advance_phase, end_turn
 *  shield:    shield_toggle, shield_rotate
 *  flux:      vent, flux_settlement, overload_end
 *  deploy:    deploy
 *  game:      game_started, faction_change
 *  player:    player_joined, player_left, player_disconnected,
 *             player_reconnected, host_changed
 *  admin:     edit, room_edit, kick, game_reload
 *  system:    system
 */

import React from "react";
import { Flex, Text, Box } from "@radix-ui/themes";
import { useGameLogs, useGameTokens } from "@/state/stores/gameStore";
import { LOG_COLORS } from "@vt/data";
import type { BattleLogEvent, RichTextSegment } from "@vt/data";
import "./combat-log.css";

// ==================== 工具函数 ====================

function formatTime(ts: number): string {
	const d = new Date(ts);
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function getTokenName(tokens: Record<string, any>, id?: string): string {
	if (!id) return "";
	const token = tokens[id];
	return token?.runtime?.displayName ?? token?.metadata?.name ?? id?.slice(-6) ?? id ?? "";
}

// ==================== 富文本渲染器 ====================

const FACTION_COLORS: Record<string, string> = {
	PLAYER_ALLIANCE: LOG_COLORS.FACTION_PA,
	FATE_GRIP: LOG_COLORS.FACTION_FG,
};

/**
 * 根据语义 tag 获取默认颜色
 */
function getTagColor(tag?: string): string | undefined {
	if (!tag) return undefined;
	switch (tag) {
		case "ship_name":
			return LOG_COLORS.SHIP_NAME;
		case "weapon_name":
			return LOG_COLORS.ATTACK;
		case "damage":
			return LOG_COLORS.ATTACK_ACCENT;
		case "faction":
			return LOG_COLORS.FACTION;
		case "system":
			return LOG_COLORS.SYSTEM;
		case "player":
			return LOG_COLORS.PLAYER;
		case "shield":
			return LOG_COLORS.SHIELD;
		case "overload":
			return LOG_COLORS.OVERLOAD;
		case "flux":
			return LOG_COLORS.VENT;
		case "move":
			return LOG_COLORS.MOVE;
		case "destroyed":
			return LOG_COLORS.DESTROYED;
		case "edit":
			return LOG_COLORS.EDIT;
		case "deploy":
			return LOG_COLORS.DEPLOY;
		default:
			return undefined;
	}
}

/**
 * 富文本片段渲染组件
 */
const RichTextRenderer: React.FC<{ segments: RichTextSegment[] }> = ({ segments }) => {
	return (
		<span>
			{segments.map((seg, i) => {
				const color = seg.color ?? getTagColor(seg.tag) ?? LOG_COLORS.WHITE;
				return (
					<Text
						key={i}
						style={{
							color,
							fontWeight: seg.bold ? "bold" : undefined,
							fontStyle: seg.italic ? "italic" : undefined,
						}}
						size={seg.size === "xs" ? "1" : seg.size === "sm" ? "1" : seg.size === "lg" ? "2" : "2"}
					>
						{seg.text}
					</Text>
				);
			})}
		</span>
	);
};

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
		// ==================== 战斗 ====================
		case "attack": {
			const shieldLine =
				b("shieldHit") && n("fluxGenerated") ? ` | 护盾+${n("fluxGenerated")}辐` : "";
			const armorLine =
				n("armorDamage") && n("armorDamage")! > 0
					? ` | 护甲-${n("armorDamage")}(象限${n("armorQuadrant")})`
					: "";
			const dmgLine =
				n("hullDamage") && n("hullDamage")! > 0 ? ` | 结构-${n("hullDamage")}` : " | 未穿透";
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.ATTACK }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</Text>
					{" → "}
					<Text weight="bold">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
						{" "}
						{s("damageType")} {n("distance")}u 伤害{n("finalDamage") ?? n("hitDamage")}
						{armorLine}
						{dmgLine}
						{shieldLine}
						{b("destroyed") ? " 💀" : ""}
						{b("overloaded") ? " ⚡" : ""}
					</Text>
				</span>
			);
		}
		case "deviation":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.DEVIATION }}>
						{s("weaponName") || getTokenName(tokens, s("attackerId"))}
					</Text>
					{" → "}
					<Text weight="bold">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
					<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
						{" "}
						偏差未命中
					</Text>
				</span>
			);
		case "destroyed":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.DESTROYED }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text style={{ color: LOG_COLORS.DESTROYED }}> 被摧毁</Text>
				</span>
			);
		case "overloaded":
		case "overload":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.OVERLOAD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>
						{" "}
						舰船过载
						{s("reason") ? ` (${s("reason")})` : ""}
					</Text>
				</span>
			);

		// ==================== 移动 ====================
		case "move": {
			const parts: string[] = [];
			if (n("forward") != null && n("forward") !== 0) parts.push(`前后${n("forward")}`);
			if (n("strafe") != null && n("strafe") !== 0) parts.push(`侧移${n("strafe")}`);
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.MOVE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					{parts.join(" ")}
				</span>
			);
		}
		case "rotate":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.MOVE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					旋转 {n("angle")}°
				</span>
			);
		case "advance_phase":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.PHASE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					推进阶段 {s("fromPhase")}→{s("toPhase")}
				</span>
			);
		case "end_turn":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.PHASE }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					结束回合
				</span>
			);

		// ==================== 护盾 ====================
		case "shield_toggle":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					{b("active") ? "开启" : "关闭"}护盾
				</span>
			);
		case "shield_rotate":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					护盾转向 {n("direction")}°
				</span>
			);

		// ==================== 辐能 ====================
		case "vent":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.VENT }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>{" "}
					开始排散
					{n("fluxCleared") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							清除{n("fluxCleared")}辐能
						</Text>
					) : null}
				</span>
			);
		case "flux_settlement": {
			const change = n("fluxChange") ?? 0;
			const changeIcon = change > 0 ? "↑" : change < 0 ? "↓" : "—";
			const changeColor =
				change > 0 ? LOG_COLORS.OVERLOAD : change < 0 ? LOG_COLORS.SHIELD : LOG_COLORS.GRAY;
			return (
				<span>
					<Text weight="bold">{s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
						{" "}
						辐能结算
						{n("fluxBefore") != null ? ` ${n("fluxBefore")}→${n("fluxAfter")}` : ""}{" "}
						<Text style={{ color: changeColor }}>
							{changeIcon}
							{Math.abs(change)}
						</Text>
						{n("shieldUpkeep") && n("shieldUpkeep")! > 0 ? ` 护盾维持+${n("shieldUpkeep")}` : ""}
						{n("dissipation") && n("dissipation")! > 0 ? ` 散热-${n("dissipation")}` : ""}
						{n("ventingCleared") && n("ventingCleared")! > 0
							? ` 排散清除${n("ventingCleared")}辐能`
							: ""}
					</Text>
				</span>
			);
		}
		case "overload_end":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.SHIELD }}>
						{s("tokenName") || getTokenName(tokens, s("tokenId"))}
					</Text>
					<Text style={{ color: LOG_COLORS.SHIELD }}> 过载恢复</Text>
				</span>
			);

		// ==================== 部署 ====================
		case "deploy":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.DEPLOY }}>部署</Text>{" "}
					<Text weight="bold">{s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					{n("presetName") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							({s("presetName")})
						</Text>
					) : null}
					<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
						{" "}
						派系 {s("faction")}
					</Text>
				</span>
			);

		// ==================== 游戏管理 ====================
		case "game_started":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.SYSTEM }}>
						游戏开始
					</Text>
					<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
						{" "}
						首轮 {s("firstFaction")}
					</Text>
				</span>
			);
		case "faction_change": {
			const turnInfo = n("turn") ? ` 第${n("turn")}回合` : "";
			const fromColor = FACTION_COLORS[s("fromFaction")] ?? LOG_COLORS.FACTION;
			const toColor = FACTION_COLORS[s("toFaction")] ?? LOG_COLORS.SYSTEM;
			return (
				<span>
					<Text style={{ color: fromColor }}>{s("fromFaction")}</Text>
					<Text> → </Text>
					<Text style={{ color: toColor }}>{s("toFaction")}</Text>
					<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
						{turnInfo}
					</Text>
				</span>
			);
		}
		case "game_reload":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "系统"}</Text>{" "}
					<Text style={{ color: LOG_COLORS.SYSTEM }}>读取存档</Text>
					{s("saveName") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							({s("saveName")})
						</Text>
					) : null}
				</span>
			);

		// ==================== 玩家事件 ====================
		case "player_joined":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.PLAYER }}>
						{s("playerName")}
					</Text>
					<Text style={{ color: LOG_COLORS.GRAY }}> 加入房间</Text>
					{n("totalPlayers") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							({n("totalPlayers")}人)
						</Text>
					) : null}
				</span>
			);
		case "player_left":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.OVERLOAD }}>
						{s("playerName")}
					</Text>
					<Text style={{ color: LOG_COLORS.GRAY }}> 离开房间</Text>
					{n("totalPlayers") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							({n("totalPlayers")}人)
						</Text>
					) : null}
				</span>
			);
		case "player_disconnected":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.DEVIATION }}>
						{s("playerName")}
					</Text>
					<Text style={{ color: LOG_COLORS.GRAY }}> 断开连接</Text>
				</span>
			);
		case "player_reconnected":
			return (
				<span>
					<Text weight="bold" style={{ color: LOG_COLORS.SHIELD }}>
						{s("playerName")}
					</Text>
					<Text style={{ color: LOG_COLORS.GRAY }}> 重新连接</Text>
				</span>
			);
		case "host_changed":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.SYSTEM }}>房主转移至</Text>{" "}
					<Text weight="bold" style={{ color: LOG_COLORS.PLAYER }}>
						{s("newHostName") || s("newHostId")}
					</Text>
					{b("previousHostDisconnected") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							(原房主断线)
						</Text>
					) : null}
				</span>
			);
		case "kick":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.OVERLOAD_ACCENT }}>踢出</Text>{" "}
					<Text weight="bold">{s("targetName") || getTokenName(tokens, s("targetId"))}</Text>
				</span>
			);

		// ==================== 编辑操作 ====================
		case "edit":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "系统"}</Text> 编辑{" "}
					<Text weight="bold">{s("tokenName") || getTokenName(tokens, s("tokenId"))}</Text>
					{s("reason") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							({s("reason")})
						</Text>
					) : null}
					{s("path") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							[{s("path")}]
						</Text>
					) : null}
				</span>
			);
		case "room_edit": {
			const subAction = s("action");
			const actionLabels: Record<string, string> = {
				set_modifier: "修改全局修正",
				remove_modifier: "移除全局修正",
				set_phase: "切换阶段",
				set_turn: "调整回合",
				set_faction: "调整派系",
			};
			return (
				<span>
					<Text style={{ color: LOG_COLORS.EDIT }}>{s("playerName") || "DM"}</Text>{" "}
					<Text>{actionLabels[subAction] || subAction}</Text>
					{s("detail") ? (
						<Text size="1" style={{ fontSize: 10, color: LOG_COLORS.GRAY }}>
							{" "}
							({s("detail")})
						</Text>
					) : null}
				</span>
			);
		}

		// ==================== 系统消息 ====================
		case "system":
			return (
				<span>
					<Text style={{ color: LOG_COLORS.GRAY }}>{s("message") || JSON.stringify(d)}</Text>
				</span>
			);
		default:
			return (
				<span>
					<Text style={{ color: LOG_COLORS.GRAY }}>
						{log.type}: {JSON.stringify(d)}
					</Text>
				</span>
			);
	}
};

// ==================== 主渲染器 ====================

const LogRenderer: React.FC<LogRendererProps> = ({ log, tokens }) => {
	// 优先使用 richText 渲染
	if (log.richText && log.richText.length > 0) {
		return <RichTextRenderer segments={log.richText} />;
	}
	// 回退到 data-based 渲染
	return <DataLogRenderer log={log} tokens={tokens} />;
};

// ==================== 面板组件 ====================

export const CombatLogPanel: React.FC = () => {
	const logs = useGameLogs();
	const tokens = useGameTokens();
	const reversed = logs.length === 0 ? [] : [...logs].reverse();

	return (
		<Flex direction="column" className="combat-log-panel" style={{ height: "100%" }}>
			<Flex align="center" gap="2" px="3" py="2" className="combat-log-header">
				<Text size="1" weight="bold">
					战斗日志
				</Text>
				<Text size="1" color="gray">
					({logs.length})
				</Text>
			</Flex>
			<Box className="combat-log-list" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
				{reversed.length === 0 ? (
					<Flex align="center" justify="center" style={{ height: "100%", opacity: 0.5 }}>
						<Text size="1" color="gray">
							暂无日志
						</Text>
					</Flex>
				) : (
					reversed.map((log, idx) => (
						<Flex
							key={`${log.timestamp}-${idx}`}
							className="combat-log-entry"
							gap="1"
							px="3"
							py="1"
						>
							<Box style={{ flex: 1, minWidth: 0 }}>
								<LogRenderer log={log} tokens={tokens} />
							</Box>
							<Text
								size="1"
								color="gray"
								style={{ flexShrink: 0, fontSize: 10, lineHeight: "18px" }}
							>
								{formatTime(log.timestamp)}
							</Text>
						</Flex>
					))
				)}
			</Box>
		</Flex>
	);
};

export default CombatLogPanel;
