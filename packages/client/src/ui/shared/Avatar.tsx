import React, { useMemo } from "react";

interface AvatarProps {
	src?: string | null;
	size?: "small" | "medium" | "large" | number;
	className?: string;
	fallback?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
	src,
	size = "medium",
	className = "",
	fallback = "👤"
}) => {
	const imageSrc = useMemo(() => {
		if (src && src.startsWith("data:image/")) return src;
		return null;
	}, [src]);

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
