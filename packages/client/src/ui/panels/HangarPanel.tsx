/**
 * 机库面板
 * 列出当前用户的档案内各舰船并提供按钮，将其部署至当前地图游标位置
 */

import React, { useState, useMemo, useEffect } from "react";
import { Target, Filter, Search, Rocket } from "lucide-react";
import { Badge, Box, Button, Card, Flex, Grid, Text, TextField, Select } from "@radix-ui/themes";
import type { CombatToken } from "@vt/data";
import type { SocketNetworkManager, SocketRoom } from "@/network";
import { notify } from "@/ui/shared/Notification";

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
	sourceShip?: CombatToken;
}

export interface HangarPanelProps {
	cursorPosition?: { x: number; y: number };
	networkManager: SocketNetworkManager;
	room: SocketRoom | undefined;
	isHost: boolean;
}

export const HangarPanel: React.FC<HangarPanelProps> = ({
	cursorPosition = { x: 0, y: 0 },
	networkManager,
	room,
	isHost,
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterFaction, setFilterFaction] = useState<string>("all");
	const [hangarShips, setHangarShips] = useState<CombatToken[]>([]);
	const [hangarLoading, setHangarLoading] = useState(false);

	useEffect(() => {
		let disposed = false;
		const loadHangar = async () => {
			setHangarLoading(true);
			const result = await networkManager.getLoadout();
			if (disposed) return;
			if (!result.success || !result.loadout) {
				notify.error(result.error || "机库数据加载失败");
				setHangarShips([]);
			} else {
				setHangarShips(result.loadout.ships || []);
			}
			setHangarLoading(false);
		};
		void loadHangar();
		return () => { disposed = true; };
	}, [networkManager]);

	const userShips: UserShipProfile[] = useMemo(() => {
		const sizeNameMap: Record<string, string> = {
			FRIGATE: "护卫舰",
			DESTROYER: "驱逐舰",
			CRUISER: "巡洋舰",
			CAPITAL: "主力舰",
		};

		return hangarShips.map((ship) => {
			const faction = ship.runtime?.faction === "PLAYER"
				? "player"
				: ship.runtime?.faction === "NEUTRAL"
					? "neutral"
					: "enemy";

			const weaponNames = (ship.spec.mounts || [])
				.map((mount: any) => {
					if (!mount.weapon) return undefined;
					if (typeof mount.weapon === "string") return mount.weapon;
					return mount.weapon?.spec?.metadata?.name || mount.weapon?.spec?.$id || mount.weapon.$id;
				})
				.filter((w: any): w is string => Boolean(w));

			return {
				id: ship.$id,
				name: ship.metadata?.name || ship.$id,
				type: sizeNameMap[ship.spec.size] || ship.spec.size,
				hull: ship.runtime?.hull ?? ship.spec.maxHitPoints,
				hullMax: ship.spec.maxHitPoints,
				shield: ship.runtime?.shield?.value ?? 0,
				fluxCapacity: ship.spec.fluxCapacity ?? 0,
				weapons: weaponNames,
				faction,
				description: ship.metadata?.description,
				sourceShip: ship,
			};
		});
	}, [hangarShips]);

	const filteredShips = useMemo(() => {
		return userShips.filter(ship => {
			const matchesSearch = searchQuery === "" ||
				ship.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				ship.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
				ship.description?.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesFaction = filterFaction === "all" || ship.faction === filterFaction;

			return matchesSearch && matchesFaction;
		});
	}, [userShips, searchQuery, filterFaction]);

	const handleDeploy = async (ship: UserShipProfile) => {
		if (!room || !isHost) {
			notify.error("只有房主可以部署舰船");
			return;
		}

		try {
			await room.send("edit:token", {
				action: "create",
				token: ship.sourceShip,
				faction: "PLAYER",
				position: { x: cursorPosition.x, y: cursorPosition.y },
			});
			notify.success(`已部署 ${ship.name} 到 (${Math.round(cursorPosition.x)}, ${Math.round(cursorPosition.y)})`);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "部署失败");
		}
	};

	return (
		<Flex direction="column" gap="3" className="hangar-panel">
			<Flex gap="2" wrap="wrap">
				<TextField.Root
					size="1"
					value={searchQuery}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
					placeholder="搜索舰船..."
					style={{ flex: 1, minWidth: "150px" }}
				>
					<TextField.Slot>
						<Search size={14} />
					</TextField.Slot>
				</TextField.Root>

				<Select.Root value={filterFaction} onValueChange={setFilterFaction}>
					<Select.Trigger>
						<Flex align="center" gap="1">
							<Filter size={14} />
							{filterFaction === "all" ? "全部" : filterFaction === "player" ? "己方" : filterFaction}
						</Flex>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">全部</Select.Item>
						<Select.Item value="player">己方</Select.Item>
						<Select.Item value="neutral">中立</Select.Item>
						<Select.Item value="enemy">敌方</Select.Item>
					</Select.Content>
				</Select.Root>
			</Flex>

			{hangarLoading ? (
				<Text color="gray" size="2">加载中...</Text>
			) : filteredShips.length === 0 ? (
				<Box className="radix-empty-state">
					<Text size="2">暂无舰船</Text>
					<Text color="gray" size="1">{searchQuery ? "尝试修改搜索条件" : "请先创建舰船配置"}</Text>
				</Box>
			) : (
				<Grid columns={{ initial: "1", sm: "2" }} gap="2">
					{filteredShips.map((ship) => (
						<Card key={ship.id} variant="surface" size="1">
							<Flex direction="column" gap="2">
								<Flex justify="between" align="start">
									<Box>
										<Text size="2" weight="bold">{ship.name}</Text>
										<Text size="1" color="gray">{ship.type}</Text>
									</Box>
									<Badge color={ship.faction === "player" ? "green" : ship.faction === "neutral" ? "amber" : "red"} variant="soft">
										{ship.faction === "player" ? "己方" : ship.faction === "neutral" ? "中立" : "敌方"}
									</Badge>
								</Flex>

								<Flex gap="2" wrap="wrap">
									<Badge variant="outline">HP: {ship.hull}/{ship.hullMax}</Badge>
									<Badge variant="outline">护盾: {ship.shield}</Badge>
									<Badge variant="outline">辐能: {ship.fluxCapacity}</Badge>
								</Flex>

								{ship.weapons.length > 0 && (
									<Flex gap="1" wrap="wrap">
										{ship.weapons.slice(0, 3).map((w, i) => (
											<Text key={i} size="1" color="gray">• {w}</Text>
										))}
										{ship.weapons.length > 3 && (
											<Text size="1" color="gray">+{ship.weapons.length - 3}</Text>
										)}
									</Flex>
								)}

								<Flex justify="between" align="center" gap="2" wrap="wrap">
									<Button
										size="1"
										onClick={(e: React.MouseEvent) => {
											e.stopPropagation();
											handleDeploy(ship);
										}}
										disabled={!isHost}
									>
										<Rocket size={14} /> 部署
									</Button>
									<Text size="1" color="gray">
										<Target size={12} /> ({Math.round(cursorPosition.x)}, {Math.round(cursorPosition.y)})
									</Text>
								</Flex>
							</Flex>
						</Card>
					))}
				</Grid>
			)}

			<Flex justify="between" wrap="wrap" gap="2">
				<Text size="1" color="gray">显示 {filteredShips.length} / {userShips.length} 艘舰船</Text>
				{!isHost && <Text size="1" color="amber">仅房主可部署</Text>}
			</Flex>
		</Flex>
	);
};

export default HangarPanel;