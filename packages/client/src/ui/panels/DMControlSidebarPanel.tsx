/**
 * DMControlSidebarPanel - DM控制面板
 * 房主专用：回合推进、阶段切换、玩家管理
 */

import React, { useMemo } from "react";
import { ChevronDown, Users, UserX, Plus, Minus, FastForward, Play } from "lucide-react";
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
} from "@/state/stores/gameStore";
import { GamePhase, FactionLabels, TURN_ORDER } from "@vt/data";

interface DMControlSidebarPanelProps {
    networkManager: SocketNetworkManager;
}

export const DMControlSidebarPanel: React.FC<DMControlSidebarPanelProps> = ({
    networkManager,
}) => {
    const { send } = useGameAction();

    const players = useGamePlayers();
    const phase = useGamePhase();
    const turnCount = useGameTurnCount();
    const activeFaction = useGameActiveFaction();
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

    const handleSetPhase = async (newPhase: string) => {
        const result = await send("edit:room", { action: "set_phase", phase: newPhase });
        if (result) notify.success(`阶段已切换为 ${newPhase}`);
    };

    const handleSetTurn = async (turn: number) => {
        const result = await send("edit:room", { action: "set_turn", turn });
        if (result) notify.success(`回合已设置为 ${turn}`);
    };

    const handleTransferHost = (targetId: string) => {
        networkManager.transferHost(targetId);
        notify.success("房主权限已转移");
    };

    const handleAdvanceTurn = async () => {
        if (phase === GamePhase.DEPLOYMENT) {
            await send("room:action", { action: "start" });
        } else {
            await send("edit:room", { action: "force_end_turn" });
        }
    };

    const isLastFaction = activeFaction && TURN_ORDER.indexOf(activeFaction) === TURN_ORDER.length - 1;

    return (
        <Flex direction="column" gap="2" style={{ height: "100%" }}>
            {/* 标题 */}
            <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                <Badge color="gold" size="1">DM</Badge>
                <Text size="2" weight="bold">控制面板</Text>
            </Flex>

            {/* 当前状态 */}
            <Card style={{ padding: "6px 8px" }}>
                <Flex direction="column" gap="1">
                    <Flex align="center" justify="between">
                        <Text size="1" color="gray">回合</Text>
                        <Badge size="1">{turnCount}</Badge>
                    </Flex>
                    <Flex align="center" justify="between">
                        <Text size="1" color="gray">阶段</Text>
                        <Badge size="1" color="blue">{phase}</Badge>
                    </Flex>
                    {activeFaction && (
                        <Flex align="center" justify="between">
                            <Text size="1" color="gray">阵营</Text>
                            <Badge size="1" color={activeFaction === "PLAYER_ALLIANCE" ? "green" : "red"}>
                                {FactionLabels[activeFaction as keyof typeof FactionLabels]}
                            </Badge>
                        </Flex>
                    )}
                </Flex>
            </Card>

            {/* 回合推进 */}
            <Card style={{ padding: "6px 8px" }}>
                <Text size="1" color="gray" mb="1">回合推进</Text>
                <Button 
                    size="1" 
                    variant="solid" 
                    color={isLastFaction ? "red" : "blue"}
                    onClick={handleAdvanceTurn}
                    style={{ width: "100%" }}
                >
                    {phase === GamePhase.DEPLOYMENT ? (
                        <><Play size={12} /> 开始游戏</>
                    ) : isLastFaction ? (
                        <><FastForward size={12} /> 结算回合</>
                    ) : (
                        <><FastForward size={12} /> 推进派系</>
                    )}
                </Button>
            </Card>

            <Separator size="4" />

            {/* 阶段切换 */}
            <Card style={{ padding: "6px 8px" }}>
                <Text size="1" color="gray" mb="1">阶段切换</Text>
                <Flex gap="1" wrap="wrap">
                    <Button size="1" variant="soft" onClick={() => handleSetPhase("DEPLOYMENT")}>部署</Button>
                    <Button size="1" variant="soft" onClick={() => handleSetPhase("PLAYER_ACTION")}>行动</Button>
                </Flex>
            </Card>

            {/* 回合控制 */}
            <Card style={{ padding: "6px 8px" }}>
                <Text size="1" color="gray" mb="1">回合调整</Text>
                <Flex gap="1">
                    <Button size="1" variant="soft" onClick={() => handleSetTurn(turnCount + 1)}>
                        <Plus size={12} /> +1
                    </Button>
                    <Button size="1" variant="soft" onClick={() => handleSetTurn(Math.max(1, turnCount - 1))}>
                        <Minus size={12} /> -1
                    </Button>
                </Flex>
            </Card>

            {/* 玩家管理 */}
            <Card style={{ padding: "6px 8px" }}>
                <Text size="1" color="gray" mb="1">玩家管理</Text>
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
                            <DropdownMenu.Item key={p.id} onClick={() => handleTransferHost(p.sessionId)}>
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
