/**
 * FactionCustomizerDialog - 派系工坊
 * 所有玩家可浏览全局派系、创建自定义派系、删除自己创建的派系
 */

import React, { useEffect, useState, useCallback } from "react";
import { Dialog, Flex, Text, Button, TextField, Card, Badge, ScrollArea } from "@radix-ui/themes";
import { Plus, Trash2 } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import type { FactionDef } from "@vt/data";
import { notify } from "@/ui/shared/Notification";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
    playerId: string | null;
}

export const FactionCustomizerDialog: React.FC<Props> = ({ open, onOpenChange, networkManager, playerId }) => {
    const [factions, setFactions] = useState<FactionDef[]>([]);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#4a9eff");
    const [loading, setLoading] = useState(false);

    const loadFactions = useCallback(async () => {
        try {
            const res = await networkManager.request("faction:list", {}) as { factions: FactionDef[] };
            setFactions(res.factions ?? []);
        } catch { /* ignore */ }
    }, [networkManager]);

    useEffect(() => { if (open) loadFactions(); }, [open, loadFactions]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await networkManager.request("edit:faction:create", { name: newName.trim(), color: newColor });
            notify.success("派系已创建");
            setNewName("");
            loadFactions();
        } catch (e: any) {
            notify.error(e?.message ?? "创建失败");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (factionId: string) => {
        setLoading(true);
        try {
            await networkManager.request("edit:faction:delete", { factionId });
            notify.success("派系已删除");
            loadFactions();
        } catch (e: any) {
            notify.error(e?.message ?? "删除失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Content style={{ maxWidth: 500, maxHeight: "80vh" }}>
                <Dialog.Title>派系工坊</Dialog.Title>
                <Dialog.Description size="1" color="gray" mb="3">
                    浏览和创建全局派系。预设派系不可删除，自定义派系仅创建者可删除。
                </Dialog.Description>

                {/* 创建新派系 */}
                <Card style={{ padding: "10px 12px", marginBottom: 12 }}>
                    <Text size="1" weight="bold" mb="2" color="gray">创建新派系</Text>
                    <Flex gap="2" align="end" wrap="wrap">
                        <label>
                            <Text size="1" color="gray">名称</Text>
                            <TextField.Root size="1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="派系名称" style={{ width: 140 }} />
                        </label>
                        <label>
                            <Text size="1" color="gray">颜色</Text>
                            <Flex gap="1" align="center">
                                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 32, height: 28, border: "none", cursor: "pointer" }} />
                                <TextField.Root size="1" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 80 }} />
                            </Flex>
                        </label>
                        <Button size="1" onClick={handleCreate} disabled={loading || !newName.trim()}>
                            <Plus size={12} /> 创建
                        </Button>
                    </Flex>
                </Card>

                {/* 派系列表 */}
                <ScrollArea style={{ maxHeight: 400 }}>
                    <Flex direction="column" gap="1">
                        {factions.map((f) => (
                            <Flex key={f.$id} align="center" gap="2" style={{
                                padding: "6px 10px", borderRadius: 6,
                                background: "rgba(20, 30, 45, 0.4)",
                                border: "1px solid rgba(74, 158, 255, 0.08)",
                            }}>
                                <span style={{ width: 20, height: 20, borderRadius: 4, background: f.color, flexShrink: 0 }} />
                                <Text size="1" style={{ flex: 1 }}>{f.name}</Text>
                                <Text size="1" color="gray">{f.$id.startsWith("preset:") ? "预设" : "自定义"}</Text>
                                {!f.$id.startsWith("preset:") && f.ownerId === playerId && (
                                    <Button size="1" variant="soft" color="red" onClick={() => handleDelete(f.$id)} disabled={loading}>
                                        <Trash2 size={10} />
                                    </Button>
                                )}
                            </Flex>
                        ))}
                        {factions.length === 0 && (
                            <Text size="1" color="gray" align="center" mt="4">暂无派系</Text>
                        )}
                    </Flex>
                </ScrollArea>

                <Flex justify="end" mt="3">
                    <Dialog.Close>
                        <Button variant="soft" size="1">关闭</Button>
                    </Dialog.Close>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default FactionCustomizerDialog;
