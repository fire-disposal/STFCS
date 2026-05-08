/**
 * FactionCustomizerDialog - 派系工坊
 * 浏览全局派系、创建自定义派系（含旗帜裁剪上传 + 取色器 + 旗帜预览）
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, Flex, Text, Button, TextField, Card, ScrollArea } from "@radix-ui/themes";
import { Plus, Trash2, Upload, Pipette, Undo2 } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import type { FactionDef } from "@vt/data";
import { notify } from "@/ui/shared/Notification";
import { useAssetSocket } from "@/hooks/useAssetSocket";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
    playerId: string | null;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

function toDataUrl(mimeType: string, base64: string): string {
    return `data:${mimeType};base64,${base64}`;
}

export const FactionCustomizerDialog: React.FC<Props> = ({ open, onOpenChange, networkManager, playerId }) => {
    const [factions, setFactions] = useState<FactionDef[]>([]);
    const [flagDataUrls, setFlagDataUrls] = useState<Record<string, string>>({});
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#4a9eff");
    const [loading, setLoading] = useState(false);
    const [flagData, setFlagData] = useState<string | null>(null);
    const [flagPreview, setFlagPreview] = useState<string | null>(null);
    const [isPicking, setIsPicking] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const socket = networkManager.getSocket();
    const assetSocket = useAssetSocket(socket);

    // 接线 asset socket 的 response handler
    useEffect(() => {
        if (!socket) return;
        socket.on("response", assetSocket.handleResponse);
        return () => { socket.off("response", assetSocket.handleResponse); };
    }, [socket, assetSocket.handleResponse]);

    /** 批量加载旗帜图片 */
    const loadFlagImages = useCallback(async (list: FactionDef[]) => {
        try {
            const ids = list.filter((f) => f.flagAssetId).map((f) => f.flagAssetId!);
            if (ids.length === 0) return;
            const results = await assetSocket.batchGet(ids, true);
            const urls: Record<string, string> = {};
            for (const item of results) {
                if (item.data && item.info?.mimeType) {
                    urls[item.assetId] = toDataUrl(item.info.mimeType, item.data);
                }
            }
            setFlagDataUrls(urls);
        } catch {}
    }, [assetSocket]);

    const loadFactions = useCallback(async () => {
        try {
            const res = await networkManager.request("faction:list", {}) as { factions: FactionDef[] };
            const list = res.factions ?? [];
            setFactions(list);
            loadFlagImages(list);
        } catch {}
    }, [networkManager, loadFlagImages]);

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
                    setIsPicking(false);
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        } catch { notify.error("图片加载失败"); }
    };

    const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
        if (!isPicking) return;
        const img = imgRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

        const x = Math.floor((e.clientX - rect.left) * (img.naturalWidth / rect.width));
        const y = Math.floor((e.clientY - rect.top) * (img.naturalHeight / rect.height));

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0);
        setNewColor(hex);
        setIsPicking(false);
        notify.success(`已取色 ${hex}`);
    }, [isPicking]);

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
                    自定义旗帜将自动裁剪为正方形，点击"从预览取色"后可在旗帜上点选颜色。
                </Dialog.Description>

                {/* 创建新派系 */}
                <Card style={{ padding: 12, marginBottom: 12 }}>
                    <Text size="1" weight="bold" color="gray" mb="3">创建新派系</Text>

                    {/* 旗帜上传 + 预览 */}
                    <Flex justify="center" mb="2">
                        <div
                            onClick={() => { if (!isPicking) fileRef.current?.click(); }}
                            style={{
                                width: 120, height: 120, borderRadius: 8,
                                border: flagPreview
                                    ? "2px solid rgba(74,158,255,0.3)"
                                    : "2px dashed rgba(74,158,255,0.3)",
                                background: flagPreview ? undefined : "rgba(20,30,45,0.4)",
                                cursor: isPicking ? "crosshair" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, overflow: "hidden",
                            }}
                        >
                            {flagPreview ? (
                                <img
                                    ref={imgRef}
                                    src={flagPreview}
                                    alt="faction-flag"
                                    onClick={isPicking ? handlePreviewClick : undefined}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                />
                            ) : (
                                <Upload size={28} style={{ color: "#4a9eff", opacity: 0.4 }} />
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/png" hidden onChange={handleFlagSelect} />
                    </Flex>

                    {/* 取色按钮 */}
                    <Flex justify="center" gap="2" mb="2">
                        {flagPreview && (
                            isPicking ? (
                                <Button size="1" variant="solid" onClick={() => setIsPicking(false)} data-magnetic>
                                    <Undo2 size={12} /> 退出取色
                                </Button>
                            ) : (
                                <Button size="1" variant="soft" onClick={() => setIsPicking(true)} data-magnetic>
                                    <Pipette size={12} /> 从预览取色
                                </Button>
                            )
                        )}
                        {isPicking && (
                            <Text size="1" color="gray" style={{ lineHeight: "24px" }}>
                                点击预览图中的颜色
                            </Text>
                        )}
                    </Flex>

                    {/* 名称 + 颜色输入 */}
                    <Flex direction="column" gap="2">
                        <TextField.Root size="1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="派系名称" style={{ maxWidth: 200 }} />
                        <Flex gap="2" align="center">
                            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                                style={{ width: 36, height: 28, border: "1px solid #2a3440", borderRadius: 4, cursor: "pointer", background: "transparent", padding: 2 }} />
                            <TextField.Root size="1" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 110, fontFamily: "Fira Code, monospace", fontSize: 12 }} />
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
                        {factions.map((f) => {
                            const flagUrl = f.flagAssetId ? flagDataUrls[f.flagAssetId] : undefined;
                            return (
                                <Flex key={f.$id} align="center" gap="2" style={{
                                    padding: "6px 10px", borderRadius: 6,
                                    background: "rgba(20,30,45,0.4)",
                                    border: "1px solid rgba(74,158,255,0.08)",
                                }}>
                                    {/* 旗帜图片或色块 */}
                                    <span style={{
                                        width: 28, height: 28, borderRadius: 4,
                                        background: flagUrl
                                            ? `url(${flagUrl}) center/cover`
                                            : f.color,
                                        flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: 700,
                                        color: flagUrl ? "transparent" : "rgba(255,255,255,0.85)",
                                        overflow: "hidden",
                                    }}>
                                        {flagUrl ? undefined : f.name.charAt(0)}
                                    </span>
                                    <Text size="1" style={{ flex: 1 }}>{f.name}</Text>
                                    <Text size="1" color="gray">{f.$id.startsWith("preset:") ? "预设" : "自定义"}</Text>
                                    {!f.$id.startsWith("preset:") && f.ownerId === playerId && (
                                        <Button size="1" variant="soft" color="red" onClick={() => handleDelete(f.$id)} disabled={loading}>
                                            <Trash2 size={10} />
                                        </Button>
                                    )}
                                </Flex>
                            );
                        })}
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
