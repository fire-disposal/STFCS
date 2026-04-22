/**
 * 舰船信息面板
 */

import React from "react";
import { Shield, Zap, Target } from "lucide-react";
import type { ShipViewModel } from "@/renderer";
import { Faction } from "@vt/data";
import { Badge, Box, Button, Flex, Grid, Progress, Text } from "@radix-ui/themes";

export interface ShipInfoPanelProps {
    ship: ShipViewModel | null;
    canControl: boolean;
    onToggleShield: () => void;
    onVent: () => void;
}

export const ShipInfoPanel: React.FC<ShipInfoPanelProps> = ({
    ship,
    canControl,
    onToggleShield,
    onVent,
}) => {
    if (!ship) {
        return (
            <Flex direction="column" align="center" justify="center" className="rbp-empty-state" gap="2">
                <Text size="7">🚀</Text>
                <Text size="3">未选择舰船</Text>
                <Text size="2" color="gray">点击地图上的舰船进行选择</Text>
            </Flex>
        );
    }

    const hullPercent = Math.max(0, Math.min(100, (ship.runtime?.hull / (ship.spec.maxHitPoints || 100)) * 100));
    const shieldPercent = ship.runtime?.shield ? Math.max(0, Math.min(100, ship.runtime.shield.value)) : 0;
    const fluxTotal = (ship.runtime?.fluxSoft || 0) + (ship.runtime?.fluxHard || 0);
    const fluxPercent = Math.max(0, Math.min(100, (fluxTotal / (ship.spec.fluxCapacity || 100)) * 100));

    return (
        <Flex direction="column" gap="3">
            <Flex align="center" justify="between" wrap="wrap" gap="2">
                <Flex align="center" gap="2" wrap="wrap">
                    <Text size="4">{ship.runtime?.faction === Faction.PLAYER ? "🔵" : "🔴"}</Text>
                    <Text size="2">{ship.id.slice(-6)}</Text>
                    {ship.runtime?.overloaded && <Badge color="red" variant="soft">过载</Badge>}
                    {ship.runtime?.shield?.active && <Badge color="blue" variant="soft">护盾</Badge>}
                    {ship.runtime?.venting && <Badge color="purple" variant="soft">辐散中</Badge>}
                </Flex>
                <Badge variant="soft">{ship.runtime?.movement?.currentPhase || "NONE"}</Badge>
            </Flex>

            <Grid columns={{ initial: "1", md: "3" }} gap="3">
                <Box>
                    <Flex justify="between" mb="1"><Text size="1" color="gray">船体</Text><Text size="1">{ship.runtime?.hull}/{ship.spec.maxHitPoints || 100}</Text></Flex>
                    <Progress value={hullPercent} color="green" />
                </Box>
                {ship.runtime?.shield && (
                    <Box>
                        <Flex justify="between" mb="1"><Text size="1" color="gray">护盾</Text><Text size="1">{ship.runtime.shield.value}/100</Text></Flex>
                        <Progress value={shieldPercent} color="blue" />
                    </Box>
                )}
                {(ship.runtime?.fluxSoft || ship.runtime?.fluxHard) && (
                    <Box>
                        <Flex justify="between" mb="1"><Text size="1" color="gray">通量</Text><Text size="1">{fluxTotal}/{ship.spec.fluxCapacity || 100}</Text></Flex>
                        <Progress value={fluxPercent} color="purple" />
                    </Box>
                )}
            </Grid>

            <Grid columns={{ initial: "1", sm: "3" }} gap="2">
                <Button onClick={onToggleShield} disabled={!canControl} variant="soft" color="blue">
                    <Shield size={16} /> 护盾{ship.runtime?.shield?.active ? "关闭" : "开启"}
                </Button>
                <Button onClick={onVent} disabled={!canControl} variant="soft" color="purple">
                    <Zap size={16} /> 辐散通量
                </Button>
                <Button disabled={!canControl} variant="soft" color="green">
                    <Target size={16} /> 移动
                </Button>
            </Grid>
        </Flex>
    );
};

export default ShipInfoPanel;