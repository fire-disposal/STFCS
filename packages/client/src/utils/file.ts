export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			const base64 = result.split(",")[1] ?? "";
			resolve(base64);
		};
		reader.onerror = () => reject(new Error("File read error"));
		reader.readAsDataURL(file);
	});
}

export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Image load error"));
		img.src = src;
	});
}

export function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<File> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			if (img.naturalWidth <= maxWidth && img.naturalHeight <= maxHeight) {
				resolve(file);
				return;
			}
			const ratio = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
			const w = Math.round(img.naturalWidth * ratio);
			const h = Math.round(img.naturalHeight * ratio);
			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) { reject(new Error("Canvas context failed")); return; }
			ctx.drawImage(img, 0, 0, w, h);
			canvas.toBlob((blob) => {
				if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
				resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" }));
			}, "image/png");
		};
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
		img.src = url;
	});
}

export const ASSET_LIMITS: Record<"ship_texture" | "weapon_texture", {
	allowedMimeTypes: string[];
	maxFileSize: number;
	minWidth: number;
	maxWidth: number;
	minHeight: number;
	maxHeight: number;
}> = {
	ship_texture: {
		allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
		maxFileSize: 2 * 1024 * 1024,
		minWidth: 9,
		maxWidth: 1024,
		minHeight: 9,
		maxHeight: 1024,
	},
	weapon_texture: {
		allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
		maxFileSize: 1 * 1024 * 1024,
		minWidth: 3,
		maxWidth: 256,
		minHeight: 3,
		maxHeight: 256,
	},
};
