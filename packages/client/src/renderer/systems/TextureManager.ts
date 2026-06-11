import { Assets, Texture } from "pixi.js";

interface TextureEntry {
	texture: Texture | null;
	status: "loading" | "loaded" | "failed";
	retryCount: number;
	lastAttemptAt: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

class TextureManager {
	private cache = new Map<string, TextureEntry>();
	private loading = new Set<string>();
	private listeners = new Set<() => void>();
	private version = 0;

	getTextureUrl(assetId: string): string {
		return `/api/assets/${encodeURIComponent(assetId)}.png`;
	}

	async load(assetIds: string[]): Promise<void> {
		const toLoad = assetIds.filter((id) => {
			if (this.loading.has(id)) return false;
			const entry = this.cache.get(id);
			if (!entry) return true;
			if (entry.status === "loaded") return false;
			if (entry.status === "loading") return false;
			if (entry.retryCount >= MAX_RETRIES) return false;
			return Date.now() - entry.lastAttemptAt >= RETRY_DELAY;
		});

		if (toLoad.length === 0) return;

		for (const id of toLoad) {
			this.loading.add(id);
			this.cache.set(id, {
				texture: null,
				status: "loading",
				retryCount: this.cache.get(id)?.retryCount ?? 0,
				lastAttemptAt: Date.now(),
			});
		}
		this.notify();

		const loadPromises = toLoad.map((id) => this.loadSingle(id));
		await Promise.allSettled(loadPromises);
	}

	private async loadSingle(assetId: string): Promise<void> {
		const url = this.getTextureUrl(assetId);
		try {
			const texture = await Assets.load<Texture>({ src: url, alias: assetId });
			this.cache.set(assetId, {
				texture,
				status: "loaded",
				retryCount: 0,
				lastAttemptAt: Date.now(),
			});
		} catch (err) {
			console.error("[TextureManager] Load failed:", assetId, err);
			const prev = this.cache.get(assetId);
			this.cache.set(assetId, {
				texture: null,
				status: "failed",
				retryCount: (prev?.retryCount ?? 0) + 1,
				lastAttemptAt: Date.now(),
			});
		} finally {
			this.loading.delete(assetId);
			this.notify();
		}
	}

	getTexture(assetId: string): Texture | null {
		return this.cache.get(assetId)?.texture ?? null;
	}

	getStatus(assetId: string): "none" | "loading" | "loaded" | "failed" {
		return this.cache.get(assetId)?.status ?? "none";
	}

	getLoadingProgress(): { loaded: number; total: number } {
		let loaded = 0;
		let total = 0;
		for (const entry of this.cache.values()) {
			total++;
			if (entry.status === "loaded") loaded++;
		}
		return { loaded, total };
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): number {
		return this.version;
	}

	private notify(): void {
		this.version++;
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export const textureManager = new TextureManager();
