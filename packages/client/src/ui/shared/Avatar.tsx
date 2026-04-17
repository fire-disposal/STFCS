import React, { useMemo, useState, useEffect } from "react";
import { getAvatar } from "@/sync";

interface AvatarProps {
	/** 直接传入图片 Base64 数据 */
	src?: string | null;
	/** 玩家 shortId，从全局存储获取头像（优先级低于 src） */
	shortId?: number;
	size?: "small" | "medium" | "large" | number;
	className?: string;
	fallback?: string;
}

/**
 * 统一头像组件
 *
 * 职责：
 * - 识别 Base64 图片数据
 * - 支持 shortId 从全局存储获取头像
 * - 监听全局缓存更新事件，自动刷新
 * - 当 src 和 shortId 都无效时，渲染默认 👤 Emoji
 * - 统一处理视觉样式
 */
export const Avatar: React.FC<AvatarProps> = ({
	src,
	shortId,
	size = "medium",
	className = "",
	fallback = "👤"
}) => {
	// 监听缓存更新事件，触发重新渲染
	const [cacheVersion, setCacheVersion] = useState(0);

	useEffect(() => {
		const handleCacheUpdate = (event: CustomEvent<{ shortId: number; avatar: string }>) => {
			// 如果更新的是当前头像，触发重新渲染
			if (shortId !== undefined && event.detail.shortId === shortId) {
				setCacheVersion(v => v + 1);
			}
		};

		window.addEventListener("stfcs-avatar-cache-updated", handleCacheUpdate as EventListener);
		return () => {
			window.removeEventListener("stfcs-avatar-cache-updated", handleCacheUpdate as EventListener);
		};
	}, [shortId]);

	// 优先使用 src，其次从全局存储获取
	const imageSrc = useMemo(() => {
		if (src && src.startsWith("data:image/")) return src;
		if (shortId !== undefined) return getAvatar(shortId);
		return null;
	}, [src, shortId, cacheVersion]); // cacheVersion 变化时重新计算

	const isImage = imageSrc && imageSrc.startsWith("data:image/");

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

	if (isImage) {
		return (
			<div className={`stfcs-avatar stfcs-avatar--image ${className}`} style={baseStyle}>
				<img
					src={imageSrc!}
					alt="Avatar"
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
					onError={(e) => {
						// 报错时退回到 fallback
						(e.target as HTMLImageElement).style.display = "none";
						(e.target as HTMLImageElement).parentElement!.innerText = fallback;
					}}
				/>
			</div>
		);
	}

	// 回退到默认 Emoji
	return (
		<div className={`stfcs-avatar stfcs-avatar--fallback ${className}`} style={baseStyle}>
			{fallback}
		</div>
	);
};

export default Avatar;
