/**
 * DMControlSidebarPanel - DM控制面板
 * 房主专用：回合推进、派系管理、玩家管理
 */

import React, { useMemo } from "react";
import { ChevronDown, Users, UserX, Plus, Minus, FastForward, Play, ChevronUp } from "lucide-react";
import { Button, Flex, Text, Badge, DropdownMenu, Card, Separator } from "@radix-ui/themes";
import type { SocketNetworkManager } from "@/network";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import {
    useGamePlayers,
    useGamePhase,
    useGameTurnCount,
    useGameActiveFaction,
    useGamePlayerId,
    useGameState,
} from "@/state/stores/gameStore";
import { GamePhase } from "@vt/data";

interface DMControlSidebarPanelProps {
    networkManager: SocketNetworkManager;
}

const PHASE_LABEL: Record<string, string> = {
    DEPLOYMENT: "部署阶段",
    PLAYER_ACTION: "旧行动阶段",
    FACTION_ACTION: "派系行动",
    SETTLEMENT: "结算中",
};

export const DMControlSidebarPanel: React.FC<DMControlSidebarPanelProps> = ({
    networkManager,
}) => {
    const { send } = useGameAction();

    const players = useGamePlayers();
    const phase = useGamePhase();
    const turnCount = useGameTurnCount();
    const activeFaction = useGameActiveFaction();
    const gameState = useGameState();
    const playerId = useGamePlayerId();
    const currentPlayer = playerId ? players[playerId] : undefined;
    const isHost = currentPlayer?.role === "HOST";

    const playerList = useMemo(() => Object.entries(players).map(([id, p]) => ({
        id,
        sessionId: p.sessionId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        connected: p.connected,
    })), [players]);

    if (!isHost) return null;

    const handleAdvanceTurn = async () => {
        if (phase === GamePhase.DEPLOYMENT) {
            await send("room:action", { action: "start" });
        } else {
            await send("edit:room", { action: "force_end_turn" });
        }
    };

    const handleMoveFaction = async (index: number, direction: 1 | -1) => {
        const order = [...initiativeOrder];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= order.length) return;
        [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
        await send("edit:faction", { action: "reorder", initiativeOrder: order });
    };

    const factions = gameState?.factions ?? {};
    const initiativeOrder = gameState?.initiativeOrder ?? [];
    const currentIdx = activeFaction ? initiativeOrder.indexOf(activeFaction) : -1;
    const isLastFaction = currentIdx === initiativeOrder.length - 1;
    const currentDef = activeFaction ? factions[activeFaction] : undefined;

    const getPhaseStyle = (p: GamePhase) => {
        if (p === GamePhase.DEPLOYMENT) return { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" };
        if (p === GamePhase.SETTLEMENT) return { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" };
        return { bg: "rgba(74,158,255,0.15)", color: "#4a9eff" };
    };
    const ps = getPhaseStyle(phase);

    return (
        <Flex direction="column" gap="2" style={{ height: "100%" }}>
            {/* 标题 */}
            <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                <Badge color="gold" size="1">DM</Badge>
                <Text size="2" weight="bold">控制面板</Text>
            </Flex>

            {/* 当前回合状态 */}
            <Card style={{ padding: "8px 10px" }}>
                <Flex justify="between" align="center" mb="2">
                    <Text size="1" weight="bold" color="gray">回合 {turnCount}</Text>
                    <Badge size="1" style={{ background: ps.bg, color: ps.color }}>
                        {PHASE_LABEL[phase] ?? phase}
                    </Badge>
                </Flex>
                {currentDef && (
                    <Flex align="center" gap="2" mt="1">
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: currentDef.color, flexShrink: 0 }} />
                        <Text size="1" weight="bold">{currentDef.name}</Text>
                        <Text size="1" color="gray">行动中</Text>
                    </Flex>
                )}
            </Card>

            {/* 先攻线 */}
            {initiativeOrder.length > 0 && (
                <Card style={{ padding: "6px 8px" }}>
                    <Text size="1" color="gray" mb="2">先攻顺序</Text>
                    <Flex direction="column" gap="1">
                        {initiativeOrder.map((fid, idx) => {
                            const def = factions[fid];
                            const isActive = idx === currentIdx;
                            const done = idx < currentIdx;
                            return (
                                <Flex key={fid} align="center" gap="2" style={{
                                    padding: "4px 6px",
                                    borderRadius: 4,
                                    background: isActive ? "rgba(74,158,255,0.12)" : "transparent",
                                    opacity: done ? 0.45 : 1,
                                }}>
                                    <Text size="1" color="gray" style={{ width: 14, textAlign: "center" }}>{idx + 1}</Text>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: def?.color ?? "#888", flexShrink: 0 }} />
                                    <Text size="1" style={{ flex: 1, fontWeight: isActive ? 700 : 400 }}>
                                        {def?.name ?? fid}
                                    </Text>
                                    <Flex direction="column" gap="0">
                                        <button
                                            onClick={() => handleMoveFaction(idx, -1)}
                                            disabled={idx === 0}
                                            style={{
                                                border: "none", background: "transparent", color: idx === 0 ? "#333" : "#6b8aaa",
                                                cursor: idx === 0 ? "default" : "pointer", padding: 0, lineHeight: 1,
                                                display: "flex",
                                            }}
                                        >
                                            <ChevronUp size={10} />
                                        </button>
                                        <button
                                            onClick={() => handleMoveFaction(idx, 1)}
                                            disabled={idx === initiativeOrder.length - 1}
                                            style={{
                                                border: "none", background: "transparent", color: idx === initiativeOrder.length - 1 ? "#333" : "#6b8aaa",
                                                cursor: idx === initiativeOrder.length - 1 ? "default" : "pointer", padding: 0, lineHeight: 1,
                                                display: "flex",
                                            }}
                                        >
                                            <ChevronDown size={10} />
                                        </button>
                                    </Flex>
                                    {isActive && <Badge size="1" color="blue">◀</Badge>}
                                </Flex>
                            );
                        })}
                    </Flex>
                </Card>
            )}

            {/* 主操作按钮 */}
            <Button
                size="2"
                variant="solid"
                color={isLastFaction ? "red" : "blue"}
                onClick={handleAdvanceTurn}
                style={{ width: "100%", fontWeight: 600 }}
            >
                {phase === GamePhase.DEPLOYMENT ? (
                    <><Play size={14} /> 开始游戏</>
                ) : isLastFaction ? (
                    <><FastForward size={14} /> 结算回合</>
                ) : (
                    <><FastForward size={14} /> 下一派系</>
                )}
            </Button>

            <Separator size="4" />

            {/* 高级控制 */}
            <Card style={{ padding: "6px 8px" }}>
                <Text size="1" color="gray" mb="2">回合调整</Text>
                <Flex gap="1" mb="2">
                    <Button size="1" variant="soft" onClick={async () => { await send("edit:room", { action: "set_turn", turn: Math.max(1, turnCount - 1) }); }}>
                        <Minus size={12} />
                    </Button>
                    <Button size="1" variant="soft" onClick={async () => { await send("edit:room", { action: "set_turn", turn: turnCount + 1 }); }}>
                        <Plus size={12} />
                    </Button>
                </Flex>
                <Flex gap="1" wrap="wrap">
                    <Button size="1" variant="soft" color="purple" onClick={() => send("edit:room", { action: "set_phase", phase: "DEPLOYMENT" })}>部署</Button>
                    <Button size="1" variant="soft" onClick={() => send("edit:room", { action: "set_phase", phase: "FACTION_ACTION" })}>派系行动</Button>
                    <Button size="1" variant="soft" color="amber" onClick={() => send("edit:room", { action: "set_phase", phase: "SETTLEMENT" })}>结算</Button>
                </Flex>
            </Card>

            {/* 玩家管理 */}
            <Card style={{ padding: "6px 8px" }}>
                <Text size="1" color="gray" mb="2">玩家管理</Text>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <Button size="1" variant="soft" color="amber" style={{ width: "100%" }}>
                            <Users size={12} /> 管理 <ChevronDown size={10} />
                        </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <DropdownMenu.Label>踢出玩家</DropdownMenu.Label>
                        {playerList.map((p) => (
                            <DropdownMenu.Item key={p.id} onClick={() => {
                                networkManager.kickPlayer(p.sessionId);
                                notify.success(`已踢出 ${p.nickname}`);
                            }}>
                                <UserX size={12} /> {p.nickname} {p.isReady ? "✓" : "○"}
                            </DropdownMenu.Item>
                        ))}
                        <DropdownMenu.Separator />
                        <DropdownMenu.Label>转移房主</DropdownMenu.Label>
                        {playerList.filter((p) => p.role !== "HOST").map((p) => (
                            <DropdownMenu.Item key={p.id} onClick={() => {
                                networkManager.transferHost(p.sessionId);
                                notify.success("房主权限已转移");
                            }}>
                                {p.nickname}
                            </DropdownMenu.Item>
                        ))}
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </Card>
        </Flex>
    );
};

export default DMControlSidebarPanel;
