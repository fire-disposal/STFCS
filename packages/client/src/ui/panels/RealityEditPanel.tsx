/**
 * 现实修改面板 - Radix 版本
 */

import React, { useEffect, useState } from "react";
import { Edit, Eye, EyeOff, RotateCcw, Save } from "lucide-react";
import { Badge, Box, Button, Flex, Grid, Switch, Tabs, Text, TextArea, TextField } from "@radix-ui/themes";
import type { ShipViewModel } from "@/renderer";
import type { TokenRuntime } from "@vt/data";

export interface RealityEditPanelProps {
    ship: ShipViewModel | null;
    onSubmit: (shipId: string, runtimeData: Partial<TokenRuntime>) => void;
}

export const RealityEditPanel: React.FC<RealityEditPanelProps> = ({ ship, onSubmit }) => {
    const [editMode, setEditMode] = useState(false);
    const [editorMode, setEditorMode] = useState<"form" | "json">("form");
    const [runtimeData, setRuntimeData] = useState<Partial<TokenRuntime>>({});
    const [rawJson, setRawJson] = useState("");

    const snapshotFromShip = (s: ShipViewModel): Partial<TokenRuntime> => ({
        position: s.runtime?.position || { x: 0, y: 0 },
        heading: s.runtime?.heading || 0,
        hull: s.runtime?.hull || 0,
        fluxSoft: s.runtime?.fluxSoft || 0,
        fluxHard: s.runtime?.fluxHard || 0,
        shield: s.runtime?.shield
            ? {
                active: s.runtime.shield.active,
                value: s.runtime.shield.value,
            }
            : undefined,
        overloaded: s.runtime?.overloaded || false,
        venting: s.runtime?.venting || false,
        faction: s.runtime?.faction,
        ownerId: s.runtime?.ownerId,
    });

    useEffect(() => {
        if (!ship) {
            setRuntimeData({});
            setRawJson("");
            return;
        }
        const next = snapshotFromShip(ship);
        setRuntimeData(next);
        setRawJson(JSON.stringify(next, null, 2));
    }, [ship]);

    const handleFieldChange = (field: keyof TokenRuntime, value: unknown) => {
        setRuntimeData((prev: Partial<TokenRuntime>) => {
            const next = { ...prev, [field]: value };
            setRawJson(JSON.stringify(next, null, 2));
            return next;
        });
    };

    const handleReset = () => {
        if (!ship) return;
        const next = snapshotFromShip(ship);
        setRuntimeData(next);
        setRawJson(JSON.stringify(next, null, 2));
    };

    const handleSubmit = () => {
        if (!ship) return;
        try {
            const payload = editorMode === "json" ? JSON.parse(rawJson) : runtimeData;
            onSubmit(ship.id, payload);
            setEditMode(false);
        } catch {
            alert("数据格式错误，请检查 JSON 格式");
        }
    };

    if (!ship) {
        return (
            <Flex direction="column" align="center" justify="center" className="rbp-empty-state" gap="2">
                <Text size="7">📝</Text>
                <Text size="3">未选择舰船</Text>
                <Text size="2" color="gray">选择舰船以编辑其运行时数据</Text>
            </Flex>
        );
    }

    return (
        <Flex direction="column" gap="3">
            <Flex align="center" justify="between" wrap="wrap" gap="2">
                <Flex align="center" gap="2">
                    <Edit size={16} />
                    <Text size="2">现实修改 - {ship.id.slice(-6)}</Text>
                    <Badge variant="soft" color={editMode ? "amber" : "gray"}>{editMode ? "编辑中" : "只读"}</Badge>
                </Flex>
                <Flex gap="2">
                    <Button variant="soft" size="1" onClick={() => setEditMode((v) => !v)}>
                        <Edit size={14} /> {editMode ? "取消" : "编辑"}
                    </Button>
                </Flex>
            </Flex>

            <Tabs.Root value={editorMode} onValueChange={(v) => setEditorMode(v as "form" | "json")}>
                <Tabs.List>
                    <Tabs.Trigger value="form"><EyeOff size={14} /> 表单</Tabs.Trigger>
                    <Tabs.Trigger value="json"><Eye size={14} /> JSON</Tabs.Trigger>
                </Tabs.List>

                <Box mt="3">
                    {editorMode === "json" ? (
                        <TextArea
                            value={rawJson}
                            onChange={(e) => {
                                setRawJson(e.target.value);
                                try {
                                    setRuntimeData(JSON.parse(e.target.value));
                                } catch {
                                    /* ignore */
                                }
                            }}
                            rows={14}
                            readOnly={!editMode}
                        />
                    ) : (
                        <Flex direction="column" gap="3">
                            <Grid columns={{ initial: "1", md: "3" }} gap="2">
                                <TextField.Root
                                    type="number"
                                    value={String(runtimeData.position?.x || 0)}
                                    onChange={(e) => handleFieldChange("position", { ...runtimeData.position, x: Number(e.target.value) || 0 })}
                                    disabled={!editMode}
                                    placeholder="X坐标"
                                />
                                <TextField.Root
                                    type="number"
                                    value={String(runtimeData.position?.y || 0)}
                                    onChange={(e) => handleFieldChange("position", { ...runtimeData.position, y: Number(e.target.value) || 0 })}
                                    disabled={!editMode}
                                    placeholder="Y坐标"
                                />
                                <TextField.Root
                                    type="number"
                                    value={String(runtimeData.heading || 0)}
                                    onChange={(e) => handleFieldChange("heading", Number(e.target.value) || 0)}
                                    disabled={!editMode}
                                    placeholder="航向"
                                />
                            </Grid>

                            <Grid columns={{ initial: "1", md: "3" }} gap="2">
                                <TextField.Root
                                    type="number"
                                    value={String(runtimeData.hull || 0)}
                                    onChange={(e) => handleFieldChange("hull", Number(e.target.value) || 0)}
                                    disabled={!editMode}
                                    placeholder="船体"
                                />
                                <TextField.Root
                                    type="number"
                                    value={String(runtimeData.fluxSoft || 0)}
                                    onChange={(e) => handleFieldChange("fluxSoft", Number(e.target.value) || 0)}
                                    disabled={!editMode}
                                    placeholder="软通量"
                                />
                                <TextField.Root
                                    type="number"
                                    value={String(runtimeData.fluxHard || 0)}
                                    onChange={(e) => handleFieldChange("fluxHard", Number(e.target.value) || 0)}
                                    disabled={!editMode}
                                    placeholder="硬通量"
                                />
                            </Grid>

                            <Flex gap="4" wrap="wrap" align="center">
                                <Flex align="center" gap="2">
                                    <Switch checked={!!runtimeData.overloaded} onCheckedChange={(v) => handleFieldChange("overloaded", v)} disabled={!editMode} />
                                    <Text size="2">过载</Text>
                                </Flex>
                                <Flex align="center" gap="2">
                                    <Switch checked={!!runtimeData.venting} onCheckedChange={(v) => handleFieldChange("venting", v)} disabled={!editMode} />
                                    <Text size="2">辐散中</Text>
                                </Flex>
                            </Flex>
                        </Flex>
                    )}
                </Box>
            </Tabs.Root>

            {editMode ? (
                <Flex justify="end" gap="2">
                    <Button variant="soft" color="gray" onClick={handleReset}><RotateCcw size={14} /> 重置</Button>
                    <Button onClick={handleSubmit}><Save size={14} /> 提交修改</Button>
                </Flex>
            ) : (
                <Text size="1" color="gray">点击“编辑”开始修改数据</Text>
            )}
        </Flex>
    );
};

export default RealityEditPanel;