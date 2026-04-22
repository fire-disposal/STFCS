import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Badge,
    Box,
    Button,
    Card,
    Dialog,
    Flex,
    Grid,
    Progress,
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
    type ShipBuild,
    type WeaponBuild,
} from "@vt/data";
import { Plus, Save, Upload, WandSparkles, Wrench, Copy, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import { notify } from "@/ui/shared/Notification";
import { useAssetSocket } from "@/hooks/useAssetSocket";
import MiniShipPreview from "./MiniShipPreview";
import "./ship-customization-modal.css";
import "./weapon-customization-modal.css";

interface LoadoutCustomizerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
}

interface ShipBuildRecord {
    id: string;
    data: InventoryToken;
    ownerId?: string;
    isPreset?: boolean;
}

interface WeaponBuildRecord {
    id: string;
    data: WeaponJSON;
    ownerId?: string;
    isPreset?: boolean;
}

interface AssetWithData {
    $id: string;
    filename: string;
    mimeType: string;
    data?: string;
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeInventoryToken(input: unknown): InventoryToken | null {
    if (!input || typeof input !== "object") return null;
    const raw = (input as { data?: unknown })?.data ?? input;
    if (!raw || typeof raw !== "object") return null;
    
    const obj = raw as Record<string, unknown>;
    if (obj.$id && obj.spec) {
        return {
            $id: obj.$id as string,
            $presetRef: obj.$presetRef as string | undefined,
            spec: obj.spec as InventoryToken["spec"],
            metadata: (obj.metadata as InventoryToken["metadata"]) ?? { name: obj.$id as string },
        };
    }
    return null;
}

function normalizeWeaponJSON(input: unknown): WeaponJSON | null {
    if (!input || typeof input !== "object") return null;
    const raw = (input as { data?: unknown })?.data ?? input;
    if (!raw || typeof raw !== "object") return null;
    
    const obj = raw as Record<string, unknown>;
    if (obj.$id && obj.spec) {
        return {
            $id: obj.$id as string,
            spec: obj.spec as WeaponJSON["spec"],
            runtime: obj.runtime as WeaponJSON["runtime"] | undefined,
            metadata: (obj.metadata as WeaponJSON["metadata"]) ?? { name: obj.$id as string },
        };
    }
    return null;
}

function ensureShipDefaults(token: InventoryToken): InventoryToken {
    const next = clone(token);
    next.spec.mounts = next.spec.mounts ?? [];
    next.metadata = next.metadata ?? { name: next.$id };
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

function idLabel(id: string): string {
    if (id.startsWith("preset:")) return id;
    return id.length > 20 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id;
}

async function applyColorKey(sourceFile: File, colorHex: string, tolerance: number): Promise<File> {
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
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const { data } = imageData;

    const hex = colorHex.replace("#", "");
    const targetR = Number.parseInt(hex.slice(0, 2), 16);
    const targetG = Number.parseInt(hex.slice(2, 4), 16);
    const targetB = Number.parseInt(hex.slice(4, 6), 16);

    for (let i = 0; i < data.length; i += 4) {
        const dr = Math.abs(data[i] - targetR);
        const dg = Math.abs(data[i + 1] - targetG);
        const db = Math.abs(data[i + 2] - targetB);
        if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
            data[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
            if (!b) {
                reject(new Error("无法导出图像"));
                return;
            }
            resolve(b);
        }, "image/png");
    });

    return new File([blob], sourceFile.name.replace(/\.[^.]+$/, "") + "-colorkey.png", { type: "image/png" });
}

export const LoadoutCustomizerDialog: React.FC<LoadoutCustomizerDialogProps> = ({ open, onOpenChange, networkManager }) => {
    const socket = networkManager.getSocket();
    const assetSocket = useAssetSocket(socket);
    const textureInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);
    const [activeTopTab, setActiveTopTab] = useState<"ship" | "weapon">("ship");

    const [shipBuilds, setShipBuilds] = useState<ShipBuildRecord[]>([]);
    const [weaponBuilds, setWeaponBuilds] = useState<WeaponBuildRecord[]>([]);
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
    const [shipTextureAssets, setShipTextureAssets] = useState<AssetWithData[]>([]);
    const [weaponTextureAssets, setWeaponTextureAssets] = useState<AssetWithData[]>([]);
    const [texturePreviewDataUrl, setTexturePreviewDataUrl] = useState<string | null>(null);
    const [keyColor, setKeyColor] = useState("#000000");
    const [keyTolerance, setKeyTolerance] = useState(12);
    const [mountSelection, setMountSelection] = useState<string>("");
    const [loadError, setLoadError] = useState<string | null>(null);

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
            setShipTextureAssets(shipAssets as AssetWithData[]);
            setWeaponTextureAssets(weaponAssets as AssetWithData[]);
        } catch (error) {
            console.error(error);
        }
    }, [socket, assetSocket]);

    const reloadData = useCallback(async () => {
        if (!open) return;

        setLoading(true);
        setLoadError(null);

        try {
            // 检查socket连接状态
            const socket = networkManager.getSocket();
            if (!socket?.connected) {
                throw new Error("网络未连接，请检查服务器状态");
            }

            // 设置超时保护
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("数据加载超时，请检查网络连接")), 15000);
            });

            const dataPromise = Promise.all([
                networkManager.send("customize:token", { action: "list" }),
                networkManager.send("customize:weapon", { action: "list" }),
                networkManager.send("preset:list_tokens", {}),
                networkManager.send("preset:list_weapons", {}),
            ]);

            const [shipListRes, weaponListRes, shipPresetRes, weaponPresetRes] = await Promise.race([
                dataPromise,
                timeoutPromise
            ]) as any[];

            const nextShipBuilds = ((shipListRes?.ships ?? []) as ShipBuild[]).map((s) => ({
                id: s.id,
                data: s.data,
                ownerId: s.ownerId,
                isPreset: s.isPreset,
            }));
            const nextWeaponBuilds = ((weaponListRes?.weapons ?? []) as WeaponBuild[]).map((w) => ({
                id: w.id,
                data: w.data,
                ownerId: w.ownerId,
                isPreset: w.isPreset,
            }));
            const nextShipPresets = (shipPresetRes?.presets ?? [])
                .map((item: unknown) => normalizeInventoryToken(item))
                .filter((item: InventoryToken | null): item is InventoryToken => Boolean(item));
            const nextWeaponPresets = (weaponPresetRes?.presets ?? [])
                .map((item: unknown) => normalizeWeaponJSON(item))
                .filter((item: WeaponJSON | null): item is WeaponJSON => Boolean(item));

            setShipBuilds(nextShipBuilds);
            setWeaponBuilds(nextWeaponBuilds);
            setShipPresets(nextShipPresets);
            setWeaponPresets(nextWeaponPresets);

            if (!selectedShipBuildId && nextShipBuilds.length > 0) {
                setSelectedShipBuildId(nextShipBuilds[0].id);
            }
            if (!selectedWeaponBuildId && nextWeaponBuilds.length > 0) {
                setSelectedWeaponBuildId(nextWeaponBuilds[0].id);
            }

            await reloadAssets();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "自定义数据加载失败";
            console.error("LoadoutCustomizerDialog reloadData error:", error);
            notify.error(errorMessage);
            setLoadError(errorMessage);

            // 设置空状态，让用户至少可以看到界面
            setShipBuilds([]);
            setWeaponBuilds([]);
            setShipPresets([]);
            setWeaponPresets([]);
        } finally {
            setLoading(false);
        }
    }, [networkManager, open, reloadAssets, selectedShipBuildId, selectedWeaponBuildId]);

    useEffect(() => {
        void reloadData();
    }, [reloadData]);

    useEffect(() => {
        const selected = shipBuilds.find((item) => item.id === selectedShipBuildId);
        if (!selected) {
            setShipDraft(null);
            setShipRawJson("");
            return;
        }

        const parsed = normalizeInventoryToken(selected.data);
        if (!parsed) {
            notify.error(`舰船 ${selected.id} 数据不符合 schema`);
            return;
        }

        const normalized = ensureShipDefaults(parsed);
        setShipDraft(normalized);
        setShipRawJson(JSON.stringify(normalized, null, 2));
        setMountSelection(normalized.spec.mounts?.[0]?.id ?? "");
    }, [shipBuilds, selectedShipBuildId]);

    useEffect(() => {
        const selected = weaponBuilds.find((item) => item.id === selectedWeaponBuildId);
        if (!selected) {
            setWeaponDraft(null);
            setWeaponRawJson("");
            return;
        }

        const parsed = normalizeWeaponJSON(selected.data);
        if (!parsed) {
            notify.error(`武器 ${selected.id} 数据不符合 schema`);
            return;
        }

        const normalized = ensureWeaponDefaults(parsed);
        setWeaponDraft(normalized);
        setWeaponRawJson(JSON.stringify(normalized, null, 2));
    }, [weaponBuilds, selectedWeaponBuildId]);

    const selectedMount = useMemo(() => {
        if (!shipDraft?.spec.mounts?.length || !mountSelection) return null;
        return shipDraft.spec.mounts.find((item: { id: string }) => item.id === mountSelection) ?? null;
    }, [shipDraft, mountSelection]);

    const compatibleWeapons = useMemo(() => {
        if (!selectedMount) return [];
        return weaponBuilds.filter((item) => {
            const w = normalizeWeaponJSON(item.data);
            if (!w) return false;
            return isWeaponSizeCompatible(selectedMount.size, w.spec.size);
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

    const validateShipRaw = useCallback(() => {
        try {
            const parsed = JSON.parse(shipRawJson);
            const normalized = normalizeInventoryToken(parsed);
            if (!normalized) {
                notify.error("舰船 JSON 数据格式不正确");
                return;
            }
            const withDefaults = ensureShipDefaults(normalized);
            setShipDraft(withDefaults);
            setShipRawJson(JSON.stringify(withDefaults, null, 2));
            notify.success("舰船 JSON 校验通过");
        } catch {
            notify.error("舰船 JSON 解析失败");
        }
    }, [shipRawJson]);

    const validateWeaponRaw = useCallback(() => {
        try {
            const parsed = JSON.parse(weaponRawJson);
            const normalized = normalizeWeaponJSON(parsed);
            if (!normalized) {
                notify.error("武器 JSON 数据格式不正确");
                return;
            }
            const withDefaults = ensureWeaponDefaults(normalized);
            setWeaponDraft(withDefaults);
            setWeaponRawJson(JSON.stringify(withDefaults, null, 2));
            notify.success("武器 JSON 校验通过");
        } catch {
            notify.error("武器 JSON 解析失败");
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
            notify.success("舰船已保存");
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "舰船保存失败");
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
            notify.success("武器已保存");
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "武器保存失败");
        }
    }, [networkManager, reloadData, selectedWeaponBuildId, weaponDraft]);

    const copyShipPreset = useCallback(async (presetId: string) => {
        try {
            const res = await networkManager.send("customize:token", { action: "copy_preset", presetId });
            notify.success("已从预设复制舰船");
            await reloadData();
            if (res && "ship" in res && res.ship?.id) {
                setSelectedShipBuildId(res.ship.id);
            }
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "复制预设失败");
        }
    }, [networkManager, reloadData]);

    const copyWeaponPreset = useCallback(async (presetId: string) => {
        try {
            const res = await networkManager.send("customize:weapon", { action: "copy_preset", presetId });
            notify.success("已从预设复制武器");
            await reloadData();
            if (res && "weapon" in res && res.weapon?.id) {
                setSelectedWeaponBuildId(res.weapon.id);
            }
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "复制预设失败");
        }
    }, [networkManager, reloadData]);

    const setTextureAssetForShip = useCallback(async (assetId: string) => {
        if (!shipDraft) return;

        updateShipDraft((draft) => {
            draft.spec.texture = {
                ...draft.spec.texture,
                assetId,
            };
        });

        try {
            const results = await assetSocket.batchGet([assetId], true);
            const first = results[0];
            if (first?.data && first?.info?.mimeType) {
                setTexturePreviewDataUrl(toDataUrl(first.info.mimeType, first.data));
            }
        } catch {
            setTexturePreviewDataUrl(null);
        }
    }, [assetSocket, shipDraft, updateShipDraft]);

    type AssetType = "avatar" | "ship_texture" | "weapon_texture";

    const uploadTexture = useCallback(async (assetType: AssetType, file: File, useColorKey: boolean) => {
        try {
            const uploadFile = useColorKey ? await applyColorKey(file, keyColor, keyTolerance) : file;
            const assetId = await assetSocket.upload(assetType, uploadFile);
            notify.success("贴图上传成功");
            if (assetType === "ship_texture") {
                await setTextureAssetForShip(assetId);
            }
            if (assetType === "weapon_texture") {
                updateWeaponDraft((draft) => {
                    draft.spec.texture = {
                        ...draft.spec.texture,
                        assetId,
                    };
                });
            }
            await reloadAssets();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "贴图上传失败");
        }
    }, [assetSocket, keyColor, keyTolerance, reloadAssets, setTextureAssetForShip, updateWeaponDraft]);

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Content maxWidth="1200px">
                <Dialog.Title>
                    <Flex align="center" gap="2">
                        <Wrench size={16} /> 舰船 / 武器工坊
                        <Badge color="blue" variant="soft">权威 Zod Schema 校验</Badge>
                    </Flex>
                </Dialog.Title>
                <Dialog.Description size="2">
                    外部可进入的装备工坊。支持友好表单 + 原始 JSON + 贴图中心对齐 + 挂点武器挂载。
                </Dialog.Description>

                {loading ? (
                    <Flex direction="column" align="center" gap="3" py="4">
                        <Text color="gray">加载中...</Text>
                        <Progress value={undefined} style={{ width: "100%" }} />
                    </Flex>
                ) : loadError ? (
                    <Flex direction="column" align="center" gap="3" py="4">
                        <Text color="red" weight="bold">加载失败</Text>
                        <Text color="gray" size="2">{loadError}</Text>
                        <Flex gap="2">
                            <Button variant="soft" onClick={() => void reloadData()}>
                                <RefreshCw size={14} /> 重试
                            </Button>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                关闭
                            </Button>
                        </Flex>
                    </Flex>
                ) : (
                    <Tabs.Root value={activeTopTab} onValueChange={(v) => setActiveTopTab(v as "ship" | "weapon")}>
                        <Tabs.List>
                            <Tabs.Trigger value="ship">舰船模块</Tabs.Trigger>
                            <Tabs.Trigger value="weapon">武器模块</Tabs.Trigger>
                        </Tabs.List>

                        <Box mt="3">
                            {activeTopTab === "ship" ? (
                                <Grid columns="2" gap="3">
                                    <Flex direction="column" gap="3">
                                        <Card>
                                            <Flex justify="between" align="center" mb="2">
                                                <Text size="2" weight="bold">舰船选择</Text>
                                                <Select.Root value={selectedShipBuildId ?? ""} onValueChange={setSelectedShipBuildId}>
                                                    <Select.Trigger style={{ width: 240 }} />
                                                    <Select.Content>
                                                        {shipBuilds.map((item) => {
                                                            const parsed = normalizeInventoryToken(item.data);
                                                            return (
                                                                <Select.Item key={item.id} value={item.id}>
                                                                    {parsed?.metadata?.name ?? idLabel(item.id)}
                                                                </Select.Item>
                                                            );
                                                        })}
                                                    </Select.Content>
                                                </Select.Root>
                                            </Flex>

                                            <MiniShipPreview token={shipDraft} zoom={shipPreviewZoom} onZoomChange={setShipPreviewZoom} texturePreviewUrl={texturePreviewDataUrl} />
                                        </Card>

                                        <Card>
                                            <Flex justify="between" align="center" mb="2">
                                                <Text size="2" weight="bold">贴图与中心对齐</Text>
                                                <Button variant="soft" onClick={() => textureInputRef.current?.click()}><Upload size={14} /> 上传</Button>
                                            </Flex>

                                            <Flex direction="column" gap="2">
                                                <Select.Root
                                                    value={shipDraft?.spec.texture?.assetId ?? ""}
                                                    onValueChange={(id) => {
                                                        if (!id) return;
                                                        void setTextureAssetForShip(id);
                                                    }}
                                                >
                                                    <Select.Trigger placeholder="选择已有舰船贴图" />
                                                    <Select.Content>
                                                        {shipTextureAssets.map((asset) => (
                                                            <Select.Item key={asset.$id} value={asset.$id}>{asset.filename}</Select.Item>
                                                        ))}
                                                    </Select.Content>
                                                </Select.Root>

                                                <Grid columns="3" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">中心 X 偏移</Text>
                                                        <input
                                                            type="range"
                                                            min={-200}
                                                            max={200}
                                                            value={shipDraft?.spec.texture?.offsetX ?? 0}
                                                            onChange={(e) => updateShipDraft((d) => {
                                                                d.spec.texture = {
                                                                    ...d.spec.texture,
                                                                    offsetX: Number(e.target.value),
                                                                };
                                                            })}
                                                        />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">中心 Y 偏移</Text>
                                                        <input
                                                            type="range"
                                                            min={-200}
                                                            max={200}
                                                            value={shipDraft?.spec.texture?.offsetY ?? 0}
                                                            onChange={(e) => updateShipDraft((d) => {
                                                                d.spec.texture = {
                                                                    ...d.spec.texture,
                                                                    offsetY: Number(e.target.value),
                                                                };
                                                            })}
                                                        />
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">缩放</Text>
                                                        <input
                                                            type="range"
                                                            min={0.2}
                                                            max={4}
                                                            step={0.01}
                                                            value={shipDraft?.spec.texture?.scale ?? 1}
                                                            onChange={(e) => updateShipDraft((d) => {
                                                                d.spec.texture = {
                                                                    ...d.spec.texture,
                                                                    scale: Number(e.target.value),
                                                                };
                                                            })}
                                                        />
                                                    </Box>
                                                </Grid>

                                                <Flex align="center" gap="2" wrap="wrap">
                                                    <Text size="1" color="gray">抠图取色</Text>
                                                    <input type="color" value={keyColor} onChange={(e) => setKeyColor(e.target.value)} />
                                                    <input type="range" min={0} max={80} value={keyTolerance} onChange={(e) => setKeyTolerance(Number(e.target.value))} />
                                                    <Text size="1">容差: {keyTolerance}</Text>
                                                </Flex>
                                            </Flex>

                                            <input
                                                ref={textureInputRef}
                                                type="file"
                                                accept="image/png"
                                                style={{ display: "none" }}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    void uploadTexture("ship_texture", file, true);
                                                    e.currentTarget.value = "";
                                                }}
                                            />
                                        </Card>

                                        <Card>
                                            <Text size="2" weight="bold" mb="2">挂点武器挂载</Text>
                                            {shipDraft?.spec.mounts?.length ? (
                                                <Flex direction="column" gap="2">
                                                    <Select.Root value={mountSelection} onValueChange={setMountSelection}>
                                                        <Select.Trigger />
                                                        <Select.Content>
                                                            {shipDraft.spec.mounts.map((mount: { id: string; displayName?: string; size: string }) => (
                                                                <Select.Item key={mount.id} value={mount.id}>{mount.displayName ?? mount.id} ({mount.size})</Select.Item>
                                                            ))}
                                                        </Select.Content>
                                                    </Select.Root>

                                                    <Select.Root
                                                        value={selectedMount?.weapon?.$id ?? ""}
                                                        onValueChange={(weaponId) => {
                                                            if (!selectedMount || !shipDraft) return;
                                                            if (!weaponId) return;
                                                            const matched = weaponBuilds.find((item) => item.id === weaponId);
                                                            const parsed = normalizeWeaponJSON(matched?.data);
                                                            if (!parsed) return;
                                                            if (!isWeaponSizeCompatible(selectedMount.size, parsed.spec.size)) {
                                                                notify.error("武器尺寸与挂点不兼容");
                                                                return;
                                                            }
                                                            updateShipDraft((draft) => {
                                                                const mount = draft.spec.mounts?.find((m: { id: string }) => m.id === selectedMount.id);
                                                                if (mount) {
                                                                    mount.weapon = parsed;
                                                                }
                                                            });
                                                            notify.success("武器已挂载到挂点");
                                                        }}
                                                    >
                                                        <Select.Trigger placeholder="选择可兼容武器" />
                                                        <Select.Content>
                                                            {compatibleWeapons.map((item) => {
                                                                const parsed = normalizeWeaponJSON(item.data);
                                                                if (!parsed) return null;
                                                                return <Select.Item key={item.id} value={item.id}>{parsed.metadata?.name ?? item.id} ({parsed.spec.size})</Select.Item>;
                                                            })}
                                                        </Select.Content>
                                                    </Select.Root>

                                                    <Button variant="soft" color="gray" onClick={() => {
                                                        if (!selectedMount || !shipDraft) return;
                                                        updateShipDraft((draft) => {
                                                            const mount = draft.spec.mounts?.find((m: { id: string }) => m.id === selectedMount.id);
                                                            if (mount) {
                                                                mount.weapon = undefined;
                                                            }
                                                        });
                                                        notify.success("已卸载挂点武器");
                                                    }}>卸载当前挂点</Button>
                                                </Flex>
                                            ) : (
                                                <Text color="gray">当前舰船没有挂点</Text>
                                            )}
                                        </Card>
                                    </Flex>

                                    <Flex direction="column" gap="3">
                                        <Card>
                                            <Flex justify="between" align="center" mb="2">
                                                <Text size="2" weight="bold">编辑器</Text>
                                                <Tabs.Root value={editorTab} onValueChange={(v) => setEditorTab(v as "form" | "json")}>
                                                    <Tabs.List>
                                                        <Tabs.Trigger value="form">表单</Tabs.Trigger>
                                                        <Tabs.Trigger value="json">JSON</Tabs.Trigger>
                                                    </Tabs.List>
                                                </Tabs.Root>
                                            </Flex>

                                            {editorTab === "form" && shipDraft && (
                                                <Flex direction="column" gap="3">
                                                    <Grid columns="2" gap="2">
                                                        <TextField.Root
                                                            value={shipDraft.metadata?.name ?? ""}
                                                            onChange={(e) => updateShipDraft((d) => {
                                                                d.metadata = { ...d.metadata, name: e.target.value };
                                                            })}
                                                            placeholder="舰船名称"
                                                        />
                                                        <TextField.Root
                                                            value={shipDraft.metadata?.description ?? ""}
                                                            onChange={(e) => updateShipDraft((d) => {
                                                                d.metadata = { ...d.metadata, description: e.target.value };
                                                            })}
                                                            placeholder="描述"
                                                        />
                                                    </Grid>

                                                    <Grid columns="4" gap="2">
                                                        <Select.Root value={shipDraft.spec.size} onValueChange={(v) => updateShipDraft((d) => { d.spec.size = v as any; })}>
                                                            <Select.Trigger />
                                                            <Select.Content>{Object.values(HullSize).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                        <Select.Root value={shipDraft.spec.class} onValueChange={(v) => updateShipDraft((d) => { d.spec.class = v as any; })}>
                                                            <Select.Trigger />
                                                            <Select.Content>{Object.values(ShipClass).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                        <TextField.Root type="number" value={String(shipDraft.spec.width ?? 40)} onChange={(e) => updateShipDraft((d) => { d.spec.width = Number(e.target.value) || 40; })} placeholder="宽度" />
                                                        <TextField.Root type="number" value={String(shipDraft.spec.length ?? 60)} onChange={(e) => updateShipDraft((d) => { d.spec.length = Number(e.target.value) || 60; })} placeholder="长度" />
                                                    </Grid>

                                                    <Grid columns="4" gap="2">
                                                        <TextField.Root type="number" value={String(shipDraft.spec.maxHitPoints)} onChange={(e) => updateShipDraft((d) => { d.spec.maxHitPoints = Number(e.target.value) || 0; })} placeholder="最大船体" />
                                                        <TextField.Root type="number" value={String(shipDraft.spec.armorMaxPerQuadrant)} onChange={(e) => updateShipDraft((d) => { d.spec.armorMaxPerQuadrant = Number(e.target.value) || 0; })} placeholder="每象限护甲" />
                                                        <TextField.Root type="number" value={String(shipDraft.spec.fluxCapacity ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.fluxCapacity = Number(e.target.value) || 0; })} placeholder="辐能容量" />
                                                        <TextField.Root type="number" value={String(shipDraft.spec.fluxDissipation ?? 0)} onChange={(e) => updateShipDraft((d) => { d.spec.fluxDissipation = Number(e.target.value) || 0; })} placeholder="辐能散耗" />
                                                    </Grid>

                                                    <Grid columns="3" gap="2">
                                                        <TextField.Root type="number" value={String(shipDraft.spec.maxSpeed)} onChange={(e) => updateShipDraft((d) => { d.spec.maxSpeed = Number(e.target.value) || 0; })} placeholder="最大速度" />
                                                        <TextField.Root type="number" value={String(shipDraft.spec.maxTurnRate)} onChange={(e) => updateShipDraft((d) => { d.spec.maxTurnRate = Number(e.target.value) || 0; })} placeholder="转向速率" />
                                                        <TextField.Root type="number" value={String(shipDraft.spec.rangeModifier)} onChange={(e) => updateShipDraft((d) => { d.spec.rangeModifier = Number(e.target.value) || 1; })} placeholder="射程系数" />
                                                    </Grid>

                                                    <Separator size="4" />
                                                    <Text size="2" weight="bold"><ShieldCheck size={14} /> 护盾</Text>
                                                    <Flex gap="2" align="center" wrap="wrap">
                                                        <Button
                                                            variant="soft"
                                                            onClick={() => updateShipDraft((d) => {
                                                                d.spec.shield = d.spec.shield
                                                                    ? undefined
                                                                    : { arc: 360, radius: 50, efficiency: 1, upkeep: 0 };
                                                            })}
                                                        >
                                                            {shipDraft.spec.shield ? "禁用护盾" : "启用护盾"}
                                                        </Button>
                                                        {!shipDraft.spec.shield && <Badge color="gray">NONE</Badge>}
                                                        {shipDraft.spec.shield && shipDraft.spec.shield.arc >= 360 && <Badge color="blue">全向</Badge>}
                                                        {shipDraft.spec.shield && shipDraft.spec.shield.arc < 360 && <Badge color="orange">定向</Badge>}
                                                    </Flex>

                                                    {shipDraft.spec.shield && (
                                                        <Grid columns="4" gap="2">
                                                            <TextField.Root type="number" value={String(shipDraft.spec.shield.arc)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.arc = Number(e.target.value) || 0; })} placeholder="护盾角度" />
                                                            <TextField.Root type="number" value={String(shipDraft.spec.shield.radius)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.radius = Number(e.target.value) || 0; })} placeholder="护盾半径" />
                                                            <TextField.Root type="number" value={String(shipDraft.spec.shield.efficiency ?? 1)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.efficiency = Number(e.target.value) || 1; })} placeholder="效率" />
                                                            <TextField.Root type="number" value={String(shipDraft.spec.shield.upkeep ?? 0)} onChange={(e) => updateShipDraft((d) => { if (d.spec.shield) d.spec.shield.upkeep = Number(e.target.value) || 0; })} placeholder="维持" />
                                                        </Grid>
                                                    )}
                                                </Flex>
                                            )}

                                            {editorTab === "json" && (
                                                <Flex direction="column" gap="2">
                                                    <TextArea rows={22} value={shipRawJson} onChange={(e) => setShipRawJson(e.target.value)} />
                                                    <Flex gap="2" wrap="wrap">
                                                        <Button variant="soft" onClick={validateShipRaw}><WandSparkles size={14} /> 校验并应用</Button>
                                                        <Button variant="soft" color="gray" onClick={() => setShipRawJson(JSON.stringify(JSON.parse(shipRawJson), null, 2))}>格式化</Button>
                                                        <Button variant="soft" color="gray" onClick={() => navigator.clipboard.writeText(shipRawJson)}><Copy size={14} /> 复制</Button>
                                                    </Flex>
                                                </Flex>
                                            )}

                                            <Flex justify="between" align="center" mt="2">
                                                <Flex align="center" gap="2">
                                                    <AlertCircle size={14} />
                                                    <Text size="1" color="gray">原始 JSON 支持复制粘贴，提交前会校验数据结构。</Text>
                                                </Flex>
                                                <Button onClick={() => void saveShip()}><Save size={14} /> 保存舰船</Button>
                                            </Flex>
                                        </Card>

                                        <Card>
                                            <Flex justify="between" align="center" mb="2">
                                                <Text size="2" weight="bold">从预设创建</Text>
                                            </Flex>
                                            <Flex direction="column" gap="2">
                                                {shipPresets.map((preset) => (
                                                    <Flex key={preset.$id} justify="between" align="center" className="ship-customization-modal__ship-item">
                                                        <Box>
                                                            <Text size="2">{preset.metadata.name}</Text>
                                                            <Text size="1" color="gray">{preset.spec.size} / {preset.spec.class}</Text>
                                                        </Box>
                                                        <Button size="1" variant="soft" onClick={() => void copyShipPreset(preset.$id)}><Plus size={12} /> 复制</Button>
                                                    </Flex>
                                                ))}
                                            </Flex>
                                        </Card>
                                    </Flex>
                                </Grid>
                            ) : (
                                <Grid columns="2" gap="3">
                                    <Flex direction="column" gap="3">
                                        <Card>
                                            <Flex justify="between" align="center" mb="2">
                                                <Text size="2" weight="bold">武器选择</Text>
                                                <Select.Root value={selectedWeaponBuildId ?? ""} onValueChange={setSelectedWeaponBuildId}>
                                                    <Select.Trigger style={{ width: 260 }} />
                                                    <Select.Content>
                                                        {weaponBuilds.map((item) => {
                                                            const parsed = normalizeWeaponJSON(item.data);
                                                            return <Select.Item key={item.id} value={item.id}>{parsed?.metadata?.name ?? idLabel(item.id)}</Select.Item>;
                                                        })}
                                                    </Select.Content>
                                                </Select.Root>
                                            </Flex>

                                            {weaponDraft && (
                                                <Flex direction="column" gap="2">
                                                    <TextField.Root value={weaponDraft.metadata?.name ?? ""} onChange={(e) => updateWeaponDraft((d) => { d.metadata = { ...d.metadata, name: e.target.value }; })} placeholder="武器名称" />
                                                    <TextField.Root value={weaponDraft.metadata?.description ?? ""} onChange={(e) => updateWeaponDraft((d) => { d.metadata = { ...(d.metadata ?? { name: d.$id }), name: d.metadata?.name ?? d.$id, description: e.target.value }; })} placeholder="武器描述" />
                                                    <Grid columns="3" gap="2">
                                                        <Select.Root value={weaponDraft.spec.size} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.size = v as any; })}>
                                                            <Select.Trigger />
                                                            <Select.Content>{Object.values(WeaponSlotSize).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                        <Select.Root value={weaponDraft.spec.damageType} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.damageType = v as any; })}>
                                                            <Select.Trigger />
                                                            <Select.Content>{Object.values(DamageType).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                        <TextField.Root type="number" value={String(weaponDraft.spec.damage)} onChange={(e) => updateWeaponDraft((d) => { d.spec.damage = Number(e.target.value) || 0; })} placeholder="伤害" />
                                                    </Grid>
                                                    <Grid columns="4" gap="2">
                                                        <TextField.Root type="number" value={String(weaponDraft.spec.range)} onChange={(e) => updateWeaponDraft((d) => { d.spec.range = Number(e.target.value) || 0; })} placeholder="射程" />
                                                        <TextField.Root type="number" value={String(weaponDraft.spec.minRange ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.minRange = Number(e.target.value) || 0; })} placeholder="最小射程" />
                                                        <TextField.Root type="number" value={String(weaponDraft.spec.cooldown ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.cooldown = Number(e.target.value) || 0; })} placeholder="冷却" />
                                                        <TextField.Root type="number" value={String(weaponDraft.spec.fluxCostPerShot)} onChange={(e) => updateWeaponDraft((d) => { d.spec.fluxCostPerShot = Number(e.target.value) || 0; })} placeholder="辐耗" />
                                                    </Grid>

                                                    <Text size="1" color="gray">标签（逗号分隔）</Text>
                                                    <TextField.Root
                                                        value={(weaponDraft.spec.tags ?? []).join(",")}
                                                        onChange={(e) => {
                                                            const values = e.target.value
                                                                .split(",")
                                                                .map((x) => x.trim())
                                                                .filter((x): x is keyof typeof WeaponTag => Boolean(x) && Object.values(WeaponTag).includes(x as any));
                                                            updateWeaponDraft((d) => {
                                                                d.spec.tags = values as any;
                                                            });
                                                        }}
                                                        placeholder="ANTI_SHIP,ENERGY"
                                                    />
                                                </Flex>
                                            )}
                                        </Card>

                                        <Card>
                                            <Text size="2" weight="bold" mb="2">武器贴图</Text>
                                            <Flex direction="column" gap="2">
                                                <Select.Root value={weaponDraft?.spec.texture?.assetId ?? ""} onValueChange={(id) => updateWeaponDraft((d) => {
                                                    d.spec.texture = { ...d.spec.texture, assetId: id };
                                                })}>
                                                    <Select.Trigger placeholder="选择已有武器贴图" />
                                                    <Select.Content>
                                                        {weaponTextureAssets.map((asset) => <Select.Item key={asset.$id} value={asset.$id}>{asset.filename}</Select.Item>)}
                                                    </Select.Content>
                                                </Select.Root>
                                                <Button variant="soft" onClick={() => {
                                                    const input = document.createElement("input");
                                                    input.type = "file";
                                                    input.accept = "image/png";
                                                    input.onchange = () => {
                                                        const file = input.files?.[0];
                                                        if (!file) return;
                                                        void uploadTexture("weapon_texture", file, true);
                                                    };
                                                    input.click();
                                                }}><Upload size={14} /> 上传并抠图</Button>
                                            </Flex>
                                        </Card>
                                    </Flex>

                                    <Flex direction="column" gap="3">
                                        <Card>
                                            <Text size="2" weight="bold" mb="2">武器 JSON（支持粘贴）</Text>
                                            <TextArea rows={26} value={weaponRawJson} onChange={(e) => setWeaponRawJson(e.target.value)} />
                                            <Flex gap="2" mt="2" wrap="wrap">
                                                <Button variant="soft" onClick={validateWeaponRaw}><WandSparkles size={14} /> 校验并应用</Button>
                                                <Button variant="soft" color="gray" onClick={() => setWeaponRawJson(JSON.stringify(JSON.parse(weaponRawJson), null, 2))}>格式化</Button>
                                                <Button variant="soft" color="gray" onClick={() => navigator.clipboard.writeText(weaponRawJson)}><Copy size={14} /> 复制</Button>
                                            </Flex>
                                            <Flex justify="end" mt="3">
                                                <Button onClick={() => void saveWeapon()}><Save size={14} /> 保存武器</Button>
                                            </Flex>
                                        </Card>

                                        <Card>
                                            <Text size="2" weight="bold" mb="2">从预设创建武器</Text>
                                            <Flex direction="column" gap="2">
                                                {weaponPresets.map((preset) => (
                                                    <Flex key={preset.$id} justify="between" align="center" className="ship-customization-modal__ship-item">
                                                        <Box>
                                                            <Text size="2">{preset.metadata?.name ?? preset.$id}</Text>
                                                            <Text size="1" color="gray">{preset.spec.size} / {preset.spec.damageType}</Text>
                                                        </Box>
                                                        <Button size="1" variant="soft" onClick={() => void copyWeaponPreset(preset.$id)}><Plus size={12} /> 复制</Button>
                                                    </Flex>
                                                ))}
                                            </Flex>
                                        </Card>
                                    </Flex>
                                </Grid>
                            )}
                        </Box>
                    </Tabs.Root>
                )}

                <Flex justify="between" mt="4">
                    <Text size="1" color="gray">提示：挂点支持可视化挂载，也支持直接编辑完整 JSON（含挂点与内嵌武器）。</Text>
                    <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>关闭</Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default LoadoutCustomizerDialog;
