/**
 * 机库面板
 * 列出当前用户的档案内各舰船并提供按钮，将其部署至当前地图游标位置
 */

import React, { useState, useMemo } from "react";
import { Ship, Target, MapPin, Filter, Search, Upload } from "lucide-react";
import { Badge, Box, Button, Card, Flex, Grid, Select, Text, TextField } from "@radix-ui/themes";
import type { ShipJSON } from "@vt/data";

// 模拟用户舰船档案数据
interface UserShipProfile {
    id: string;
    name: string;
    type: string;
    hull: number;
    hullMax: number;
    shield: number;
    fluxCapacity: number;
    weapons: string[];
    faction: "player" | "neutral" | "enemy";
    description?: string;
    sourceShip?: ShipJSON;
}

export interface HangarPanelProps {
    cursorPosition?: { x: number; y: number };
    ships?: ShipJSON[];
    isLoading?: boolean;
    onDeployShip: (shipProfile: UserShipProfile, position: { x: number; y: number }) => void;
}

export const HangarPanel: React.FC<HangarPanelProps> = ({
    cursorPosition = { x: 0, y: 0 },
    ships = [],
    isLoading = false,
    onDeployShip,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterFaction, setFilterFaction] = useState<string>("all");
    const [selectedShip, setSelectedShip] = useState<string | null>(null);

    const userShips: UserShipProfile[] = useMemo(() => {
        const sizeNameMap: Record<string, string> = {
            FRIGATE: "护卫舰",
            DESTROYER: "驱逐舰",
            CRUISER: "巡洋舰",
            CAPITAL: "主力舰",
        };

        return ships.map((ship) => {
            const faction = ship.runtime?.faction === "PLAYER"
                ? "player"
                : ship.runtime?.faction === "NEUTRAL"
                    ? "neutral"
                    : "enemy";

            const weaponNames = (ship.ship.mounts || [])
                .map((mount) => {
                    if (!mount.weapon) return undefined;
                    if (typeof mount.weapon === "string") return mount.weapon;
                    return mount.weapon.metadata?.name || mount.weapon.$id;
                })
                .filter((w): w is string => Boolean(w));

            return {
                id: ship.$id,
                name: ship.metadata?.name || ship.$id,
                type: sizeNameMap[ship.ship.size] || ship.ship.size,
                hull: ship.runtime?.hull ?? ship.ship.maxHitPoints,
                hullMax: ship.ship.maxHitPoints,
                shield: ship.runtime?.shield?.value ?? 0,
                fluxCapacity: ship.ship.fluxCapacity ?? 0,
                weapons: weaponNames,
                faction,
                description: ship.metadata?.description,
                sourceShip: ship,
            };
        });
    }, [ships]);

    // 过滤舰船
    const filteredShips = useMemo(() => {
        return userShips.filter(ship => {
            // 搜索过滤
            const matchesSearch = searchQuery === "" ||
                ship.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ship.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ship.description?.toLowerCase().includes(searchQuery.toLowerCase());

            // 阵营过滤
            const matchesFaction = filterFaction === "all" || ship.faction === filterFaction;

            return matchesSearch && matchesFaction;
        });
    }, [userShips, searchQuery, filterFaction]);

    const handleDeploy = (ship: UserShipProfile) => {
        onDeployShip(ship, cursorPosition);
    };

    const getFactionColor = (faction: string) => {
        switch (faction) {
            case "player": return "#4a9eff";
            case "neutral": return "#f1c40f";
            case "enemy": return "#ff6f8f";
            default: return "#95a5a6";
        }
    };

    const getFactionLabel = (faction: string) => {
        switch (faction) {
            case "player": return "玩家";
            case "neutral": return "中立";
            case "enemy": return "敌方";
            default: return "未知";
        }
    };

    return (
        <Flex direction="column" gap="3" className="rbp-hangar">
            <Flex align="center" justify="between" wrap="wrap" gap="2">
                <Flex align="center" gap="2">
                    <Ship size={16} />
                    <Text size="2">机库</Text>
                </Flex>
                <Badge variant="soft">
                    <MapPin size={12} /> 部署位置 ({cursorPosition.x.toFixed(0)}, {cursorPosition.y.toFixed(0)})
                </Badge>
            </Flex>

            <Grid columns={{ initial: "1", md: "3" }} gap="2">
                <Box style={{ gridColumn: "span 2" }}>
                    <TextField.Root
                        placeholder="搜索舰船..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    >
                        <TextField.Slot>
                            <Search size={14} />
                        </TextField.Slot>
                    </TextField.Root>
                </Box>
                <Select.Root value={filterFaction} onValueChange={setFilterFaction}>
                    <Select.Trigger>
                        <Filter size={14} /> 阵营过滤
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="all">所有阵营</Select.Item>
                        <Select.Item value="player">玩家</Select.Item>
                        <Select.Item value="neutral">中立</Select.Item>
                        <Select.Item value="enemy">敌方</Select.Item>
                    </Select.Content>
                </Select.Root>
            </Grid>

            {isLoading ? (
                <Flex direction="column" align="center" justify="center" className="rbp-empty-state" gap="2">
                    <Text size="7">🛰️</Text>
                    <Text size="3">正在加载机库...</Text>
                    <Text size="2" color="gray">正在读取玩家存档数据</Text>
                </Flex>
            ) : filteredShips.length === 0 ? (
                <Flex direction="column" align="center" justify="center" className="rbp-empty-state" gap="2">
                    <Text size="7">🚢</Text>
                    <Text size="3">机库暂无舰船</Text>
                    <Text size="2" color="gray">请先在档案中创建或导入舰船</Text>
                </Flex>
            ) : (
                <Grid columns={{ initial: "1", lg: "2" }} gap="2" className="rbp-hangar-grid">
                    {filteredShips.map((ship) => (
                        <Card
                            key={ship.id}
                            variant="surface"
                            className={selectedShip === ship.id ? "rbp-card-active" : ""}
                            onClick={() => setSelectedShip(ship.id)}
                        >
                            <Flex justify="between" align="center" mb="2" wrap="wrap" gap="2">
                                <Badge style={{ backgroundColor: getFactionColor(ship.faction), color: "#fff" }}>{ship.type}</Badge>
                                <Text size="1" style={{ color: getFactionColor(ship.faction) }}>{getFactionLabel(ship.faction)}</Text>
                            </Flex>
                            <Text size="3" mb="1">{ship.name}</Text>
                            <Text size="1" color="gray" mb="2">{ship.description}</Text>

                            <Flex gap="3" mb="2" wrap="wrap">
                                <Text size="1">船体 {ship.hull}/{ship.hullMax}</Text>
                                <Text size="1">护盾 {ship.shield}</Text>
                                <Text size="1">通量 {ship.fluxCapacity}</Text>
                            </Flex>

                            <Flex gap="1" mb="2" wrap="wrap">
                                {ship.weapons.map((weapon) => (
                                    <Badge key={weapon} variant="soft" color="gray">{weapon}</Badge>
                                ))}
                            </Flex>

                            <Flex justify="between" align="center" gap="2" wrap="wrap">
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeploy(ship);
                                    }}
                                >
                                    <Upload size={14} /> 部署
                                </Button>
                                <Text size="1" color="gray"><Target size={12} /> 点击地图设置位置</Text>
                            </Flex>
                        </Card>
                    ))}
                </Grid>
            )}

            <Flex justify="between" wrap="wrap" gap="2">
                <Text size="1" color="gray">显示 {filteredShips.length} / {userShips.length} 艘舰船</Text>
                <Text size="1" color="gray">选择舰船后点击“部署”</Text>
            </Flex>
        </Flex>
    );
};

export default HangarPanel;