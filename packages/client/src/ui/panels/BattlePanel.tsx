/**
 * 底部战斗面板 - 主容器组件
 * 类文件夹设计，支持动态加载子面板
 */

import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Box, Flex, IconButton, ScrollArea, Tabs, Text, Tooltip } from "@radix-ui/themes";
import "./battle-panel-radix.css";

export interface TabConfig {
    id: string;
    label: string;
    icon?: React.ReactNode;
    component: React.ReactNode;
    enabled?: boolean;
}

export interface BattlePanelProps {
    tabs: TabConfig[];
    defaultActiveTab?: string;
    collapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
}

export const BattlePanel: React.FC<BattlePanelProps> = ({
    tabs,
    defaultActiveTab,
    collapsed: externalCollapsed,
    onCollapseChange,
}) => {
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState(defaultActiveTab || (tabs[0]?.id || ""));

    const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

    const handleCollapseToggle = () => {
        const newCollapsed = !collapsed;
        if (externalCollapsed === undefined) {
            setInternalCollapsed(newCollapsed);
        }
        onCollapseChange?.(newCollapsed);
    };

    // 过滤启用的标签
    const enabledTabs = tabs.filter(tab => tab.enabled !== false);
    const safeActiveTab = enabledTabs.some((tab) => tab.id === activeTab) ? activeTab : (enabledTabs[0]?.id || "");

    return (
        <Box className={`rbp-shell ${collapsed ? "rbp-shell--collapsed" : "rbp-shell--expanded"}`}>
            <Tabs.Root value={safeActiveTab} onValueChange={setActiveTab}>
                <Flex className="rbp-header" align="center" gap="2">
                    <Tooltip content={collapsed ? "展开战斗面板" : "折叠面板"}>
                        <IconButton variant="soft" size="1" onClick={handleCollapseToggle}>
                            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </IconButton>
                    </Tooltip>

                    {collapsed ? (
                        <Flex className="rbp-collapsed-bar" align="center" gap="2">
                            <Text size="1">战斗面板</Text>
                        </Flex>
                    ) : (
                        <ScrollArea type="hover" scrollbars="horizontal" className="rbp-tabs-scroll">
                            <Tabs.List className="rbp-tabs-list">
                                {enabledTabs.map((tab) => (
                                    <Tabs.Trigger key={tab.id} value={tab.id}>
                                        <Flex align="center" gap="2">
                                            {tab.icon}
                                            <Text size="1">{tab.label}</Text>
                                        </Flex>
                                    </Tabs.Trigger>
                                ))}
                            </Tabs.List>
                        </ScrollArea>
                    )}
                </Flex>

                <ScrollArea
                    type="always"
                    scrollbars="vertical"
                    className={`rbp-content-scroll ${collapsed ? "rbp-content-scroll--hidden" : ""}`}
                >
                    <Box className="rbp-content">
                        {enabledTabs.find((tab) => tab.id === safeActiveTab)?.component || (
                            <Flex align="center" justify="center" className="rbp-empty">
                                <Text color="gray">请选择一个标签</Text>
                            </Flex>
                        )}
                    </Box>
                </ScrollArea>
            </Tabs.Root>
        </Box>
    );
};

export default BattlePanel;