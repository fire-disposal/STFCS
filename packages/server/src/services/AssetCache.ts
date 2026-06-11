export interface CacheEntry {
	buffer: Buffer;
	mimeType: string;
}

export class AssetCache {
	private cache = new Map<string, CacheEntry>();
	private maxSizeBytes: number;
	private currentSize = 0;

	constructor(maxSizeBytes: number = 50 * 1024 * 1024) {
		this.maxSizeBytes = maxSizeBytes;
	}

	get(assetId: string): CacheEntry | undefined {
		const entry = this.cache.get(assetId);
		if (!entry) return undefined;
		this.cache.delete(assetId);
		this.cache.set(assetId, entry);
		return entry;
	}

	set(assetId: string, buffer: Buffer, mimeType: string): void {
		if (buffer.length > this.maxSizeBytes) return;

		if (this.cache.has(assetId)) {
			const old = this.cache.get(assetId)!;
			this.currentSize -= old.buffer.length;
			this.cache.delete(assetId);
		}

		while (this.currentSize + buffer.length > this.maxSizeBytes && this.cache.size > 0) {
			const oldest = this.cache.keys().next().value!;
			const oldEntry = this.cache.get(oldest)!;
			this.currentSize -= oldEntry.buffer.length;
			this.cache.delete(oldest);
		}

		this.cache.set(assetId, { buffer, mimeType });
		this.currentSize += buffer.length;
	}

	evict(assetId: string): boolean {
		const entry = this.cache.get(assetId);
		if (!entry) return false;
		this.currentSize -= entry.buffer.length;
		this.cache.delete(assetId);
		return true;
	}

	clear(): void {
		this.cache.clear();
		this.currentSize = 0;
	}

	get size(): number {
		return this.cache.size;
	}

	get byteSize(): number {
		return this.currentSize;
	}
}
