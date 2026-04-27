import { useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
	WsPayload,
	AssetListItem,
} from "@vt/data";
import { ASSET_LIMITS, fileToBase64 } from "@/utils/file";

interface AssetUploadResult {
	assetId: string;
}

interface AssetBatchGetResult {
	assetId: string;
	info: AssetListItem | null;
	data?: string;
}

export function useAssetSocket(socket: Socket | null) {
	const pendingRequests = useRef<Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>>(new Map());

	const sendRequest = useCallback(
		<T>(event: string, payload: unknown): Promise<T> => {
			if (!socket?.connected) {
				return Promise.reject(new Error("Socket not connected"));
			}

			const requestId = crypto.randomUUID();

			return new Promise<T>((resolve, reject) => {
				pendingRequests.current.set(requestId, { resolve: resolve as (value: unknown) => void, reject });

				socket.emit("request", { event, requestId, payload });

				setTimeout(() => {
					const pending = pendingRequests.current.get(requestId);
					if (pending) {
						pendingRequests.current.delete(requestId);
						reject(new Error(`Request timeout: ${event}`));
					}
				}, 10000);
			});
		},
		[socket]
	);

	const handleResponse = useCallback((data: { requestId: string; success: boolean; data?: unknown; error?: { code: string; message: string } }) => {
		const pending = pendingRequests.current.get(data.requestId);
		if (!pending) return;

		pendingRequests.current.delete(data.requestId);

		if (data.success) {
			pending.resolve(data.data);
		} else {
			pending.reject(new Error(data.error?.message ?? "Unknown error"));
		}
	}, []);

	const upload = useCallback(
		async (type: "ship_texture" | "weapon_texture", file: File): Promise<string> => {
			const limits = ASSET_LIMITS[type];

			if (!limits.allowedMimeTypes.includes(file.type as "image/png" | "image/jpeg" | "image/gif")) {
				throw new Error(`不支持的格式: ${limits.allowedMimeTypes.join(", ")}`);
			}

			if (file.size > limits.maxFileSize) {
				throw new Error(`文件过大: 最大 ${Math.floor(limits.maxFileSize / 1024)}KB`);
			}

			const base64 = await fileToBase64(file);

			const payload: WsPayload<"asset:upload"> = {
				type,
				filename: file.name,
				mimeType: file.type,
				data: base64,
				name: file.name.replace(/\.[^.]+$/, ""),
			};

			const result = await sendRequest<AssetUploadResult>("asset:upload", payload);
			return result.assetId;
		},
		[sendRequest]
	);

	const list = useCallback(
		async (type?: "ship_texture" | "weapon_texture", ownerId?: string): Promise<AssetListItem[]> => {
			const payload: WsPayload<"asset:action"> = { action: "list", type, ownerId };
			const result = await sendRequest<{ assets: AssetListItem[] }>("asset:action", payload);
			return result.assets ?? [];
		},
		[sendRequest]
	);

	const batchGet = useCallback(
		async (assetIds: string[], includeData = false): Promise<AssetBatchGetResult[]> => {
			const payload: WsPayload<"asset:action"> = { action: "batch_get", assetIds, includeData };
			const result = await sendRequest<{ results: AssetBatchGetResult[] }>("asset:action", payload);
			return result.results ?? [];
		},
		[sendRequest]
	);

	const deleteAsset = useCallback(
		async (assetId: string): Promise<void> => {
			const payload: WsPayload<"asset:action"> = { action: "delete", assetId };
			await sendRequest("asset:action", payload);
		},
		[sendRequest]
	);

	return {
		upload,
		list,
		batchGet,
		deleteAsset,
		handleResponse,
	};
}

/**
 * @deprecated 改用 import { fileToBase64, loadImage } from "@/utils/file"
 */
export { fileToBase64, loadImage, ASSET_LIMITS } from "@/utils/file";