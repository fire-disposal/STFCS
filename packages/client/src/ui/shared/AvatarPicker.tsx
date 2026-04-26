import React, { useState, useRef, useCallback } from "react";
import { Avatar } from "./Avatar";
import { notify } from "./Notification";
import { Upload, Trash2 } from "lucide-react";
import { Button, Flex, Box } from "@radix-ui/themes";
import type { Socket } from "socket.io-client";

interface AvatarPickerProps {
	value?: string | null;
	onChange: (assetId: string) => void;
	socket: Socket | null;
	userName?: string;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
	value,
	onChange,
	socket,
	userName,
}) => {
	const [loading, setLoading] = useState(false);
	const [previewData, setPreviewData] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			notify.error("请选择图片文件");
			return;
		}

		if (file.size > 512 * 1024) {
			notify.error("图片过大，最大512KB");
			return;
		}

		setLoading(true);
		setPreviewData(null);

		try {
			const imgSrc = await readFileAsImage(file);
			const canvas = document.createElement("canvas");
			const size = 120;
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas error");

			const img = await loadImageElement(imgSrc);
			const minDim = Math.min(img.width, img.height);
			const sx = (img.width - minDim) / 2;
			const sy = (img.height - minDim) / 2;
			ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

			const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
			const quality = mimeType === "image/jpeg" ? 0.7 : undefined;
			const dataUrl = canvas.toDataURL(mimeType, quality);
			const base64 = dataUrl.split(",")[1] ?? "";

			setPreviewData(dataUrl);

			const assetId = await uploadAsset(socket, "avatar", base64, file.name, mimeType);
			onChange(assetId);
			notify.success("头像上传成功");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "上传失败");
		}

		setLoading(false);
	}, [socket, onChange]);

	const handleClear = useCallback(() => {
		onChange("");
		setPreviewData(null);
	}, [onChange]);

	return (
		<Flex align="center" gap="3">
			<Box>
				<Avatar
					src={previewData || value}
					size="large"
					userName={userName}
				/>
			</Box>
			<Flex direction="column" gap="2">
				<Button
					variant="soft"
					onClick={() => fileInputRef.current?.click()}
					disabled={loading}
				>
					<Upload size={14} />
					{loading ? "上传中..." : "上传图片"}
				</Button>
				{value && (
					<Button variant="soft" color="red" onClick={handleClear}>
						<Trash2 size={14} /> 清除
					</Button>
				)}
			</Flex>
			<input
				type="file"
				ref={fileInputRef}
				style={{ display: "none" }}
				accept="image/png,image/jpeg,image/gif"
				onChange={handleFileChange}
			/>
		</Flex>
	);
};

async function readFileAsImage(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("文件读取失败"));
		reader.readAsDataURL(file);
	});
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("图片加载失败"));
		img.src = src;
	});
}

async function uploadAsset(
	socket: Socket | null,
	type: "avatar" | "ship_texture" | "weapon_texture",
	base64: string,
	filename: string,
	mimeType: string
): Promise<string> {
	if (!socket?.connected) throw new Error("未连接服务器");

	const requestId = crypto.randomUUID();

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("上传超时")), 10000);

		socket.once("response", (data: { requestId: string; success: boolean; data?: any; error?: { message: string } }) => {
			if (data.requestId === requestId) {
				clearTimeout(timeout);
				if (data.success && data.data?.assetId) {
					resolve(data.data.assetId);
				} else {
					reject(new Error(data.error?.message ?? "上传失败"));
				}
			}
		});

		socket.emit("request", {
			event: "asset:upload",
			requestId,
			payload: { type, filename, mimeType, data: base64 },
		});
	});
}

export default AvatarPicker;