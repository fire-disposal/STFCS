/**
 * CombatLogPlaceholder - 战斗日志占位组件
 *
 * 预留位置，未来实现战斗日志功能
 */

import React from "react";
import { FileText, Construction } from "lucide-react";
import { Flex, Text, Box, Badge } from "@radix-ui/themes";

export const CombatLogPlaceholder: React.FC = () => {
	return (
		<Flex
			direction="column"
			align="center"
			justify="center"
			gap="3"
			className="sidebar-panel-content"
			style={{ height: "100%", minHeight: 200 }}
		>
			<Box style={{ opacity: 0.5 }}>
				<FileText size={32} style={{ color: "#6b8aaa" }} />
			</Box>
			<Text size="2" weight="bold" style={{ color: "#6b8aaa" }}>
				战斗日志
			</Text>
			<Badge size="1" color="gray" variant="soft">
				<Construction size={12} />
				开发中
			</Badge>
			<Text size="1" style={{ color: "#4a5568", textAlign: "center", maxWidth: 180 }}>
				记录回合内所有行动和战斗结果，支持回放和过滤
			</Text>
		</Flex>
	);
};

export default CombatLogPlaceholder;