/**
 * FactionCustomizerDialog - 派系工坊
 * 浏览全局派系、创建自定义派系（含旗帜裁剪上传 + 取色器）
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, Flex, Text, Button, TextField, Card, ScrollArea } from "@radix-ui/themes";
import { Plus, Trash2, Upload, Pipette } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import type { FactionDef } from "@vt/data";
import { notify } from "@/ui/shared/Notification";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
    playerId: string | null;
}

function cropSquareFromImage(img: HTMLImageElement, size: number): string | null {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/png");
}

function rgbToHex(r: number, g: number, b: number) {
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

export const FactionCustomizerDialog: React.FC<Props> = ({ open, onOpenChange, networkManager, playerId }) => {
    const [factions, setFactions] = useState<FactionDef[]>([]);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#4a9eff");
    const [loading, setLoading] = useState(false);
    const [flagData, setFlagData] = useState<string | null>(null);
    const [flagPreview, setFlagPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const loadFactions = useCallback(async () => {
        try {
            const res = await networkManager.request("faction:list", {}) as { factions: FactionDef[] };
            setFactions(res.factions ?? []);
        } catch {}
    }, [networkManager]);

    useEffect(() => { if (open) loadFactions(); }, [open, loadFactions]);

    const handleFlagSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const cropped = cropSquareFromImage(img, 128);
                    setFlagPreview(cropped);
                    setFlagData(cropped ? cropped.split(",")[1] : null);
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        } catch { notify.error("图片加载失败"); }
    };

    /** 点击旗帜预览取色 */
    const handlePickColor = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!flagPreview || !previewRef.current) return;
        const rect = previewRef.current.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * 128);
        const y = Math.round((e.clientY - rect.top) / rect.height * 128);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
            setNewColor(rgbToHex(r, g, b));
        };
        img.src = flagPreview;
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await networkManager.request("edit:faction:create", {
                name: newName.trim(),
                color: newColor,
                flagData: flagData ?? undefined,
            } as any);
            notify.success("派系已创建");
            setNewName("");
            setNewColor("#4a9eff");
            setFlagData(null);
            setFlagPreview(null);
            loadFactions();
        } catch (e: any) {
            notify.error(e?.message ?? "创建失败");
        } finally { setLoading(false); }
    };

    const handleDelete = async (fid: string) => {
        setLoading(true);
        try {
            await networkManager.request("edit:faction:delete", { factionId: fid });
            notify.success("派系已删除");
            loadFactions();
        } catch (e: any) { notify.error(e?.message ?? "删除失败"); }
        finally { setLoading(false); }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Content style={{ maxWidth: 460, maxHeight: "85vh" }}>
                <Dialog.Title>派系工坊</Dialog.Title>
                <Dialog.Description size="1" color="gray" mb="3">
                    旗帜图片将自动裁剪为正方形，点击旗帜可吸取颜色。
                </Dialog.Description>

                {/* 创建新派系 */}
                <Card style={{ padding: 12, marginBottom: 12 }}>
                    <Text size="1" weight="bold" color="gray" mb="3">创建新派系</Text>

                    {/* 旗帜上传区 */}
                    <Flex justify="center" mb="2">
                        <div
                            ref={previewRef}
                            onClick={() => fileRef.current?.click()}
                            title="点击上传，右键取色"
                            style={{
                                width: 100, height: 100, borderRadius: 8,
                                border: flagPreview ? "2px solid rgba(74,158,255,0.3)" : "2px dashed rgba(74,158,255,0.3)",
                                background: flagPreview ? `url(${flagPreview}) center/cover` : "rgba(20,30,45,0.4)",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                                position: "relative",
                            }}
                        >
                            {!flagPreview && <Upload size={24} style={{ color: "#4a9eff", opacity: 0.5 }} />}
                            {flagPreview && (
                                <div style={{
                                    position: "absolute", bottom: 2, right: 2,
                                    background: "rgba(0,0,0,0.6)", borderRadius: 4,
                                    padding: "2px 6px", fontSize: 10,
                                    color: "#aaccff",
                                    pointerEvents: "none",
                                }}>
                                    <Pipette size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />
                                    取色
                                </div>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/png" hidden onChange={handleFlagSelect} />
                    </Flex>

                    {/* 名称 + 颜色输入 */}
                    <Flex direction="column" gap="2">
                        <TextField.Root size="1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="派系名称" />
                        <Flex gap="2" align="center">
                            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                                style={{ width: 36, height: 28, border: "1px solid #2a3440", borderRadius: 4, cursor: "pointer", background: "transparent", padding: 2 }} />
                            <TextField.Root size="1" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ flex: 1, fontFamily: "Fira Code, monospace", fontSize: 12 }} />
                        </Flex>
                    </Flex>

                    <Flex justify="end" mt="3">
                        <Button size="1" onClick={handleCreate} disabled={loading || !newName.trim()}>
                            <Plus size={12} /> 创建
                        </Button>
                    </Flex>
                </Card>

                {/* 派系列表 */}
                <ScrollArea style={{ maxHeight: 280 }}>
                    <Flex direction="column" gap="1">
                        {factions.map((f) => (
                            <Flex key={f.$id} align="center" gap="2" style={{
                                padding: "6px 10px", borderRadius: 6,
                                background: "rgba(20,30,45,0.4)",
                                border: "1px solid rgba(74,158,255,0.08)",
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
                        {factions.length === 0 && <Text size="1" color="gray" align="center" mt="4">暂无派系</Text>}
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
