import React, { useCallback, useMemo, useRef, useState } from "react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { Pipette } from "lucide-react";
import { notify } from "@/ui/shared/Notification";

interface EyeDropperResult {
    sRGBHex: string;
}

interface EyeDropperLike {
    open: () => Promise<EyeDropperResult>;
}

interface ColorKeyPickerPanelProps {
    color: string;
    tolerance: number;
    onColorChange: (color: string) => void;
    onToleranceChange: (value: number) => void;
    previewImageUrl?: string | null;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const ColorKeyPickerPanel: React.FC<ColorKeyPickerPanelProps> = ({
    color,
    tolerance,
    onColorChange,
    onToleranceChange,
    previewImageUrl,
}) => {
    const [isPickingFromPreview, setIsPickingFromPreview] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const hasPreview = useMemo(() => Boolean(previewImageUrl), [previewImageUrl]);

    const handleSystemPick = useCallback(async () => {
        const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => EyeDropperLike }).EyeDropper;
        if (!EyeDropperCtor) {
            notify.error("当前浏览器不支持系统吸色笔，请使用“从预览取色”");
            return;
        }

        try {
            const eyeDropper = new EyeDropperCtor();
            const result = await eyeDropper.open();
            onColorChange(result.sRGBHex);
            notify.success(`已取色 ${result.sRGBHex}`);
        } catch {
            // 用户取消时不提示错误
        }
    }, [onColorChange]);

    const handlePreviewClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
        if (!isPickingFromPreview) return;
        const img = imgRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

        const x = Math.floor((event.clientX - rect.left) * (img.naturalWidth / rect.width));
        const y = Math.floor((event.clientY - rect.top) * (img.naturalHeight / rect.height));

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0);
        onColorChange(hex);
        setIsPickingFromPreview(false);
        notify.success(`已取色 ${hex}`);
    }, [isPickingFromPreview, onColorChange]);

    return (
        <Flex direction="column" gap="2">
            <Text size="1" weight="bold">抠图取色（透明化指定颜色）</Text>

            <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" color="gray">目标色:</Text>
                <input
                    type="color"
                    value={color}
                    onChange={(e) => onColorChange(e.target.value)}
                    style={{ width: 32, height: 24, cursor: "pointer" }}
                />
                <Text size="1">{color}</Text>
                <Text size="1" color="gray">容差:</Text>
                <input
                    type="range"
                    min={0}
                    max={50}
                    value={tolerance}
                    onChange={(e) => onToleranceChange(Number(e.target.value))}
                    style={{ width: 80 }}
                />
                <Text size="1">{tolerance}</Text>
            </Flex>

            <Flex gap="2" wrap="wrap">
                <Button size="1" variant="soft" onClick={() => void handleSystemPick()} data-magnetic>
                    <Pipette size={12} /> 系统吸色笔
                </Button>
                <Button
                    size="1"
                    variant={isPickingFromPreview ? "solid" : "soft"}
                    disabled={!hasPreview}
                    onClick={() => setIsPickingFromPreview((v) => !v)}
                    data-magnetic
                >
                    <Pipette size={12} /> 从预览取色
                </Button>
            </Flex>

            {hasPreview && (
                <Box>
                    <Text size="1" color="gray">
                        {isPickingFromPreview ? "取色模式已开启：点击下方预览图片任意位置取色" : "可点击“从预览取色”后在下方预览中点选颜色"}
                    </Text>
                    <Box
                        mt="1"
                        style={{
                            width: 120,
                            height: 120,
                            border: "1px solid rgba(43, 66, 97, 0.6)",
                            borderRadius: 4,
                            overflow: "hidden",
                            cursor: isPickingFromPreview ? "crosshair" : "default",
                        }}
                    >
                        <img
                            ref={imgRef}
                            src={previewImageUrl ?? undefined}
                            alt="colorkey-source"
                            onClick={handlePreviewClick}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                    </Box>
                </Box>
            )}
        </Flex>
    );
};

export default ColorKeyPickerPanel;
