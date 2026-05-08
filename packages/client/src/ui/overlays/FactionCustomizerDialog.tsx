/**
 * FactionCustomizerDialog - 派系工坊
 * 支持旗帜上传（方形裁剪 + 预览）和全局派系管理
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, Flex, Text, Button, TextField, Card, ScrollArea } from "@radix-ui/themes";
import { Plus, Trash2, Upload } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import type { FactionDef } from "@vt/data";
import { notify } from "@/ui/shared/Notification";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
    playerId: string | null;
}

/** Canvas 裁剪：取图像中心正方形区域，缩放至 64×64 */
function cropSquareFromImage(img: HTMLImageElement, size: number): string | null {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/png");
}

/** File → data URL */
function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/** data URL → Blob → base64 buffer string (no prefix) */
function dataUrlToBase64(dataUrl: string): string {
    const comma = dataUrl.indexOf(",");
    return dataUrl.slice(comma + 1);
}

export const FactionCustomizerDialog: React.FC<Props> = ({ open, onOpenChange, networkManager, playerId }) => {
    const [factions, setFactions] = useState<FactionDef[]>([]);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#4a9eff");
    const [loading, setLoading] = useState(false);

    // flag upload state
    const [flagPreview, setFlagPreview] = useState<string | null>(null);
    const [flagBase64, setFlagBase64] = useState<string | null>(null); // cropped result
    const fileRef = useRef<HTMLInputElement>(null);

    const loadFactions = useCallback(async () => {
        try {
            const res = await networkManager.request("faction:list", {}) as { factions: FactionDef[] };
            setFactions(res.factions ?? []);
        } catch { /* ignore */ }
    }, [networkManager]);

    useEffect(() => { if (open) loadFactions(); }, [open, loadFactions]);

    const handleFlagSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await fileToDataUrl(file);
            const img = new Image();
            img.onload = () => {
                // 方形裁剪 128×128
                const cropped = cropSquareFromImage(img, 128);
                setFlagPreview(cropped);
                setFlagBase64(cropped ? dataUrlToBase64(cropped) : null);
            };
            img.src = dataUrl;
        } catch {
            notify.error("图片加载失败");
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            let flagAssetId: string | undefined;

            // 先上传旗帜
            if (flagBase64) {
                try {
                    const uploadRes = await networkManager.request("asset:upload", {
                        type: "faction_flag",
                        filename: `${newName.trim()}_flag.png`,
                        mimeType: "image/png",
                        data: flagBase64,
                    } as any) as { assetId?: string };
                    flagAssetId = uploadRes?.assetId;
                } catch {
                    // flag upload optional
                }
            }

            await networkManager.request("edit:faction:create", {
                name: newName.trim(),
                color: newColor,
                flagAssetId,
            });

            notify.success("派系已创建");
            setNewName("");
            setFlagPreview(null);
            setFlagBase64(null);
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
            <Dialog.Content style={{ maxWidth: 520, maxHeight: "80vh" }}>
                <Dialog.Title>派系工坊</Dialog.Title>
                <Dialog.Description size="1" color="gray" mb="3">
                    浏览和创建全局派系。上传旗帜将自动裁剪为正方形。
                </Dialog.Description>

                {/* 创建新派系 */}
                <Card style={{ padding: "10px 12px", marginBottom: 12 }}>
                    <Text size="1" weight="bold" mb="2" color="gray">创建新派系</Text>
                    <Flex gap="2" wrap="wrap" align="start">
                        {/* 旗帜上传预览 */}
                        <Flex direction="column" align="center" gap="1">
                            <div
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    width: 64, height: 64, borderRadius: 6,
                                    border: "1px dashed rgba(74,158,255,0.3)",
                                    background: flagPreview ? `url(${flagPreview}) center/cover` : "rgba(20,30,45,0.5)",
                                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {!flagPreview && <Upload size={18} style={{ color: "#4a9eff", opacity: 0.6 }} />}
                            </div>
                            <input ref={fileRef} type="file" accept="image/png" hidden onChange={handleFlagSelect} />
                            <Text size="1" color="gray">旗帜</Text>
                        </Flex>

                        <Flex direction="column" gap="2" style={{ flex: 1, minWidth: 200 }}>
                            <label>
                                <Text size="1" color="gray">名称</Text>
                                <TextField.Root size="1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="派系名称" style={{ width: "100%" }} />
                            </label>
                            <label>
                                <Text size="1" color="gray">颜色</Text>
                                <Flex gap="1" align="center">
                                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 32, height: 28, border: "none", cursor: "pointer", background: "transparent" }} />
                                    <TextField.Root size="1" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 90 }} />
                                </Flex>
                            </label>
                        </Flex>
                    </Flex>
                    <Flex justify="end" mt="2">
                        <Button size="1" onClick={handleCreate} disabled={loading || !newName.trim()}>
                            <Plus size={12} /> 创建
                        </Button>
                    </Flex>
                </Card>

                {/* 派系列表 */}
                <ScrollArea style={{ maxHeight: 320 }}>
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
