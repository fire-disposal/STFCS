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

export const ASSET_LIMITS: Record<"ship_texture" | "weapon_texture", {
	allowedMimeTypes: string[];
	maxFileSize: number;
	minWidth: number;
	maxWidth: number;
	minHeight: number;
	maxHeight: number;
}> = {
	ship_texture: {
		allowedMimeTypes: ["image/png"],
		maxFileSize: 2 * 1024 * 1024,
		minWidth: 9,
		maxWidth: 1024,
		minHeight: 9,
		maxHeight: 1024,
	},
	weapon_texture: {
		allowedMimeTypes: ["image/png"],
		maxFileSize: 1 * 1024 * 1024,
		minWidth: 3,
		maxWidth: 256,
		minHeight: 3,
		maxHeight: 256,
	},
};
