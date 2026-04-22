import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Badge,
    Box,
    Button,
    Card,
    Dialog,
    Flex,
    Grid,
    Select,
    Separator,
    Tabs,
    Text,
    TextArea,
    TextField,
} from "@radix-ui/themes";
import {
    DamageType,
    HullSize,
    ShipClass,
    WeaponSlotSize,
    WeaponTag,
    isWeaponSizeCompatible,
    type InventoryToken,
    type WeaponJSON,
    type Texture,
} from "@vt/data";
import { Plus, Save, Upload, Copy, ShieldCheck, Trash2 } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import { notify } from "@/ui/shared/Notification";
import { useAssetSocket } from "@/hooks/useAssetSocket";
import MiniShipPreview from "./MiniShipPreview";
import MiniWeaponPreview from "./MiniWeaponPreview";
import "./ship-customization-modal.css";

interface LoadoutCustomizerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
}

interface AssetInfo {
    $id: string;
    filename: string;
    mimeType: string;
    data?: string;
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function ensureShipDefaults(token: InventoryToken): InventoryToken {
    const next = clone(token);
    next.spec.mounts = next.spec.mounts ?? [];
    next.metadata = next.metadata ?? { name: next.$id };
    next.spec.texture = next.spec.texture ?? {};
    return next;
}

function ensureWeaponDefaults(weapon: WeaponJSON): WeaponJSON {
    const next = clone(weapon);
    next.metadata = next.metadata ?? { name: next.$id };
    next.spec.tags = next.spec.tags ?? [];
    return next;
}

function toDataUrl(mimeType: string, base64: string): string {
    return `data:${mimeType};base64,${base64}`;
}

function shortId(id: string): string {
    if (id.startsWith("preset:")) return id.slice(7);
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

async function convertToPng(sourceFile: File, applyKeyColor?: { color: string; tolerance: number }): Promise<File> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(sourceFile);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("图片解码失败"));
        el.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");

    ctx.drawImage(img, 0, 0);

    if (applyKeyColor && applyKeyColor.tolerance > 0) {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const { data } = imageData;

        const hex = applyKeyColor.color.replace("#", "");
        const targetR = Number.parseInt(hex.slice(0, 2), 16);
        const targetG = Number.parseInt(hex.slice(2, 4), 16);
        const targetB = Number.parseInt(hex.slice(4, 6), 16);

        for (let i = 0; i < data.length; i += 4) {
            const dr = Math.abs(data[i] - targetR);
            const dg = Math.abs(data[i + 1] - targetG);
            const db = Math.abs(data[i + 2] - targetB);
            if (dr <= applyKeyColor.tolerance && dg <= applyKeyColor.tolerance && db <= applyKeyColor.tolerance) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
            if (!b) {
                reject(new Error("无法导出图像"));
                return;
            }
            resolve(b);
        }, "image/png");
    });

    const baseName = sourceFile.name.replace(/\.[^.]+$/, "");
    const suffix = applyKeyColor ? "-colorkey" : "";
    return new File([blob], `${baseName}${suffix}.png`, { type: "image/png" });
}

interface CustomizeTokenListResponse {
    ships: InventoryToken[];
}

interface CustomizeWeaponListResponse {
    weapons: WeaponJSON[];
}

interface PresetListTokensResponse {
    presets: InventoryToken[];
}

interface PresetListWeaponsResponse {
    presets: WeaponJSON[];
}

export const LoadoutCustomizerDialog: React.FC<LoadoutCustomizerDialogProps> = ({ open, onOpenChange, networkManager }) => {
    const socket = networkManager.getSocket();
    const assetSocket = useAssetSocket(socket);
    const shipTextureInputRef = useRef<HTMLInputElement>(null);
    const weaponTextureInputRef = useRef<HTMLInputElement>(null);

    const [activeTopTab, setActiveTopTab] = useState<"ship" | "weapon">("ship");

    const [shipBuilds, setShipBuilds] = useState<InventoryToken[]>([]);
    const [weaponBuilds, setWeaponBuilds] = useState<WeaponJSON[]>([]);
    const [shipPresets, setShipPresets] = useState<InventoryToken[]>([]);
    const [weaponPresets, setWeaponPresets] = useState<WeaponJSON[]>([]);

    const [selectedShipBuildId, setSelectedShipBuildId] = useState<string | null>(null);
    const [selectedWeaponBuildId, setSelectedWeaponBuildId] = useState<string | null>(null);
    const [shipDraft, setShipDraft] = useState<InventoryToken | null>(null);
    const [weaponDraft, setWeaponDraft] = useState<WeaponJSON | null>(null);
    const [shipRawJson, setShipRawJson] = useState("");
    const [weaponRawJson, setWeaponRawJson] = useState("");
    const [editorTab, setEditorTab] = useState<"form" | "json">("form");

    const [shipPreviewZoom, setShipPreviewZoom] = useState(1);
    const [shipTextureAssets, setShipTextureAssets] = useState<AssetInfo[]>([]);
    const [weaponTextureAssets, setWeaponTextureAssets] = useState<AssetInfo[]>([]);
    const [texturePreviewUrl, setTexturePreviewUrl] = useState<string | null>(null);
    const [weaponTexturePreviewUrl, setWeaponTexturePreviewUrl] = useState<string | null>(null);

    const [keyColor, setKeyColor] = useState("#000000");
    const [keyTolerance, setKeyTolerance] = useState(12);

    const [mountSelection, setMountSelection] = useState<string>("");
    const [loadError, setLoadError] = useState<string | null>(null);
    const shipBuildsRef = useRef<InventoryToken[]>([]);
    const weaponBuildsRef = useRef<WeaponJSON[]>([]);
    
    shipBuildsRef.current = shipBuilds;
    weaponBuildsRef.current = weaponBuilds;

    useEffect(() => {
        if (!socket) return;
        socket.on("response", assetSocket.handleResponse);
        return () => {
            socket.off("response", assetSocket.handleResponse);
        };
    }, [socket, assetSocket.handleResponse]);

    const reloadAssets = useCallback(async () => {
        if (!socket?.connected) return;
        try {
            const [shipAssets, weaponAssets] = await Promise.all([
                assetSocket.list("ship_texture"),
                assetSocket.list("weapon_texture"),
            ]);
            setShipTextureAssets((shipAssets as AssetInfo[]).sort((a, b) => a.filename.localeCompare(b.filename)));
            setWeaponTextureAssets((weaponAssets as AssetInfo[]).sort((a, b) => a.filename.localeCompare(b.filename)));
        } catch (error) {
            console.error("reloadAssets error:", error);
        }
    }, [socket, assetSocket]);

    const reloadData = useCallback(async () => {
        if (!open) return;
        setLoadError(null);

        try {
            const sock = networkManager.getSocket();
            if (!sock?.connected) {
                throw new Error("网络未连接");
            }

            const responses = await Promise.all([
                networkManager.send("customize:token", { action: "list" }) as Promise<CustomizeTokenListResponse>,
                networkManager.send("customize:weapon", { action: "list" }) as Promise<CustomizeWeaponListResponse>,
                networkManager.send("preset:list_tokens", {}) as Promise<PresetListTokensResponse>,
                networkManager.send("preset:list_weapons", {}) as Promise<PresetListWeaponsResponse>,
            ]);

            const [shipListRes, weaponListRes, shipPresetRes, weaponPresetRes] = responses;

            setShipBuilds(shipListRes.ships ?? []);
            setWeaponBuilds(weaponListRes.weapons ?? []);
            setShipPresets(shipPresetRes.presets ?? []);
            setWeaponPresets(weaponPresetRes.presets ?? []);

            setSelectedShipBuildId((prev) => prev ?? (shipListRes.ships?.[0]?.$id ?? null));
            setSelectedWeaponBuildId((prev) => prev ?? (weaponListRes.weapons?.[0]?.$id ?? null));

            await reloadAssets();
        } catch (error) {
            console.error("reloadData error:", error);
            notify.error(error instanceof Error ? error.message : "加载失败");
            setLoadError(error instanceof Error ? error.message : "加载失败");
        }
    }, [networkManager, open, reloadAssets]);

    useEffect(() => {
        void reloadData();
    }, [reloadData]);

    useEffect(() => {
        const builds = shipBuildsRef.current;
        const selected = builds.find((item) => item.$id === selectedShipBuildId);
        if (!selected) {
            setShipDraft(null);
            setShipRawJson("");
            setTexturePreviewUrl(null);
            return;
        }

        const normalized = ensureShipDefaults(selected);
        setShipDraft(normalized);
        setShipRawJson(JSON.stringify(normalized, null, 2));
        setMountSelection(normalized.spec.mounts?.[0]?.id ?? "");

        if (normalized.spec.texture?.assetId) {
            loadTexturePreview(normalized.spec.texture.assetId);
        } else {
            setTexturePreviewUrl(null);
        }
    }, [selectedShipBuildId]);

    const loadTexturePreview = useCallback(async (assetId: string) => {
        try {
            const results = await assetSocket.batchGet([assetId], true);
            const first = results[0];
            if (first?.data && first?.info?.mimeType) {
                setTexturePreviewUrl(toDataUrl(first.info.mimeType, first.data));
            }
        } catch {
            setTexturePreviewUrl(null);
        }
    }, [assetSocket]);

    const loadWeaponTexturePreview = useCallback(async (assetId: string) => {
        try {
            const results = await assetSocket.batchGet([assetId], true);
            const first = results[0];
            if (first?.data && first?.info?.mimeType) {
                setWeaponTexturePreviewUrl(toDataUrl(first.info.mimeType, first.data));
            }
        } catch {
            setWeaponTexturePreviewUrl(null);
        }
    }, [assetSocket]);

    useEffect(() => {
        const builds = weaponBuildsRef.current;
        const selected = builds.find((item) => item.$id === selectedWeaponBuildId);
        if (!selected) {
            setWeaponDraft(null);
            setWeaponRawJson("");
            return;
        }

        const normalized = ensureWeaponDefaults(selected);
        setWeaponDraft(normalized);
        setWeaponRawJson(JSON.stringify(normalized, null, 2));
    }, [selectedWeaponBuildId]);

    const selectedMount = useMemo(() => {
        if (!shipDraft?.spec.mounts?.length || !mountSelection) return null;
        return shipDraft.spec.mounts.find((item) => item.id === mountSelection) ?? null;
    }, [shipDraft, mountSelection]);

    const compatibleWeapons = useMemo(() => {
        if (!selectedMount) return [];
        return weaponBuilds.filter((item) => {
            return isWeaponSizeCompatible(selectedMount.size, item.spec.size);
        });
    }, [selectedMount, weaponBuilds]);

    const updateShipDraft = useCallback((updater: (draft: InventoryToken) => void) => {
        setShipDraft((prev) => {
            if (!prev) return prev;
            const next = clone(prev);
            updater(next);
            setShipRawJson(JSON.stringify(next, null, 2));
            return next;
        });
    }, []);

    const updateWeaponDraft = useCallback((updater: (draft: WeaponJSON) => void) => {
        setWeaponDraft((prev) => {
            if (!prev) return prev;
            const next = clone(prev);
            updater(next);
            setWeaponRawJson(JSON.stringify(next, null, 2));
            return next;
        });
    }, []);

    const updateShipTexture = useCallback((updates: Partial<Texture>) => {
        updateShipDraft((draft) => {
            draft.spec.texture = { ...draft.spec.texture, ...updates };
        });
    }, [updateShipDraft]);

    const updateWeaponTexture = useCallback((updates: Partial<Texture>) => {
        updateWeaponDraft((draft) => {
            draft.spec.texture = { ...draft.spec.texture, ...updates };
        });
    }, [updateWeaponDraft]);

    const validateShipRaw = useCallback(() => {
        try {
            const parsed = JSON.parse(shipRawJson) as InventoryToken;
            if (!parsed.$id || !parsed.spec) {
                notify.error("舰船 JSON 格式错误");
                return;
            }
            const withDefaults = ensureShipDefaults(parsed);
            setShipDraft(withDefaults);
            setShipRawJson(JSON.stringify(withDefaults, null, 2));
            notify.success("校验通过");
        } catch {
            notify.error("JSON 解析失败");
        }
    }, [shipRawJson]);

    const validateWeaponRaw = useCallback(() => {
        try {
            const parsed = JSON.parse(weaponRawJson) as WeaponJSON;
            if (!parsed.$id || !parsed.spec) {
                notify.error("武器 JSON 格式错误");
                return;
            }
            const withDefaults = ensureWeaponDefaults(parsed);
            setWeaponDraft(withDefaults);
            setWeaponRawJson(JSON.stringify(withDefaults, null, 2));
            notify.success("校验通过");
        } catch {
            notify.error("JSON 解析失败");
        }
    }, [weaponRawJson]);

    const saveShip = useCallback(async () => {
        if (!shipDraft || !selectedShipBuildId) return;
        try {
            await networkManager.send("customize:token", {
                action: "upsert",
                tokenId: selectedShipBuildId,
                token: shipDraft,
            });
            notify.success("已保存");
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "保存失败");
        }
    }, [networkManager, reloadData, selectedShipBuildId, shipDraft]);

    const saveWeapon = useCallback(async () => {
        if (!weaponDraft || !selectedWeaponBuildId) return;
        try {
            await networkManager.send("customize:weapon", {
                action: "upsert",
                weaponId: selectedWeaponBuildId,
                weapon: weaponDraft,
            });
            notify.success("已保存");
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "保存失败");
        }
    }, [networkManager, reloadData, selectedWeaponBuildId, weaponDraft]);

    const copyShipPreset = useCallback(async (presetId: string) => {
        try {
            const res = await networkManager.send("customize:token", { action: "copy_preset", presetId }) as { ship?: InventoryToken };
            notify.success("已复制");
            await reloadData();
            if (res.ship?.$id) {
                setSelectedShipBuildId(res.ship.$id);
            }
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "复制失败");
        }
    }, [networkManager, reloadData]);

    const copyWeaponPreset = useCallback(async (presetId: string) => {
        try {
            const res = await networkManager.send("customize:weapon", { action: "copy_preset", presetId }) as { weapon?: WeaponJSON };
            notify.success("已复制");
            await reloadData();
            if (res.weapon?.$id) {
                setSelectedWeaponBuildId(res.weapon.$id);
            }
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "复制失败");
        }
    }, [networkManager, reloadData]);

    const deleteShip = useCallback(async (shipId: string) => {
        try {
            await networkManager.send("customize:token", { action: "delete", tokenId: shipId });
            notify.success("已删除");
            setSelectedShipBuildId(null);
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "删除失败");
        }
    }, [networkManager, reloadData]);

    const deleteWeapon = useCallback(async (weaponId: string) => {
        try {
            await networkManager.send("customize:weapon", { action: "delete", weaponId });
            notify.success("已删除");
            setSelectedWeaponBuildId(null);
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "删除失败");
        }
    }, [networkManager, reloadData]);

    const uploadShipTexture = useCallback(async (file: File, useColorKey: boolean) => {
        try {
            const uploadFile = await convertToPng(file, useColorKey ? { color: keyColor, tolerance: keyTolerance } : undefined);
            const assetId = await assetSocket.upload("ship_texture", uploadFile);
            notify.success("上传成功");
            updateShipTexture({ assetId });
            await loadTexturePreview(assetId);
            await reloadAssets();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "上传失败");
        }
    }, [assetSocket, keyColor, keyTolerance, updateShipTexture, loadTexturePreview, reloadAssets]);

    const uploadWeaponTexture = useCallback(async (file: File) => {
        try {
            const uploadFile = await convertToPng(file);
            const assetId = await assetSocket.upload("weapon_texture", uploadFile);
            notify.success("上传成功");
            updateWeaponTexture({ assetId });
            await loadWeaponTexturePreview(assetId);
            await reloadAssets();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "上传失败");
        }
    }, [assetSocket, updateWeaponTexture, loadWeaponTexturePreview, reloadAssets]);

    if (loadError) {
        return (
            <Dialog.Root open={open} onOpenChange={onOpenChange}>
                <Dialog.Content maxWidth="400px">
                    <Dialog.Title>加载失败</Dialog.Title>
                    <Flex direction="column" align="center" gap="3" py="4">
                        <Text color="gray">{loadError}</Text>
                        <Flex gap="2">
                            <Button onClick={() => void reloadData()}>重试</Button>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
                        </Flex>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        );
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Content maxWidth="1200px">
                <Dialog.Title>舰船 / 武器工坊</Dialog.Title>

                <Tabs.Root value={activeTopTab} onValueChange={(v) => setActiveTopTab(v as "ship" | "weapon")}>
                    <Tabs.List mb="3">
                        <Tabs.Trigger value="ship">舰船</Tabs.Trigger>
                        <Tabs.Trigger value="weapon">武器</Tabs.Trigger>
                    </Tabs.List>

                    {activeTopTab === "ship" && (
                        <Grid columns="2" gap="4">
                            <Flex direction="column" gap="3">
                                <Card>
                                    <Flex justify="between" align="center" mb="2">
                                        <Text weight="bold">舰船</Text>
                                        <Flex gap="2" align="center">
                                            <Select.Root value={selectedShipBuildId ?? ""} onValueChange={setSelectedShipBuildId}>
                                                <Select.Trigger style={{ width: 200 }} />
                                                <Select.Content>
                                                    {shipBuilds.map((item) => (
                                                        <Select.Item key={item.$id} value={item.$id}>
                                                            {item.metadata?.name ?? shortId(item.$id)}
                                                        </Select.Item>
                                                    ))}
                                                </Select.Content>
                                            </Select.Root>
                                            {selectedShipBuildId && (
                                                <Button size="1" variant="ghost" color="red" onClick={() => void deleteShip(selectedShipBuildId)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            )}
                                        </Flex>
                                    </Flex>
                                    <MiniShipPreview token={shipDraft} zoom={shipPreviewZoom} onZoomChange={setShipPreviewZoom} texturePreviewUrl={texturePreviewUrl} />
                                    <Flex justify="center" gap="2" mt="1">
                                        <Button size="1" variant="ghost" onClick={() => setShipPreviewZoom(Math.max(0.5, shipPreviewZoom - 0.25))}>-</Button>
                                        <Text size="1">{shipPreviewZoom.toFixed(2)}x</Text>
                                        <Button size="1" variant="ghost" onClick={() => setShipPreviewZoom(Math.min(4, shipPreviewZoom + 0.25))}>+</Button>
                                    </Flex>
                                </Card>

<Card>
                                        <Flex justify="between" align="center" mb="2">
                                            <Text weight="bold">贴图</Text>
                                            <Flex gap="2">
                                                <Button size="1" variant="solid" color="blue" onClick={() => shipTextureInputRef.current?.click()}>
                                                    <Upload size={12} /> 上传图片
                                                </Button>
                                            </Flex>
                                        </Flex>

                                        <Flex direction="column" gap="2">
                                            {texturePreviewUrl && (
                                                <Box style={{ width: 120, height: 120, border: "1px solid rgba(43, 66, 97, 0.6)", borderRadius: 4, overflow: "hidden" }}>
                                                    <img src={texturePreviewUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                                </Box>
                                            )}

                                            <Select.Root
                                                value={shipDraft?.spec.texture?.assetId ?? ""}
                                                onValueChange={(v) => {
                                                    if (!v || !shipDraft) return;
                                                    updateShipTexture({ assetId: v });
                                                    void loadTexturePreview(v);
                                                }}
                                            >
                                                <Select.Trigger placeholder="选择已有贴图..." style={{ width: "100%" }} />
                                                <Select.Content>
                                                    {shipTextureAssets.length === 0 && (
                                                        <Select.Item value="_empty" disabled>暂无贴图，请上传</Select.Item>
                                                    )}
                                                    {shipTextureAssets.map((asset) => (
                                                        <Select.Item key={asset.$id} value={asset.$id}>{asset.filename}</Select.Item>
                                                    ))}
                                                </Select.Content>
                                            </Select.Root>

                                            <Separator size="2" />

                                            <Flex direction="column" gap="2">
                                                <Text size="1" weight="bold">贴图位置调整</Text>
                                                <Grid columns="3" gap="3">
                                                    <Box>
                                                        <Text size="1" color="gray">X 偏移</Text>
                                                        <Flex align="center" gap="1">
                                                            <input
                                                                type="range"
                                                                min={-100}
                                                                max={100}
                                                                value={shipDraft?.spec.texture?.offsetX ?? 0}
                                                                onChange={(e) => updateShipTexture({ offsetX: Number(e.target.value) })}
                                                                style={{ width: 80 }}
                                                            />
                                                            <Text size="1">{shipDraft?.spec.texture?.offsetX ?? 0}</Text>
                                                        </Flex>
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">Y 偏移</Text>
                                                        <Flex align="center" gap="1">
                                                            <input
                                                                type="range"
                                                                min={-100}
                                                                max={100}
                                                                value={shipDraft?.spec.texture?.offsetY ?? 0}
                                                                onChange={(e) => updateShipTexture({ offsetY: Number(e.target.value) })}
                                                                style={{ width: 80 }}
                                                            />
                                                            <Text size="1">{shipDraft?.spec.texture?.offsetY ?? 0}</Text>
                                                        </Flex>
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">缩放比例</Text>
                                                        <Flex align="center" gap="1">
                                                            <input
                                                                type="range"
                                                                min={0.5}
                                                                max={3}
                                                                step={0.1}
                                                                value={shipDraft?.spec.texture?.scale ?? 1}
                                                                onChange={(e) => updateShipTexture({ scale: Number(e.target.value) })}
                                                                style={{ width: 80 }}
                                                            />
                                                            <Text size="1">{(shipDraft?.spec.texture?.scale ?? 1).toFixed(1)}x</Text>
                                                        </Flex>
                                                    </Box>
                                                </Grid>
                                            </Flex>

                                            <Separator size="2" />

                                            <Flex direction="column" gap="2">
                                                <Text size="1" weight="bold">抠图取色（透明化指定颜色）</Text>
                                                <Flex align="center" gap="2">
                                                    <Text size="1" color="gray">目标色:</Text>
                                                    <input type="color" value={keyColor} onChange={(e) => setKeyColor(e.target.value)} style={{ width: 32, height: 24, cursor: "pointer" }} />
                                                    <Text size="1">{keyColor}</Text>
                                                    <Text size="1" color="gray">容差:</Text>
                                                    <input type="range" min={0} max={50} value={keyTolerance} onChange={(e) => setKeyTolerance(Number(e.target.value))} style={{ width: 60 }} />
                                                    <Text size="1">{keyTolerance}</Text>
                                                </Flex>
                                            </Flex>
                                        </Flex>

                                        <input
                                            ref={shipTextureInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                void uploadShipTexture(file, keyColor !== "#000000" || keyTolerance > 0);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                    </Card>

                                <Card>
                                    <Text weight="bold" mb="2">挂点武器</Text>
                                    {shipDraft?.spec.mounts?.length ? (
                                        <Flex direction="column" gap="2">
                                            <Select.Root value={mountSelection} onValueChange={setMountSelection}>
                                                <Select.Trigger />
                                                <Select.Content>
                                                    {shipDraft.spec.mounts.map((mount) => (
                                                        <Select.Item key={mount.id} value={mount.id}>
                                                            {mount.displayName ?? mount.id} ({mount.size})
                                                        </Select.Item>
                                                    ))}
                                                </Select.Content>
                                            </Select.Root>

                                            {selectedMount && (
                                                <Flex align="center" gap="2">
                                                    <Text size="1">武器:</Text>
                                                    <Select.Root
                                                        value={selectedMount.weapon?.$id ?? ""}
                                                        onValueChange={(v) => {
                                                            if (!v) return;
                                                            const matched = weaponBuilds.find((item) => item.$id === v);
                                                            if (!matched) return;
                                                            if (!isWeaponSizeCompatible(selectedMount.size, matched.spec.size)) {
                                                                notify.error("尺寸不兼容");
                                                                return;
                                                            }
                                                            updateShipDraft((draft) => {
                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                if (mount) mount.weapon = matched;
                                                            });
                                                            notify.success("已挂载");
                                                        }}
                                                    >
                                                        <Select.Trigger placeholder="选择武器..." />
                                                        <Select.Content>
                                                            {compatibleWeapons.map((item) => (
                                                                <Select.Item key={item.$id} value={item.$id}>
                                                                    {item.metadata?.name ?? shortId(item.$id)} ({item.spec.size})
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Content>
                                                    </Select.Root>
                                                    {selectedMount.weapon && (
                                                        <Button size="1" variant="ghost" color="red" onClick={() => {
                                                            updateShipDraft((draft) => {
                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                if (mount) mount.weapon = undefined;
                                                            });
                                                        }}>卸载</Button>
                                                    )}
                                                </Flex>
                                            )}
                                        </Flex>
                                    ) : (
                                        <Text color="gray">无挂点</Text>
                                    )}
                                </Card>
                            </Flex>

                            <Flex direction="column" gap="3">
                                <Card>
                                    <Flex justify="between" align="center" mb="2">
                                        <Text weight="bold">属性编辑</Text>
                                        <Tabs.Root value={editorTab} onValueChange={(v) => setEditorTab(v as "form" | "json")}>
                                            <Tabs.List>
                                                <Tabs.Trigger value="form">表单</Tabs.Trigger>
                                                <Tabs.Trigger value="json">JSON</Tabs.Trigger>
                                            </Tabs.List>
                                        </Tabs.Root>
                                    </Flex>

                                    {editorTab === "form" && shipDraft && (
                                        <Flex direction="column" gap="3">
                                            <Box>
                                                <Text size="1" weight="bold" mb="1">基本信息</Text>
                                                <Grid columns="2" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">名称</Text>
                                                        <TextField.Root
                                                            value={shipDraft.metadata?.name ?? ""}
                                                            onChange={(e) => updateShipDraft((d) => { d.metadata = { ...d.metadata!, name: e.target.value }; })}
                                                        />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">描述</Text>
                                                        <TextField.Root
                                                            value={shipDraft.metadata?.description ?? ""}
                                                            onChange={(e) => updateShipDraft((d) => { d.metadata = { ...d.metadata!, description: e.target.value }; })}
                                                        />
                                                    </Box>
                                                </Grid>
                                            </Box>

                                            <Box>
                                                <Text size="1" weight="bold" mb="1">舰船规格</Text>
                                                <Grid columns="4" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">船体大小</Text>
                                                        <Select.Root value={shipDraft.spec.size} onValueChange={(v) => updateShipDraft((d) => { d.spec.size = v as HullSize; })}>
                                                            <Select.Trigger />
                                                            <Select.Content>{Object.values(HullSize).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">舰船类型</Text>
                                                        <Select.Root value={shipDraft.spec.class} onValueChange={(v) => updateShipDraft((d) => { d.spec.class = v as ShipClass; })}>
                                                            <Select.Trigger />
                                                            <Select.Content>{Object.values(ShipClass).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">宽度 (像素)</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.width ?? 40)} onChange={(e) => updateShipDraft((d) => { d.spec.width = Number(e.target.value) || 40; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">长度 (像素)</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.length ?? 60)} onChange={(e) => updateShipDraft((d) => { d.spec.length = Number(e.target.value) || 60; })} />
                                                    </Box>
                                                </Grid>
                                            </Box>

                                            <Box>
                                                <Text size="1" weight="bold" mb="1">防御属性</Text>
                                                <Grid columns="4" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">船体耐久</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.maxHitPoints)} onChange={(e) => updateShipDraft((d) => { d.spec.maxHitPoints = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">护甲/象限</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.armorMaxPerQuadrant ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.armorMaxPerQuadrant = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">辐能容量</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.fluxCapacity ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.fluxCapacity = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">辐能散耗</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.fluxDissipation ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.fluxDissipation = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                </Grid>
                                            </Box>

                                            <Box>
                                                <Text size="1" weight="bold" mb="1">机动属性</Text>
                                                <Grid columns="3" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">最大速度</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.maxSpeed ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.maxSpeed = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">转向速度</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.maxTurnRate ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.maxTurnRate = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">射程系数</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.rangeModifier ?? 1)} onChange={(e) => updateShipDraft((d) => { d.spec.rangeModifier = Number(e.target.value) || 1; })} />
                                                    </Box>
                                                </Grid>
                                            </Box>

                                            <Separator size="2" />

                                            <Flex gap="2" align="center">
                                                <ShieldCheck size={14} />
                                                <Text size="1" weight="bold">护盾系统</Text>
                                                <Button size="1" variant="soft" onClick={() => updateShipDraft((d) => {
                                                    d.spec.shield = d.spec.shield ? undefined : { arc: 360, radius: 50, efficiency: 1, upkeep: 0 };
                                                })}>
                                                    {shipDraft.spec.shield ? "禁用护盾" : "启用护盾"}
                                                </Button>
                                                {shipDraft.spec.shield && <Badge size="1">{shipDraft.spec.shield.arc >= 360 ? "全向" : "定向"}</Badge>}
                                            </Flex>

                                            {shipDraft.spec.shield && (
                                                <Grid columns="4" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">覆盖角度</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.shield.arc)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.arc = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">护盾半径</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.shield.radius)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.radius = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">伤害效率</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.shield.efficiency ?? 1)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.efficiency = Number(e.target.value) || 1; })} />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">维持消耗</Text>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.shield.upkeep ?? 0)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.upkeep = Number(e.target.value) || 0; })} />
                                                    </Box>
                                                </Grid>
                                            )}
                                        </Flex>
                                    )}

                                    {editorTab === "json" && (
                                        <Flex direction="column" gap="2">
                                            <TextArea rows={20} value={shipRawJson} onChange={(e) => setShipRawJson(e.target.value)} />
                                            <Flex gap="2">
                                                <Button variant="soft" onClick={validateShipRaw}>校验</Button>
                                                <Button variant="ghost" onClick={() => navigator.clipboard.writeText(shipRawJson)}><Copy size={12} /></Button>
                                            </Flex>
                                        </Flex>
                                    )}

                                    <Flex justify="end" mt="2">
                                        <Button onClick={() => void saveShip()}><Save size={14} /> 保存</Button>
                                    </Flex>
                                </Card>

                                <Card>
                                    <Text weight="bold" mb="2">预设模板</Text>
                                    <Flex direction="column" gap="1">
                                        {shipPresets.map((preset) => (
                                            <Flex key={preset.$id} justify="between" align="center">
                                                <Box>
                                                    <Text size="2">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
                                                    <Text size="1" color="gray"> {preset.spec.size}/{preset.spec.class}</Text>
                                                </Box>
                                                <Button size="1" variant="ghost" onClick={() => void copyShipPreset(preset.$id)}><Plus size={12} /></Button>
                                            </Flex>
                                        ))}
                                    </Flex>
                                </Card>
                            </Flex>
                        </Grid>
                    )}

                    {activeTopTab === "weapon" && (
                        <Grid columns="2" gap="4">
                            <Flex direction="column" gap="3">
                                <Card>
                                    <Flex justify="between" align="center" mb="2">
                                        <Text weight="bold">武器</Text>
                                        <Flex gap="2" align="center">
                                            <Select.Root value={selectedWeaponBuildId ?? ""} onValueChange={setSelectedWeaponBuildId}>
                                                <Select.Trigger style={{ width: 200 }} />
                                                <Select.Content>
                                                    {weaponBuilds.map((item) => (
                                                        <Select.Item key={item.$id} value={item.$id}>
                                                            {item.metadata?.name ?? shortId(item.$id)}
                                                        </Select.Item>
                                                    ))}
                                                </Select.Content>
                                            </Select.Root>
                                            {selectedWeaponBuildId && (
                                                <Button size="1" variant="ghost" color="red" onClick={() => void deleteWeapon(selectedWeaponBuildId)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            )}
                                        </Flex>
                                    </Flex>

                                    {weaponDraft && (
                                        <Flex direction="column" gap="2">
                                            <TextField.Root
                                                value={weaponDraft.metadata?.name ?? ""}
                                                onChange={(e) => updateWeaponDraft((d) => { d.metadata = { name: e.target.value }; })}
                                                placeholder="名称"
                                            />
                                            <Grid columns="3" gap="2">
                                                <Select.Root value={weaponDraft.spec.size} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.size = v as WeaponSlotSize; })}>
                                                    <Select.Trigger placeholder="尺寸" />
                                                    <Select.Content>{Object.values(WeaponSlotSize).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                </Select.Root>
                                                <Select.Root value={weaponDraft.spec.damageType} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.damageType = v as DamageType; })}>
                                                    <Select.Trigger placeholder="伤害类型" />
                                                    <Select.Content>{Object.values(DamageType).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                </Select.Root>
                                                <TextField.Root type="number" value={String(weaponDraft.spec.damage)} onChange={(e) => updateWeaponDraft((d) => { d.spec.damage = Number(e.target.value) || 0; })} placeholder="伤害" />
                                            </Grid>
                                            <Grid columns="4" gap="2">
                                                <TextField.Root type="number" value={String(weaponDraft.spec.range)} onChange={(e) => updateWeaponDraft((d) => { d.spec.range = Number(e.target.value) || 0; })} placeholder="射程" />
                                                <TextField.Root type="number" value={String(weaponDraft.spec.minRange ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.minRange = Number(e.target.value) || 0; })} placeholder="最小射程" />
                                                <TextField.Root type="number" value={String(weaponDraft.spec.cooldown ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.cooldown = Number(e.target.value) || 0; })} placeholder="冷却" />
                                                <TextField.Root type="number" value={String(weaponDraft.spec.fluxCostPerShot)} onChange={(e) => updateWeaponDraft((d) => { d.spec.fluxCostPerShot = Number(e.target.value) || 0; })} placeholder="辐能/发" />
                                            </Grid>
                                            <Grid columns="3" gap="2">
                                                <TextField.Root type="number" value={String(weaponDraft.spec.projectilesPerShot ?? 1)} onChange={(e) => updateWeaponDraft((d) => { d.spec.projectilesPerShot = Number(e.target.value) || 1; })} placeholder="弹丸/发" />
                                                <TextField.Root type="number" value={String(weaponDraft.spec.burstCount ?? 1)} onChange={(e) => updateWeaponDraft((d) => { d.spec.burstCount = Number(e.target.value) || 1; })} placeholder="连射" />
                                                <TextField.Root type="number" value={String(weaponDraft.spec.opCost ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.opCost = Number(e.target.value) || 0; })} placeholder="OP成本" />
                                            </Grid>
                                            <Flex gap="1" align="center">
                                                {(weaponDraft.spec.tags ?? []).map((tag) => (
                                                    <Badge key={tag} size="1">{tag}</Badge>
                                                ))}
                                                <Select.Root onValueChange={(v) => {
                                                    if (v && !weaponDraft.spec.tags?.includes(v as WeaponTag)) {
                                                        updateWeaponDraft((d) => { d.spec.tags = [...(d.spec.tags ?? []), v as WeaponTag]; });
                                                    }
                                                }}>
                                                    <Select.Trigger placeholder="添加标签" />
                                                    <Select.Content>{Object.values(WeaponTag).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                </Select.Root>
                                            </Flex>
                                        </Flex>
                                    )}
                                </Card>

<Card>
                                        <Flex justify="between" align="center" mb="2">
                                            <Text weight="bold">贴图</Text>
                                            <Flex gap="2">
                                                <Button size="1" variant="solid" color="blue" onClick={() => weaponTextureInputRef.current?.click()}>
                                                    <Upload size={12} /> 上传图片
                                                </Button>
                                            </Flex>
                                        </Flex>

                                        <Flex direction="column" gap="2">
                                            {weaponTexturePreviewUrl && (
                                                <Box style={{ width: 100, height: 100, border: "1px solid rgba(43, 66, 97, 0.6)", borderRadius: 4, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
                                                    <MiniWeaponPreview weapon={weaponDraft} texturePreviewUrl={weaponTexturePreviewUrl} />
                                                </Box>
                                            )}

                                            <Select.Root
                                                value={weaponDraft?.spec.texture?.assetId ?? ""}
                                                onValueChange={(v) => {
                                                    if (!v || !weaponDraft) return;
                                                    updateWeaponTexture({ assetId: v });
                                                    void loadWeaponTexturePreview(v);
                                                }}
                                            >
                                                <Select.Trigger placeholder="选择已有贴图..." style={{ width: "100%" }} />
                                                <Select.Content>
                                                    {weaponTextureAssets.length === 0 && (
                                                        <Select.Item value="_empty" disabled>暂无贴图，请上传</Select.Item>
                                                    )}
                                                    {weaponTextureAssets.map((asset) => (
                                                        <Select.Item key={asset.$id} value={asset.$id}>{asset.filename}</Select.Item>
                                                    ))}
                                                </Select.Content>
                                            </Select.Root>
                                        </Flex>

                                        <input
                                            ref={weaponTextureInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                void uploadWeaponTexture(file);
                                                e.currentTarget.value = "";
                                        }}
                                    />
                                </Card>
                            </Flex>

                            <Flex direction="column" gap="3">
                                <Card>
                                    <Text weight="bold" mb="2">JSON 编辑</Text>
                                    <TextArea rows={20} value={weaponRawJson} onChange={(e) => setWeaponRawJson(e.target.value)} />
                                    <Flex gap="2" mt="2">
                                        <Button variant="soft" onClick={validateWeaponRaw}>校验</Button>
                                        <Button variant="ghost" onClick={() => navigator.clipboard.writeText(weaponRawJson)}><Copy size={12} /></Button>
                                    </Flex>
                                    <Flex justify="end" mt="2">
                                        <Button onClick={() => void saveWeapon()}><Save size={14} /> 保存</Button>
                                    </Flex>
                                </Card>

                                <Card>
                                    <Text weight="bold" mb="2">预设模板</Text>
                                    <Flex direction="column" gap="1">
                                        {weaponPresets.map((preset) => (
                                            <Flex key={preset.$id} justify="between" align="center">
                                                <Box>
                                                    <Text size="2">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
                                                    <Text size="1" color="gray"> {preset.spec.size}/{preset.spec.damageType}</Text>
                                                </Box>
                                                <Button size="1" variant="ghost" onClick={() => void copyWeaponPreset(preset.$id)}><Plus size={12} /></Button>
                                            </Flex>
                                        ))}
                                    </Flex>
                                </Card>
                            </Flex>
                        </Grid>
                    )}
                </Tabs.Root>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default LoadoutCustomizerDialog;