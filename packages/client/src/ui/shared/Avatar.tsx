import React, { useMemo, useState, useEffect } from "react";

interface AvatarProps {
	src?: string | null;
	assetId?: string | null;
	size?: "small" | "medium" | "large" | number;
	className?: string;
	fallback?: React.ReactNode;
	userName?: string;
	onLoad?: () => void;
	onError?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
	src,
	assetId,
	size = "medium",
	className = "",
	fallback,
	userName,
	onLoad,
	onError,
}) => {
	const [loading, setLoading] = useState(false);
	const [errorState, setErrorState] = useState(false);
	const [assetData, setAssetData] = useState<string | null>(null);

	useEffect(() => {
		if (assetId && !src) {
			setLoading(true);
			setErrorState(false);
			fetchAssetData(assetId)
				.then((data) => {
					setAssetData(data);
					setLoading(false);
					onLoad?.();
				})
				.catch(() => {
					setErrorState(true);
					setLoading(false);
					onError?.();
				});
		} else {
			setAssetData(null);
			setLoading(false);
		}
	}, [assetId, src, onLoad, onError]);

	const imageSrc = useMemo(() => {
		if (src && src.startsWith("data:image/")) return src;
		if (src && src.startsWith("http")) return src;
		if (assetData) return `data:image/png;base64,${assetData}`;
		return null;
	}, [src, assetData]);

	const generatedFallback = useMemo(() => {
		if (fallback) return fallback;
		if (userName) {
			const initial = userName.charAt(0).toUpperCase();
			const colorIndex = userName.charCodeAt(0) % 6;
			const colors = ["#4a9eff", "#ff6f8f", "#9b59b6", "#f1c40f", "#2ecc71", "#e74c3c"];
			return (
				<span style={{ color: colors[colorIndex], fontSize: "inherit" }}>
					{initial}
				</span>
			);
		}
		return "👤";
	}, [fallback, userName]);

	const getSizeStyle = () => {
		if (typeof size === "number") {
			return { width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.6}px` };
		}

		const sizes: Record<string, { width: string; height: string; fontSize: string }> = {
			small: { width: "24px", height: "24px", fontSize: "14px" },
			medium: { width: "42px", height: "42px", fontSize: "24px" },
			large: { width: "80px", height: "80px", fontSize: "40px" },
		};

		return sizes[size] || sizes.medium;
	};

	const baseStyle: React.CSSProperties = {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(13, 40, 71, 0.5)",
		border: "1px solid rgba(74, 158, 255, 0.4)",
		borderRadius: "0",
		overflow: "hidden",
		...getSizeStyle(),
	};

	if (loading) {
		return (
			<div className={`stfcs-avatar stfcs-avatar--loading ${className}`} style={baseStyle}>
				<span style={{ opacity: 0.5 }}>...</span>
			</div>
		);
	}

	if (errorState || !imageSrc) {
		return (
			<div className={`stfcs-avatar stfcs-avatar--fallback ${className}`} style={baseStyle}>
				{generatedFallback}
			</div>
		);
	}

	return (
		<div className={`stfcs-avatar stfcs-avatar--image ${className}`} style={baseStyle}>
			<img
				src={imageSrc}
				alt="Avatar"
				style={{ width: "100%", height: "100%", objectFit: "cover" }}
				onError={() => {
					setErrorState(true);
					onError?.();
				}}
			/>
		</div>
	);
};

async function fetchAssetData(assetId: string): Promise<string> {
	const socket = window.__STFCS_SOCKET__;
	if (!socket) throw new Error("Socket not available");

	return new Promise((resolve, reject) => {
		const requestId = crypto.randomUUID();
		const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

		socket.once("response", (data: { requestId: string; success: boolean; data?: any }) => {
			if (data.requestId === requestId) {
				clearTimeout(timeout);
				if (data.success && data.data?.results?.[0]?.data) {
					resolve(data.data.results[0].data);
				} else {
					reject(new Error("Asset not found"));
				}
			}
		});

		socket.emit("request", {
			event: "asset:batch_get",
			requestId,
			payload: { assetIds: [assetId], includeData: true },
		});
	});
}

declare global {
	interface Window {
		__STFCS_SOCKET__?: any;
	}
}

export default Avatar;
