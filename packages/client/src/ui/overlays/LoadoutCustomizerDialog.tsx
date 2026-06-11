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
    WeaponTagValues,
    isWeaponSizeCompatible,
    type InventoryToken,
    type WeaponJSON,
    type Texture,
    type WeaponTag,
} from "@vt/data";
import { ChevronDown, Plus, Save, Upload, Copy, ShieldCheck, Trash2, X, Search, Loader } from "lucide-react";
import type { SocketNetworkManager } from "@/network";
import { notify } from "@/ui/shared/Notification";
import { useAssetSocket } from "@/hooks/useAssetSocket";
import { textureManager } from "@/renderer/systems/TextureManager";
import MiniShipPreview from "../shared/MiniShipPreview";
import MiniWeaponPreview from "../shared/MiniWeaponPreview";
import ColorKeyPickerPanel from "@/ui/shared/ColorKeyPickerPanel";
import { resizeImage, ASSET_LIMITS } from "@/utils/file";
import "./ship-customization-modal.css";

interface LoadoutCustomizerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    networkManager: SocketNetworkManager;
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


function shortId(id: string): string {
    if (id.startsWith("preset:")) return id.slice(7);
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

async function applyColorKeyToDataUrl(sourceDataUrl: string, applyKeyColor?: { color: string; tolerance: number }): Promise<string> {
    if (!applyKeyColor || applyKeyColor.tolerance <= 0) return sourceDataUrl;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("图片解码失败"));
        el.src = sourceDataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return sourceDataUrl;

    ctx.drawImage(img, 0, 0);

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
    return canvas.toDataURL("image/png");
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
    const [weaponEditorTab, setWeaponEditorTab] = useState<"form" | "json">("form");

    const [shipPreviewZoom, setShipPreviewZoom] = useState(1);
    const [weaponPreviewZoom, setWeaponPreviewZoom] = useState(1);
    const [texturePreviewUrl, setTexturePreviewUrl] = useState<string | null>(null);
    const [weaponTexturePreviewUrl, setWeaponTexturePreviewUrl] = useState<string | null>(null);

    const [keyColor, setKeyColor] = useState("#000000");
    const [keyTolerance, setKeyTolerance] = useState(0);
    const [weaponKeyColor, setWeaponKeyColor] = useState("#000000");
    const [weaponKeyTolerance, setWeaponKeyTolerance] = useState(0);
    const [shipColorKeyPreviewUrl, setShipColorKeyPreviewUrl] = useState<string | null>(null);
    const [weaponColorKeyPreviewUrl, setWeaponColorKeyPreviewUrl] = useState<string | null>(null);
    const [isUploadingShipTexture, setIsUploadingShipTexture] = useState(false);
    const [isUploadingWeaponTexture, setIsUploadingWeaponTexture] = useState(false);
    const [shipImageDimensions, setShipImageDimensions] = useState<{ w: number; h: number } | null>(null);
    const [weaponImageDimensions, setWeaponImageDimensions] = useState<{ w: number; h: number } | null>(null);
    const [shipDragOver, setShipDragOver] = useState(false);
    const [weaponDragOver, setWeaponDragOver] = useState(false);

    const [shipSearch, setShipSearch] = useState("");
    const [weaponSearch, setWeaponSearch] = useState("");

    const [mountSelection, setMountSelection] = useState<string>("");
    const [loadError, setLoadError] = useState<string | null>(null);

    const [openSections, setOpenSections] = useState<Set<string>>(new Set(["texture", "attributes"]));
    const toggleSection = useCallback((id: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const [openWeaponSections, setOpenWeaponSections] = useState<Set<string>>(new Set(["texture", "attributes"]));
    const toggleWeaponSection = useCallback((id: string) => {
        setOpenWeaponSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);
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

    const send = networkManager.request.bind(networkManager);

    const reloadData = useCallback(async () => {
        if (!open) return;
        setLoadError(null);

        try {
            const responses = await Promise.all([
                send("customize:token", { action: "list" }) as Promise<CustomizeTokenListResponse>,
                send("customize:weapon", { action: "list" }) as Promise<CustomizeWeaponListResponse>,
                send("preset:list_tokens", {}) as Promise<PresetListTokensResponse>,
                send("preset:list_weapons", {}) as Promise<PresetListWeaponsResponse>,
            ]);

            const [shipListRes, weaponListRes, shipPresetRes, weaponPresetRes] = responses;

            setShipBuilds(shipListRes.ships ?? []);
            setWeaponBuilds(weaponListRes.weapons ?? []);
            setShipPresets(shipPresetRes.presets ?? []);
            setWeaponPresets(weaponPresetRes.presets ?? []);

            setSelectedShipBuildId((prev) => prev ?? (shipListRes.ships?.[0]?.$id ?? null));
            setSelectedWeaponBuildId((prev) => prev ?? (weaponListRes.weapons?.[0]?.$id ?? null));
        } catch (error) {
            console.error("reloadData error:", error);
            notify.error(error instanceof Error ? error.message : "加载失败");
            setLoadError(error instanceof Error ? error.message : "加载失败");
        }
    }, [send, open]);

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

    const loadTexturePreview = useCallback((assetId: string) => {
        setTexturePreviewUrl(textureManager.getTextureUrl(assetId));
    }, []);

    const loadWeaponTexturePreview = useCallback((assetId: string) => {
        setWeaponTexturePreviewUrl(textureManager.getTextureUrl(assetId));
    }, []);

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

    const isShipDirty = useMemo(() => {
        if (!shipDraft || !selectedShipBuildId) return false;
        const original = shipBuilds.find((item) => item.$id === selectedShipBuildId);
        if (!original) return false;
        return JSON.stringify(shipDraft) !== JSON.stringify(ensureShipDefaults(original));
    }, [shipDraft, selectedShipBuildId, shipBuilds]);

    const isWeaponDirty = useMemo(() => {
        if (!weaponDraft || !selectedWeaponBuildId) return false;
        const original = weaponBuilds.find((item) => item.$id === selectedWeaponBuildId);
        if (!original) return false;
        return JSON.stringify(weaponDraft) !== JSON.stringify(ensureWeaponDefaults(original));
    }, [weaponDraft, selectedWeaponBuildId, weaponBuilds]);

    const handleSelectShip = useCallback((id: string) => {
        if (id === selectedShipBuildId) return;
        if (isShipDirty && !window.confirm("当前修改未保存，是否放弃？")) return;
        setSelectedShipBuildId(id);
    }, [selectedShipBuildId, isShipDirty]);

    const handleSelectWeapon = useCallback((id: string) => {
        if (id === selectedWeaponBuildId) return;
        if (isWeaponDirty && !window.confirm("当前修改未保存，是否放弃？")) return;
        setSelectedWeaponBuildId(id);
    }, [selectedWeaponBuildId, isWeaponDirty]);

    const compatibleWeapons = useMemo(() => {
        if (!selectedMount) return [];
        return weaponBuilds.filter((item) => {
            return isWeaponSizeCompatible(selectedMount.size, item.spec.size);
        });
    }, [selectedMount, weaponBuilds]);

    const filteredShipBuilds = useMemo(() => {
        if (!shipSearch.trim()) return shipBuilds;
        const q = shipSearch.trim().toLowerCase();
        return shipBuilds.filter((item) => (item.metadata?.name ?? item.$id).toLowerCase().includes(q));
    }, [shipBuilds, shipSearch]);

    const filteredWeaponBuilds = useMemo(() => {
        if (!weaponSearch.trim()) return weaponBuilds;
        const q = weaponSearch.trim().toLowerCase();
        return weaponBuilds.filter((item) => (item.metadata?.name ?? item.$id).toLowerCase().includes(q));
    }, [weaponBuilds, weaponSearch]);

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

    const createShipBuild = useCallback(async () => {
        const base = shipPresets[0] ?? shipBuilds[0];
        if (!base) {
            notify.error("暂无可用模板，无法新增舰船");
            return;
        }

        const nextName = `新舰船 ${shipBuilds.length + 1}`;
        const token = ensureShipDefaults(clone(base));
        token.metadata = { ...(token.metadata ?? { name: nextName }), name: nextName };

        try {
            const res = await send("customize:token", {
                action: "upsert",
                token,
            }) as { ship?: InventoryToken };
            notify.success("已新增舰船");
            await reloadData();
            if (res.ship?.$id) setSelectedShipBuildId(res.ship.$id);
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "新增失败");
        }
    }, [send, reloadData, shipBuilds, shipPresets]);

    const createWeaponBuild = useCallback(async () => {
        const base = weaponPresets[0] ?? weaponBuilds[0];
        if (!base) {
            notify.error("暂无可用模板，无法新增武器");
            return;
        }

        const nextName = `新武器 ${weaponBuilds.length + 1}`;
        const weapon = ensureWeaponDefaults(clone(base));
        weapon.metadata = { ...(weapon.metadata ?? { name: nextName }), name: nextName };

        try {
            const res = await send("customize:weapon", {
                action: "upsert",
                weapon,
            }) as { weapon?: WeaponJSON };
            notify.success("已新增武器");
            await reloadData();
            if (res.weapon?.$id) setSelectedWeaponBuildId(res.weapon.$id);
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "新增失败");
        }
    }, [send, reloadData, weaponBuilds, weaponPresets]);

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
            await send("customize:token", {
                action: "upsert",
                tokenId: selectedShipBuildId,
                token: shipDraft,
            });
            notify.success("已保存");
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "保存失败");
        }
    }, [send, reloadData, selectedShipBuildId, shipDraft]);

    const saveWeapon = useCallback(async () => {
        if (!weaponDraft || !selectedWeaponBuildId) return;
        try {
            await send("customize:weapon", {
                action: "upsert",
                weaponId: selectedWeaponBuildId,
                weapon: weaponDraft,
            });
            notify.success("已保存");
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "保存失败");
        }
    }, [send, reloadData, selectedWeaponBuildId, weaponDraft]);

    const copyShipPreset = useCallback(async (presetId: string) => {
        try {
            const res = await send("customize:token", { action: "copy_preset", presetId }) as { ship?: InventoryToken };
            notify.success("已复制");
            await reloadData();
            if (res.ship?.$id) {
                setSelectedShipBuildId(res.ship.$id);
            }
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "复制失败");
        }
    }, [send, reloadData]);

    const copyWeaponPreset = useCallback(async (presetId: string) => {
        try {
            const res = await send("customize:weapon", { action: "copy_preset", presetId }) as { weapon?: WeaponJSON };
            notify.success("已复制");
            await reloadData();
            if (res.weapon?.$id) {
                setSelectedWeaponBuildId(res.weapon.$id);
            }
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "复制失败");
        }
    }, [send, reloadData]);

    const deleteShip = useCallback(async (shipId: string) => {
        try {
            await send("customize:token", { action: "delete", tokenId: shipId });
            notify.success("已删除");
            setSelectedShipBuildId(null);
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "删除失败");
        }
    }, [send, reloadData]);

    const deleteWeapon = useCallback(async (weaponId: string) => {
        try {
            await send("customize:weapon", { action: "delete", weaponId });
            notify.success("已删除");
            setSelectedWeaponBuildId(null);
            await reloadData();
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "删除失败");
        }
    }, [send, reloadData]);

    const handleShipTextureUpload = useCallback(async (file: File) => {
        setIsUploadingShipTexture(true);
        try {
            const oldAssetId = shipDraft?.spec.texture?.assetId;
            const limits = ASSET_LIMITS.ship_texture;
            const prepared = await resizeImage(file, limits.maxWidth, limits.maxHeight);
            const assetId = await assetSocket.upload("ship_texture", prepared);
            updateShipTexture({ assetId });
            loadTexturePreview(assetId);
            if (oldAssetId && oldAssetId !== assetId) {
                assetSocket.deleteAsset(oldAssetId).catch(() => {});
            }
        } catch (err) {
            console.error("Ship texture upload failed:", err);
            notify.error(err instanceof Error ? err.message : "上传失败");
        } finally {
            setIsUploadingShipTexture(false);
        }
    }, [assetSocket, updateShipTexture, loadTexturePreview, shipDraft]);

    const handleWeaponTextureUpload = useCallback(async (file: File) => {
        setIsUploadingWeaponTexture(true);
        try {
            const oldAssetId = weaponDraft?.spec.texture?.assetId;
            const limits = ASSET_LIMITS.weapon_texture;
            const prepared = await resizeImage(file, limits.maxWidth, limits.maxHeight);
            const assetId = await assetSocket.upload("weapon_texture", prepared);
            updateWeaponTexture({ assetId });
            loadWeaponTexturePreview(assetId);
            if (oldAssetId && oldAssetId !== assetId) {
                assetSocket.deleteAsset(oldAssetId).catch(() => {});
            }
        } catch (err) {
            console.error("Weapon texture upload failed:", err);
            notify.error(err instanceof Error ? err.message : "上传失败");
        } finally {
            setIsUploadingWeaponTexture(false);
        }
    }, [assetSocket, updateWeaponTexture, loadWeaponTexturePreview, weaponDraft]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleShipDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShipDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            void handleShipTextureUpload(file);
        }
    }, [handleShipTextureUpload]);

    const handleWeaponDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setWeaponDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            void handleWeaponTextureUpload(file);
        }
    }, [handleWeaponTextureUpload]);

    useEffect(() => {
        let disposed = false;

        const run = async () => {
            if (!texturePreviewUrl) {
                setShipColorKeyPreviewUrl(null);
                return;
            }
            if (keyTolerance <= 0) {
                setShipColorKeyPreviewUrl(texturePreviewUrl);
                return;
            }
            try {
                const next = await applyColorKeyToDataUrl(texturePreviewUrl, { color: keyColor, tolerance: keyTolerance });
                if (!disposed) setShipColorKeyPreviewUrl(next);
            } catch {
                if (!disposed) setShipColorKeyPreviewUrl(texturePreviewUrl);
            }
        };

        void run();
        return () => { disposed = true; };
    }, [texturePreviewUrl, keyColor, keyTolerance]);

    useEffect(() => {
        let disposed = false;

        const run = async () => {
            if (!weaponTexturePreviewUrl) {
                setWeaponColorKeyPreviewUrl(null);
                return;
            }
            if (weaponKeyTolerance <= 0) {
                setWeaponColorKeyPreviewUrl(weaponTexturePreviewUrl);
                return;
            }
            try {
                const next = await applyColorKeyToDataUrl(weaponTexturePreviewUrl, { color: weaponKeyColor, tolerance: weaponKeyTolerance });
                if (!disposed) setWeaponColorKeyPreviewUrl(next);
            } catch {
                if (!disposed) setWeaponColorKeyPreviewUrl(weaponTexturePreviewUrl);
            }
        };

        void run();
        return () => { disposed = true; };
    }, [weaponTexturePreviewUrl, weaponKeyColor, weaponKeyTolerance]);

    useEffect(() => {
        if (!texturePreviewUrl) {
            setShipImageDimensions(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setShipImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.src = texturePreviewUrl;
    }, [texturePreviewUrl]);

    useEffect(() => {
        if (!weaponTexturePreviewUrl) {
            setWeaponImageDimensions(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setWeaponImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.src = weaponTexturePreviewUrl;
    }, [weaponTexturePreviewUrl]);

    const shipPixelSize = Math.max(shipDraft?.spec.width ?? 40, shipDraft?.spec.length ?? 60);
    const shipFitScale = shipImageDimensions
        ? shipPixelSize / Math.max(shipImageDimensions.w, shipImageDimensions.h)
        : 1;
    const shipScaleMin = Math.max(0.05, shipFitScale * 0.1);
    const shipScaleMax = Math.max(2, shipFitScale * 3);
    const shipScaleStep = shipScaleMax > 5 ? 0.5 : shipScaleMax > 2 ? 0.1 : 0.05;

    const weaponPixelSize = 20;
    const weaponFitScale = weaponImageDimensions
        ? weaponPixelSize / Math.max(weaponImageDimensions.w, weaponImageDimensions.h)
        : 1;
    const weaponScaleMin = Math.max(0.05, weaponFitScale * 0.1);
    const weaponScaleMax = Math.max(2, weaponFitScale * 3);
    const weaponScaleStep = weaponScaleMax > 5 ? 0.5 : weaponScaleMax > 2 ? 0.1 : 0.05;

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                if (activeTopTab === "ship") {
                    void saveShip();
                } else {
                    void saveWeapon();
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, activeTopTab, saveShip, saveWeapon]);

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
        <Dialog.Root open={open} onOpenChange={(next) => {
            if (!next && (isShipDirty || isWeaponDirty)) {
                if (!window.confirm("有未保存的修改，确定关闭？")) return;
            }
            onOpenChange(next);
        }}>
            <Dialog.Content maxWidth="1200px">
                <Flex justify="between" align="center" mb="2">
                    <Dialog.Title>舰船 / 武器工坊</Dialog.Title>
                    <Dialog.Close>
                        <Button size="1" variant="ghost" color="gray">
                            <X size={14} />
                        </Button>
                    </Dialog.Close>
                </Flex>

                <Tabs.Root value={activeTopTab} onValueChange={(v) => setActiveTopTab(v as "ship" | "weapon")}>
                    <Tabs.List mb="3">
                        <Tabs.Trigger value="ship">舰船</Tabs.Trigger>
                        <Tabs.Trigger value="weapon">武器</Tabs.Trigger>
                    </Tabs.List>

                    {activeTopTab === "ship" && (
                        <Grid columns="260px 1fr" gap="4">
                            <Card>
                                <Flex justify="between" align="center" mb="2">
                                    <Text weight="bold">舰船存档</Text>
                                    <Button size="1" variant="soft" onClick={() => void createShipBuild()} data-magnetic>
                                        <Plus size={12} /> 新增
                                    </Button>
                                </Flex>
                                <TextField.Root
                                    className="customizer-search"
                                    size="1"
                                    placeholder="搜索舰船..."
                                    value={shipSearch}
                                    onChange={(e) => setShipSearch(e.target.value)}
                                >
                                    <TextField.Slot>
                                        <Search size={12} />
                                    </TextField.Slot>
                                </TextField.Root>
                                <Box className="customizer-sidebar">
                                    <Flex direction="column" gap="2">
                                        {filteredShipBuilds.map((item) => {
                                            const selected = selectedShipBuildId === item.$id;
                                            return (
                                                <Flex
                                                    key={item.$id}
                                                    className={`customizer-list-item${selected ? " customizer-list-item--selected" : ""}`}
                                                    onClick={() => handleSelectShip(item.$id)}
                                                >
                                                    <Box className="customizer-list-item__info">
                                                        <Text size="2" className="customizer-list-item__name">
                                                            {item.metadata?.name ?? shortId(item.$id)}
                                                            {item.$id === selectedShipBuildId && isShipDirty && <span style={{ color: "var(--orange-9)", marginLeft: 4 }}>●</span>}
                                                        </Text>
                                                        <Text size="1" color="gray">{item.spec.size}/{item.spec.class}</Text>
                                                    </Box>
                                                    <Button
                                                        size="1"
                                                        variant="ghost"
                                                        color="red"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`确定删除舰船 "${item.metadata?.name ?? shortId(item.$id)}"？`)) {
                                                                void deleteShip(item.$id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </Flex>
                                            );
                                        })}
                                        {shipBuilds.length === 0 && <Text color="gray" size="1">暂无舰船存档</Text>}
                                        {shipBuilds.length > 0 && filteredShipBuilds.length === 0 && <Text color="gray" size="1">无匹配结果</Text>}
                                    </Flex>
                                </Box>
                            </Card>

                            <Flex direction="column" style={{ maxHeight: "calc(80vh - 100px)" }}>
                                <Flex direction="column" style={{ overflowY: "auto", flex: 1 }}>
                                    <Card style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                        <Flex justify="between" align="center" mb="2">
                                            <Text weight="bold">舰船</Text>
                                        </Flex>
                                        <MiniShipPreview
                                            token={shipDraft}
                                            zoom={shipPreviewZoom}
                                            onZoomChange={setShipPreviewZoom}
                                            texturePreviewUrl={shipColorKeyPreviewUrl}
                                            onTextureOffsetChange={(dx, dy) => {
                                                const currentX = shipDraft?.spec.texture?.offsetX ?? 0;
                                                const currentY = shipDraft?.spec.texture?.offsetY ?? 0;
                                                updateShipTexture({ offsetX: Math.round(currentX + dx), offsetY: Math.round(currentY + dy) });
                                            }}
                                        />
                                        <Flex justify="center" gap="2" mt="1">
                                            <Button size="1" variant="ghost" onClick={() => setShipPreviewZoom(Math.max(0.2, shipPreviewZoom - 0.25))}>-</Button>
                                            <Text size="1">{shipPreviewZoom.toFixed(2)}x</Text>
                                            <Button size="1" variant="ghost" onClick={() => setShipPreviewZoom(Math.min(4, shipPreviewZoom + 0.25))}>+</Button>
                                        </Flex>
                                    </Card>

                                    <Card
                                        mt="3"
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e: React.DragEvent) => { e.preventDefault(); setShipDragOver(true); }}
                                        onDragLeave={() => setShipDragOver(false)}
                                        onDrop={handleShipDrop}
                                        style={shipDragOver ? { outline: "2px dashed #4a9eff", outlineOffset: -2 } : undefined}
                                    >
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleSection("texture")}>
                                            <Flex align="center" gap="2">
                                                <Text weight="bold">贴图调整</Text>
                                                <Flex gap="2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                    {shipDraft?.spec.texture?.assetId && (
                                                        <Button size="1" variant="soft" color="red" onClick={() => {
                                                            const oldId = shipDraft?.spec.texture?.assetId;
                                                            updateShipTexture({ assetId: undefined });
                                                            setTexturePreviewUrl(null);
                                                            setShipColorKeyPreviewUrl(null);
                                                            if (oldId) assetSocket.deleteAsset(oldId).catch(() => {});
                                                        }} data-magnetic>
                                                            <Trash2 size={12} /> 删除
                                                        </Button>
                                                    )}
                                                    <Button size="1" variant="solid" color="blue"
                                                        onClick={() => shipTextureInputRef.current?.click()}
                                                        disabled={isUploadingShipTexture}
                                                        data-magnetic>
                                                        {isUploadingShipTexture ? (
                                                            <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> 上传中...</>
                                                        ) : (
                                                            <><Upload size={12} /> 选择图片</>
                                                        )}
                                                    </Button>
                                                </Flex>
                                            </Flex>
                                            <ChevronDown size={14} style={{ transform: openSections.has("texture") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openSections.has("texture") && (
                                        <Flex direction="column" gap="2" mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                                            <Separator size="2" />

                                            <Flex direction="column" gap="2">
                                                <Text size="1" weight="bold">贴图位置调整</Text>
                                                <Flex direction="column" gap="2">
                                                    <Box>
                                                        <Text size="1" color="gray">X 偏移（左舷为正）</Text>
                                                        <Flex align="center" gap="2">
                                                            <input
                                                                className="customizer-range"
                                                                type="range"
                                                                min={-100}
                                                                max={100}
                                                                value={shipDraft?.spec.texture?.offsetX ?? 0}
                                                                onChange={(e) => updateShipTexture({ offsetX: Number(e.target.value) })}
                                                                style={{ flex: 1 }}
                                                            />
                                                            <input type="number"
                                                                value={shipDraft?.spec.texture?.offsetX ?? 0}
                                                                onChange={(e) => updateShipTexture({ offsetX: Number(e.target.value) || 0 })}
                                                                style={{ width: 52, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
                                                        </Flex>
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">Y 偏移（船头为正）</Text>
                                                        <Flex align="center" gap="2">
                                                            <input
                                                                className="customizer-range"
                                                                type="range"
                                                                min={-100}
                                                                max={100}
                                                                value={shipDraft?.spec.texture?.offsetY ?? 0}
                                                                onChange={(e) => updateShipTexture({ offsetY: Number(e.target.value) })}
                                                                style={{ flex: 1 }}
                                                            />
                                                            <input type="number"
                                                                value={shipDraft?.spec.texture?.offsetY ?? 0}
                                                                onChange={(e) => updateShipTexture({ offsetY: Number(e.target.value) || 0 })}
                                                                style={{ width: 52, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
                                                        </Flex>
                                                    </Box>
                                                    <Box>
                                                        <Text size="1" color="gray">缩放比例</Text>
                                                        <Flex align="center" gap="2">
                                                            <input
                                                                className="customizer-range"
                                                                type="range"
                                                                min={shipScaleMin}
                                                                max={shipScaleMax}
                                                                step={shipScaleStep}
                                                                value={shipDraft?.spec.texture?.scale ?? 1}
                                                                onChange={(e) => updateShipTexture({ scale: Number(e.target.value) })}
                                                                style={{ flex: 1 }}
                                                            />
                                                            <input type="number"
                                                                value={shipDraft?.spec.texture?.scale ?? 1}
                                                                onChange={(e) => updateShipTexture({ scale: Number(e.target.value) || 0 })}
                                                                step={shipScaleStep}
                                                                style={{ width: 52, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
                                                        </Flex>
                                                    </Box>
                                                </Flex>
                                            </Flex>

                                            <Separator size="2" />

                                            <ColorKeyPickerPanel
                                                color={keyColor}
                                                tolerance={keyTolerance}
                                                onColorChange={setKeyColor}
                                                onToleranceChange={setKeyTolerance}
                                                previewImageUrl={texturePreviewUrl}
                                            />

                                            <Separator size="2" />
                                            <Flex justify="end">
                                                <Button size="1" onClick={() => void saveShip()} color={isShipDirty ? "green" : undefined} disabled={!isShipDirty} data-magnetic>
                                                    <Save size={14} /> 保存贴图设置
                                                </Button>
                                            </Flex>
                                        </Flex>
                                        )}

                                        <input
                                            ref={shipTextureInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                void handleShipTextureUpload(file);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                    </Card>

                                    <Card mt="3">
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleSection("mounts")}>
                                            <Text weight="bold">挂点管理</Text>
                                            <ChevronDown size={14} style={{ transform: openSections.has("mounts") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openSections.has("mounts") && (
                                        <Box mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                                        <Grid columns="30% 70%" gap="4">
                                            <Box style={{ borderRight: "1px solid rgba(255,255,255,0.1)", paddingRight: 16 }}>
                                                <Button
                                                    size="1"
                                                    variant="soft"
                                                    onClick={() => {
                                                        const existingIds = shipDraft?.spec.mounts?.map((m) => m.id) ?? [];
                                                        let newId = "mount_1";
                                                        let counter = 1;
                                                        while (existingIds.includes(newId)) {
                                                            counter++;
                                                            newId = `mount_${counter}`;
                                                        }
                                                        updateShipDraft((draft) => {
                                                            draft.spec.mounts = draft.spec.mounts ?? [];
                                                            draft.spec.mounts.push({
                                                                id: newId,
                                                                size: WeaponSlotSize.SMALL,
                                                                position: { x: 0, y: 0 },
                                                                arc: 360,
                                                            });
                                                        });
                                                        setMountSelection(newId);
                                                        notify.success("已添加挂点");
                                                    }}
                                                    data-magnetic
                                                >
                                                    <Plus size={12} /> 添加挂点
                                                </Button>

                                                <Box mt="2" style={{ maxHeight: 300, overflowY: "auto" }}>
                                                    {shipDraft?.spec.mounts?.length ? (
                                                        <Flex direction="column" gap="1">
                                                            {shipDraft.spec.mounts.map((mount) => (
                                                                <Flex
                                                                    key={mount.id}
                                                                    className={`customizer-list-item${mountSelection === mount.id ? " customizer-list-item--selected" : ""}`}
                                                                    onClick={() => setMountSelection(mount.id)}
                                                                >
                                                                    <Box className="customizer-list-item__info">
                                                                        <Text size="1" className="customizer-list-item__name">
                                                                            {mount.displayName ?? mount.id}
                                                                        </Text>
                                                                        <Badge size="1">{mount.size}</Badge>
                                                                    </Box>
                                                                    <Button
                                                                        size="1"
                                                                        variant="ghost"
                                                                        color="red"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm(`确定删除挂点 "${mount.displayName ?? mount.id}"？`)) {
                                                                                updateShipDraft((draft) => {
                                                                                    draft.spec.mounts = draft.spec.mounts?.filter((m) => m.id !== mount.id) ?? [];
                                                                                });
                                                                                if (mountSelection === mount.id) {
                                                                                    setMountSelection("");
                                                                                }
                                                                                notify.success("已删除挂点");
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </Button>
                                                                </Flex>
                                                            ))}
                                                        </Flex>
                                                    ) : (
                                                        <Text color="gray" size="1">暂无挂点</Text>
                                                    )}
                                                </Box>
                                            </Box>

                                            <Box>
                                                {selectedMount ? (
                                                    <Flex direction="column" gap="3">
                                                        <Box>
                                                            <Text size="1" color="gray">显示名称</Text>
                                                            <TextField.Root
                                                                value={selectedMount.displayName ?? selectedMount.id}
                                                                onChange={(e) => {
                                                                    updateShipDraft((draft) => {
                                                                        const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                        if (mount) mount.displayName = e.target.value;
                                                                    });
                                                                }}
                                                            />
                                                        </Box>

                                                        <Box>
                                                            <Text size="1" color="gray">尺寸</Text>
                                                            <Select.Root
                                                                value={selectedMount.size}
                                                                onValueChange={(v) => {
                                                                    updateShipDraft((draft) => {
                                                                        const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                        if (mount) {
                                                                            mount.size = v as WeaponSlotSize;
                                                                            mount.weapon = undefined;
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                <Select.Trigger />
                                                                <Select.Content>
                                                                    {Object.values(WeaponSlotSize).map((v) => (
                                                                        <Select.Item key={v} value={v}>{v}</Select.Item>
                                                                    ))}
                                                                </Select.Content>
                                                            </Select.Root>
                                                        </Box>

                                                        <Grid columns="2" gap="2">
                                                            <Box>
                                                                <Text size="1" color="gray">X 偏移（左舷为正）</Text>
                                                                <Flex align="center" gap="2">
                                                                    <input
                                                                        className="customizer-range"
                                                                        type="range"
                                                                        min={-500}
                                                                        max={500}
                                                                        value={selectedMount.position?.x ?? 0}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value);
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.position = { ...(mount.position ?? { x: 0, y: 0 }), x: value };
                                                                            });
                                                                        }}
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    <TextField.Root
                                                                        type="number"
                                                                        value={String(selectedMount.position?.x ?? 0)}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value) || 0;
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.position = { ...(mount.position ?? { x: 0, y: 0 }), x: value };
                                                                            });
                                                                        }}
                                                                        style={{ width: 60 }}
                                                                    />
                                                                </Flex>
                                                            </Box>

                                                            <Box>
                                                                <Text size="1" color="gray">Y 偏移（船头为正）</Text>
                                                                <Flex align="center" gap="2">
                                                                    <input
                                                                        className="customizer-range"
                                                                        type="range"
                                                                        min={-500}
                                                                        max={500}
                                                                        value={selectedMount.position?.y ?? 0}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value);
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.position = { ...(mount.position ?? { x: 0, y: 0 }), y: value };
                                                                            });
                                                                        }}
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    <TextField.Root
                                                                        type="number"
                                                                        value={String(selectedMount.position?.y ?? 0)}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value) || 0;
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.position = { ...(mount.position ?? { x: 0, y: 0 }), y: value };
                                                                            });
                                                                        }}
                                                                        style={{ width: 60 }}
                                                                    />
                                                                </Flex>
                                                            </Box>
                                                        </Grid>

                                                        <Grid columns="2" gap="2">
                                                            <Box>
                                                                <Text size="1" color="gray">朝向角度</Text>
                                                                <Flex align="center" gap="2">
                                                                    <input
                                                                        className="customizer-range"
                                                                        type="range"
                                                                        min={-180}
                                                                        max={180}
                                                                        value={selectedMount.facing ?? 0}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value);
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.facing = value;
                                                                            });
                                                                        }}
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    <TextField.Root
                                                                        type="number"
                                                                        value={String(selectedMount.facing ?? 0)}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value) || 0;
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.facing = value;
                                                                            });
                                                                        }}
                                                                        style={{ width: 60 }}
                                                                    />
                                                                </Flex>
                                                            </Box>

                                                            <Box>
                                                                <Text size="1" color="gray">射界角度</Text>
                                                                <Flex align="center" gap="2">
                                                                    <input
                                                                        className="customizer-range"
                                                                        type="range"
                                                                        min={0}
                                                                        max={360}
                                                                        value={selectedMount.arc ?? 360}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value);
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.arc = value;
                                                                            });
                                                                        }}
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    <TextField.Root
                                                                        type="number"
                                                                        value={String(selectedMount.arc ?? 360)}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value) || 0;
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.arc = value;
                                                                            });
                                                                        }}
                                                                        style={{ width: 60 }}
                                                                    />
                                                                </Flex>
                                                            </Box>
                                                        </Grid>

                                                        <Box>
                                                            <Text size="1" color="gray">武器挂载</Text>
                                                            <Flex align="center" gap="2">
                                                                <Select.Root
                                                                    value={selectedMount.weapon?.$id ?? "__NONE__"}
                                                                    onValueChange={(v) => {
                                                                        if (v === "__NONE__") {
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.weapon = undefined;
                                                                            });
                                                                            return;
                                                                        }
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
                                                                        <Select.Item value="__NONE__">不装载</Select.Item>
                                                                        {compatibleWeapons.map((item) => (
                                                                            <Select.Item key={item.$id} value={item.$id}>
                                                                                {item.metadata?.name ?? shortId(item.$id)} ({item.spec.size})
                                                                            </Select.Item>
                                                                        ))}
                                                                    </Select.Content>
                                                                </Select.Root>
                                                                {selectedMount.weapon && (
                                                                    <Button
                                                                        size="1"
                                                                        variant="ghost"
                                                                        color="red"
                                                                        onClick={() => {
                                                                            updateShipDraft((draft) => {
                                                                                const mount = draft.spec.mounts?.find((m) => m.id === selectedMount.id);
                                                                                if (mount) mount.weapon = undefined;
                                                                            });
                                                                        }}
                                                                    >
                                                                        卸载
                                                                    </Button>
                                                                )}
                                                            </Flex>
                                                        </Box>
                                                    </Flex>
                                                ) : (
                                                    <Flex align="center" justify="center" style={{ height: 200 }}>
                                                        <Text color="gray" size="2">请选择挂点</Text>
                                                    </Flex>
                                                )}
                                            </Box>
                                        </Grid>
                                        </Box>
                                        )}
                                    </Card>

                                    <Card mt="3">
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleSection("attributes")}>
                                            <Flex align="center" gap="2">
                                                <Text weight="bold">属性编辑</Text>
                                                <Tabs.Root value={editorTab} onValueChange={(v) => { v && setEditorTab(v as "form" | "json"); }}>
                                                    <Tabs.List onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                        <Tabs.Trigger value="form">表单</Tabs.Trigger>
                                                        <Tabs.Trigger value="json">JSON</Tabs.Trigger>
                                                    </Tabs.List>
                                                </Tabs.Root>
                                            </Flex>
                                            <ChevronDown size={14} style={{ transform: openSections.has("attributes") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openSections.has("attributes") && (
                                        <Box mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>

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

                                        </Box>
                                        )}
                                    </Card>

                                    <Card mt="3">
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleSection("presets")}>
                                            <Text weight="bold">预设模板</Text>
                                            <ChevronDown size={14} style={{ transform: openSections.has("presets") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openSections.has("presets") && (
                                        <Box mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                                        <Flex direction="column" gap="1">
                                            {shipPresets.map((preset) => (
                                                <Flex key={preset.$id} justify="between" align="center" gap="2" py="1">
                                                    <Box style={{ minWidth: 0, flex: 1 }}>
                                                        <Text size="2" className="customizer-list-item__name">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
                                                        <Text size="1" color="gray">{preset.spec.size}/{preset.spec.class} · HP {preset.spec.maxHitPoints} · {preset.spec.mounts?.length ?? 0} 挂点</Text>
                                                    </Box>
                                                    <Button size="1" variant="ghost" onClick={() => void copyShipPreset(preset.$id)}><Copy size={12} /></Button>
                                                </Flex>
                                            ))}
                                        </Flex>
                                        </Box>
                                        )}
                                    </Card>

                                    <Box style={{ height: 48 }} />
                                </Flex>

                                <Flex
                                    justify="between"
                                    align="center"
                                    px="3"
                                    py="2"
                                    style={{
                                        borderTop: "1px solid rgba(43, 66, 97, 0.6)",
                                        background: "var(--color-panel)",
                                    }}
                                >
                                    <Flex align="center" gap="2">
                                        {isShipDirty && (
                                            <Badge color="orange" size="1">未保存</Badge>
                                        )}
                                        <Text size="1" color="gray">Ctrl+S 快速保存</Text>
                                    </Flex>
                                    <Button onClick={() => void saveShip()} color={isShipDirty ? "green" : undefined} disabled={!isShipDirty} data-magnetic>
                                        <Save size={14} /> 保存
                                    </Button>
                                </Flex>
                            </Flex>
                        </Grid>
                    )}

                    {activeTopTab === "weapon" && (
                        <Grid columns="260px 1fr" gap="4">
                            <Card>
                                <Flex justify="between" align="center" mb="2">
                                    <Text weight="bold">武器存档</Text>
                                    <Button size="1" variant="soft" onClick={() => void createWeaponBuild()} data-magnetic>
                                        <Plus size={12} /> 新增
                                    </Button>
                                </Flex>
                                <TextField.Root
                                    className="customizer-search"
                                    size="1"
                                    placeholder="搜索武器..."
                                    value={weaponSearch}
                                    onChange={(e) => setWeaponSearch(e.target.value)}
                                >
                                    <TextField.Slot>
                                        <Search size={12} />
                                    </TextField.Slot>
                                </TextField.Root>
                                <Box className="customizer-sidebar">
                                    <Flex direction="column" gap="2">
                                        {filteredWeaponBuilds.map((item) => {
                                            const selected = selectedWeaponBuildId === item.$id;
                                            return (
                                                <Flex
                                                    key={item.$id}
                                                    className={`customizer-list-item${selected ? " customizer-list-item--selected" : ""}`}
                                                    onClick={() => handleSelectWeapon(item.$id)}
                                                >
                                                    <Box className="customizer-list-item__info">
                                                        <Text size="2" className="customizer-list-item__name">
                                                            {item.metadata?.name ?? shortId(item.$id)}
                                                            {item.$id === selectedWeaponBuildId && isWeaponDirty && <span style={{ color: "var(--orange-9)", marginLeft: 4 }}>●</span>}
                                                        </Text>
                                                        <Text size="1" color="gray">{item.spec.size}/{item.spec.damageType}</Text>
                                                    </Box>
                                                    <Button
                                                        size="1"
                                                        variant="ghost"
                                                        color="red"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`确定删除武器 "${item.metadata?.name ?? shortId(item.$id)}"？`)) {
                                                                void deleteWeapon(item.$id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </Flex>
                                            );
                                        })}
                                        {weaponBuilds.length === 0 && <Text color="gray" size="1">暂无武器存档</Text>}
                                        {weaponBuilds.length > 0 && filteredWeaponBuilds.length === 0 && <Text color="gray" size="1">无匹配结果</Text>}
                                    </Flex>
                                </Box>
                            </Card>

                            <Flex direction="column" style={{ maxHeight: "calc(80vh - 100px)" }}>
                                <Flex direction="column" style={{ overflowY: "auto", flex: 1 }}>
                                    <Card style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                        <Flex justify="between" align="center" mb="2">
                                            <Text weight="bold">武器</Text>
                                        </Flex>
                                        <Flex direction="column" gap="2">
                                            {weaponDraft && (
                                                <MiniWeaponPreview
                                                    weapon={weaponDraft}
                                                    texturePreviewUrl={weaponColorKeyPreviewUrl}
                                                    zoom={weaponPreviewZoom}
                                                    onZoomChange={setWeaponPreviewZoom}
                                                    onTextureOffsetChange={(dx, dy) => {
                                                        const currentX = weaponDraft?.spec.texture?.offsetX ?? 0;
                                                        const currentY = weaponDraft?.spec.texture?.offsetY ?? 0;
                                                        updateWeaponTexture({ offsetX: Math.round(currentX + dx), offsetY: Math.round(currentY + dy) });
                                                    }}
                                                />
                                            )}
                                            {!weaponDraft && (
                                                <Text size="1" color="gray">请先选择武器</Text>
                                            )}
                                        </Flex>
                                        <Flex justify="center" gap="2" mt="1">
                                            <Button size="1" variant="ghost" onClick={() => setWeaponPreviewZoom(Math.max(0.2, weaponPreviewZoom - 0.25))}>-</Button>
                                            <Text size="1">{weaponPreviewZoom.toFixed(2)}x</Text>
                                            <Button size="1" variant="ghost" onClick={() => setWeaponPreviewZoom(Math.min(4, weaponPreviewZoom + 0.25))}>+</Button>
                                        </Flex>
                                    </Card>

                                    <Card
                                        mt="3"
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e: React.DragEvent) => { e.preventDefault(); setWeaponDragOver(true); }}
                                        onDragLeave={() => setWeaponDragOver(false)}
                                        onDrop={handleWeaponDrop}
                                        style={weaponDragOver ? { outline: "2px dashed #4a9eff", outlineOffset: -2 } : undefined}
                                    >
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleWeaponSection("texture")}>
                                            <Flex align="center" gap="2">
                                                <Text weight="bold">贴图调整</Text>
                                                <Flex gap="2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                    {weaponDraft?.spec.texture?.assetId && (
                                                        <Button size="1" variant="soft" color="red" onClick={() => {
                                                            const oldId = weaponDraft?.spec.texture?.assetId;
                                                            updateWeaponTexture({ assetId: undefined });
                                                            setWeaponTexturePreviewUrl(null);
                                                            setWeaponColorKeyPreviewUrl(null);
                                                            if (oldId) assetSocket.deleteAsset(oldId).catch(() => {});
                                                        }} data-magnetic>
                                                            <Trash2 size={12} /> 删除
                                                        </Button>
                                                    )}
                                                    <Button size="1" variant="solid" color="blue"
                                                        onClick={() => weaponTextureInputRef.current?.click()}
                                                        disabled={isUploadingWeaponTexture}
                                                        data-magnetic>
                                                        {isUploadingWeaponTexture ? (
                                                            <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> 上传中...</>
                                                        ) : (
                                                            <><Upload size={12} /> 选择图片</>
                                                        )}
                                                    </Button>
                                                </Flex>
                                            </Flex>
                                            <ChevronDown size={14} style={{ transform: openWeaponSections.has("texture") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openWeaponSections.has("texture") && weaponDraft && (
                                        <Flex direction="column" gap="2" mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                                            <Separator size="2" />

                                            <Text size="1" weight="bold">贴图位置调整</Text>
                                            <Flex direction="column" gap="2">
                                                <Box>
                                                    <Text size="1" color="gray">X 偏移（左舷为正）</Text>
                                                    <Flex align="center" gap="2">
                                                        <input
                                                            className="customizer-range"
                                                            type="range"
                                                            min={-100}
                                                            max={100}
                                                            value={weaponDraft.spec.texture?.offsetX ?? 0}
                                                            onChange={(e) => updateWeaponTexture({ offsetX: Number(e.target.value) })}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <input type="number"
                                                            value={weaponDraft.spec.texture?.offsetX ?? 0}
                                                            onChange={(e) => updateWeaponTexture({ offsetX: Number(e.target.value) || 0 })}
                                                            style={{ width: 52, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
                                                    </Flex>
                                                </Box>
                                                <Box>
                                                    <Text size="1" color="gray">Y 偏移（船头为正）</Text>
                                                    <Flex align="center" gap="2">
                                                        <input
                                                            className="customizer-range"
                                                            type="range"
                                                            min={-100}
                                                            max={100}
                                                            value={weaponDraft.spec.texture?.offsetY ?? 0}
                                                            onChange={(e) => updateWeaponTexture({ offsetY: Number(e.target.value) })}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <input type="number"
                                                            value={weaponDraft.spec.texture?.offsetY ?? 0}
                                                            onChange={(e) => updateWeaponTexture({ offsetY: Number(e.target.value) || 0 })}
                                                            style={{ width: 52, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
                                                    </Flex>
                                                </Box>
                                                <Box>
                                                    <Text size="1" color="gray">缩放比例</Text>
                                                    <Flex align="center" gap="2">
                                                        <input
                                                            className="customizer-range"
                                                            type="range"
                                                            min={weaponScaleMin}
                                                            max={weaponScaleMax}
                                                            step={weaponScaleStep}
                                                            value={weaponDraft.spec.texture?.scale ?? 1}
                                                            onChange={(e) => updateWeaponTexture({ scale: Number(e.target.value) })}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <input type="number"
                                                            value={weaponDraft.spec.texture?.scale ?? 1}
                                                            onChange={(e) => updateWeaponTexture({ scale: Number(e.target.value) || 0 })}
                                                            step={weaponScaleStep}
                                                            style={{ width: 52, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
                                                    </Flex>
                                                </Box>
                                            </Flex>

                                            <Separator size="2" />

                                            <ColorKeyPickerPanel
                                                color={weaponKeyColor}
                                                tolerance={weaponKeyTolerance}
                                                onColorChange={setWeaponKeyColor}
                                                onToleranceChange={setWeaponKeyTolerance}
                                                previewImageUrl={weaponTexturePreviewUrl}
                                            />

                                            <Separator size="2" />
                                            <Flex justify="end">
                                                <Button size="1" onClick={() => void saveWeapon()} color={isWeaponDirty ? "green" : undefined} disabled={!isWeaponDirty} data-magnetic>
                                                    <Save size={14} /> 保存贴图设置
                                                </Button>
                                            </Flex>
                                        </Flex>
                                        )}

                                        <input
                                            ref={weaponTextureInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                void handleWeaponTextureUpload(file);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                    </Card>

                                    <Card mt="3">
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleWeaponSection("attributes")}>
                                            <Flex align="center" gap="2">
                                                <Text weight="bold">属性编辑</Text>
                                                <Tabs.Root value={weaponEditorTab} onValueChange={(v) => { v && setWeaponEditorTab(v as "form" | "json"); }}>
                                                    <Tabs.List onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                        <Tabs.Trigger value="form">表单</Tabs.Trigger>
                                                        <Tabs.Trigger value="json">JSON</Tabs.Trigger>
                                                    </Tabs.List>
                                                </Tabs.Root>
                                            </Flex>
                                            <ChevronDown size={14} style={{ transform: openWeaponSections.has("attributes") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openWeaponSections.has("attributes") && (
                                        <Box mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>

                                        {weaponEditorTab === "form" && weaponDraft && (
                                            <Flex direction="column" gap="3">
                                                <Box>
                                                    <Text size="1" weight="bold" mb="1">基本信息</Text>
                                                    <Grid columns="2" gap="2">
                                                        <Box>
                                                            <Text size="1" color="gray">名称</Text>
                                                            <TextField.Root
                                                                value={weaponDraft.metadata?.name ?? ""}
                                                                onChange={(e) => updateWeaponDraft((d) => { d.metadata = { ...(d.metadata ?? { name: d.$id }), name: e.target.value }; })}
                                                            />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">描述</Text>
                                                            <TextField.Root
                                                                value={weaponDraft.metadata?.description ?? ""}
                                                                onChange={(e) => updateWeaponDraft((d) => { d.metadata = { ...(d.metadata ?? { name: d.$id }), description: e.target.value }; })}
                                                            />
                                                        </Box>
                                                    </Grid>
                                                </Box>

                                                <Box>
                                                    <Text size="1" weight="bold" mb="1">武器规格</Text>
                                                    <Grid columns="3" gap="2">
                                                        <Box>
                                                            <Text size="1" color="gray">槽位尺寸</Text>
                                                            <Select.Root value={weaponDraft.spec.size} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.size = v as WeaponSlotSize; })}>
                                                                <Select.Trigger />
                                                                <Select.Content>{Object.values(WeaponSlotSize).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                            </Select.Root>
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">伤害类型</Text>
                                                            <Select.Root value={weaponDraft.spec.damageType} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.damageType = v as DamageType; })}>
                                                                <Select.Trigger />
                                                                <Select.Content>{Object.values(DamageType).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                            </Select.Root>
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">基础伤害</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.damage)} onChange={(e) => updateWeaponDraft((d) => { d.spec.damage = Number(e.target.value) || 0; })} />
                                                        </Box>
                                                    </Grid>
                                                </Box>

                                                <Box>
                                                    <Text size="1" weight="bold" mb="1">射击参数</Text>
                                                    <Grid columns="4" gap="2">
                                                        <Box>
                                                            <Text size="1" color="gray">最大射程</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.range)} onChange={(e) => updateWeaponDraft((d) => { d.spec.range = Number(e.target.value) || 0; })} />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">最小射程</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.minRange ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.minRange = Number(e.target.value) || 0; })} />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">冷却时间</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.cooldown ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.cooldown = Number(e.target.value) || 0; })} />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">辐能/发</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.fluxCostPerShot)} onChange={(e) => updateWeaponDraft((d) => { d.spec.fluxCostPerShot = Number(e.target.value) || 0; })} />
                                                        </Box>
                                                    </Grid>

                                                    <Grid columns="4" gap="2" mt="2">
                                                        <Box>
                                                            <Text size="1" color="gray">弹丸/发</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.projectilesPerShot ?? 1)} onChange={(e) => updateWeaponDraft((d) => { d.spec.projectilesPerShot = Number(e.target.value) || 1; })} />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">连发次数</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.burstCount ?? 1)} onChange={(e) => updateWeaponDraft((d) => { d.spec.burstCount = Number(e.target.value) || 1; })} />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">OP 成本</Text>
                                                            <TextField.Root type="number" value={String(weaponDraft.spec.opCost ?? 0)} onChange={(e) => updateWeaponDraft((d) => { d.spec.opCost = Number(e.target.value) || 0; })} />
                                                        </Box>
                                                        <Box>
                                                            <Text size="1" color="gray">多目标射击</Text>
                                                            <Select.Root value={weaponDraft.spec.allowsMultipleTargets ? "YES" : "NO"} onValueChange={(v) => updateWeaponDraft((d) => { d.spec.allowsMultipleTargets = v === "YES"; })}>
                                                                <Select.Trigger />
                                                                <Select.Content>
                                                                    <Select.Item value="NO">否</Select.Item>
                                                                    <Select.Item value="YES">是</Select.Item>
                                                                </Select.Content>
                                                            </Select.Root>
                                                        </Box>
                                                    </Grid>
                                                </Box>

                                                <Box>
                                                    <Text size="1" weight="bold" mb="1">标签</Text>
                                                    <Flex gap="1" align="center" wrap="wrap">
                                                        {(weaponDraft.spec.tags ?? []).map((tag) => (
                                                            <Badge key={tag} size="1">
                                                                {tag}
                                                                <X
                                                                    size={10}
                                                                    style={{ marginLeft: 4, cursor: "pointer" }}
                                                                    onClick={() => updateWeaponDraft((d) => { d.spec.tags = (d.spec.tags ?? []).filter((t) => t !== tag); })}
                                                                />
                                                            </Badge>
                                                        ))}
                                                        <Select.Root onValueChange={(v) => {
                                                            const tag = v as WeaponTag;
                                                            if (tag && !weaponDraft.spec.tags?.includes(tag)) {
                                                                updateWeaponDraft((d) => { d.spec.tags = [...(d.spec.tags ?? []), tag]; });
                                                            }
                                                        }}>
                                                            <Select.Trigger placeholder="添加标签" />
                                                            <Select.Content>{WeaponTagValues.filter((v) => !(weaponDraft.spec.tags ?? []).includes(v)).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                                                        </Select.Root>
                                                    </Flex>
                                                </Box>
                                            </Flex>
                                        )}

                                        {weaponEditorTab === "json" && (
                                            <Flex direction="column" gap="2">
                                                <TextArea rows={20} value={weaponRawJson} onChange={(e) => setWeaponRawJson(e.target.value)} />
                                                <Flex gap="2" mt="2">
                                                    <Button variant="soft" onClick={validateWeaponRaw}>校验</Button>
                                                    <Button variant="ghost" onClick={() => navigator.clipboard.writeText(weaponRawJson)}><Copy size={12} /></Button>
                                                </Flex>
                                            </Flex>
                                        )}

                                        </Box>
                                        )}
                                    </Card>

                                    <Card mt="3">
                                        <Flex justify="between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleWeaponSection("presets")}>
                                            <Text weight="bold">预设模板</Text>
                                            <ChevronDown size={14} style={{ transform: openWeaponSections.has("presets") ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                                        </Flex>
                                        {openWeaponSections.has("presets") && (
                                        <Box mt="2" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                                        <Flex direction="column" gap="1">
                                            {weaponPresets.map((preset) => (
                                                <Flex key={preset.$id} justify="between" align="center" gap="2" py="1">
                                                    <Box style={{ minWidth: 0, flex: 1 }}>
                                                        <Text size="2" className="customizer-list-item__name">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
                                                        <Text size="1" color="gray">{preset.spec.size}/{preset.spec.damageType} · {preset.spec.damage}伤害 · {preset.spec.range}射程</Text>
                                                    </Box>
                                                    <Button size="1" variant="ghost" onClick={() => void copyWeaponPreset(preset.$id)}><Copy size={12} /></Button>
                                                </Flex>
                                            ))}
                                        </Flex>
                                        </Box>
                                        )}
                                    </Card>

                                    <Box style={{ height: 48 }} />
                                </Flex>

                                <Flex
                                    justify="between"
                                    align="center"
                                    px="3"
                                    py="2"
                                    style={{
                                        borderTop: "1px solid rgba(43, 66, 97, 0.6)",
                                        background: "var(--color-panel)",
                                    }}
                                >
                                    <Flex align="center" gap="2">
                                        {isWeaponDirty && (
                                            <Badge color="orange" size="1">未保存</Badge>
                                        )}
                                        <Text size="1" color="gray">Ctrl+S 快速保存</Text>
                                    </Flex>
                                    <Button onClick={() => void saveWeapon()} color={isWeaponDirty ? "green" : undefined} disabled={!isWeaponDirty} data-magnetic>
                                        <Save size={14} /> 保存
                                    </Button>
                                </Flex>
                            </Flex>
                        </Grid>
                    )}
                </Tabs.Root>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default LoadoutCustomizerDialog;