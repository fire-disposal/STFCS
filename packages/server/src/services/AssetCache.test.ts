import { describe, it, expect, beforeEach } from "vitest";
import { AssetCache } from "./AssetCache.js";

describe("AssetCache", () => {
	let cache: AssetCache;

	beforeEach(() => {
		cache = new AssetCache(100);
	});

	it("stores and retrieves entries", () => {
		const buf = Buffer.from("hello");
		cache.set("id1", buf, "image/png");
		const entry = cache.get("id1");
		expect(entry).toBeDefined();
		expect(entry!.buffer).toEqual(buf);
		expect(entry!.mimeType).toBe("image/png");
	});

	it("returns undefined for missing entries", () => {
		expect(cache.get("missing")).toBeUndefined();
	});

	it("evicts LRU entries when over capacity", () => {
		const buf50 = Buffer.alloc(50);
		const buf60 = Buffer.alloc(60);
		cache.set("a", buf50, "image/png");
		cache.set("b", buf60, "image/png");
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBeDefined();
		expect(cache.byteSize).toBe(60);
	});

	it("promotes accessed entries (LRU order)", () => {
		const buf40 = Buffer.alloc(40);
		cache.set("a", buf40, "image/png");
		cache.set("b", buf40, "image/png");
		cache.get("a");
		cache.set("c", buf40, "image/png");
		expect(cache.get("a")).toBeDefined();
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("c")).toBeDefined();
	});

	it("evicts specific entry", () => {
		cache.set("a", Buffer.alloc(10), "image/png");
		expect(cache.evict("a")).toBe(true);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.byteSize).toBe(0);
	});

	it("evict returns false for missing entry", () => {
		expect(cache.evict("missing")).toBe(false);
	});

	it("updates size when overwriting existing key", () => {
		cache.set("a", Buffer.alloc(10), "image/png");
		expect(cache.byteSize).toBe(10);
		cache.set("a", Buffer.alloc(30), "image/png");
		expect(cache.byteSize).toBe(30);
		expect(cache.size).toBe(1);
		const entry = cache.get("a");
		expect(entry!.buffer.length).toBe(30);
	});

	it("rejects oversized entries without evicting existing ones", () => {
		cache.set("a", Buffer.alloc(50), "image/png");
		cache.set("big", Buffer.alloc(200), "image/png");
		expect(cache.get("a")).toBeDefined();
		expect(cache.size).toBe(1);
	});

	it("clears all entries", () => {
		cache.set("a", Buffer.alloc(10), "image/png");
		cache.set("b", Buffer.alloc(10), "image/png");
		cache.clear();
		expect(cache.size).toBe(0);
		expect(cache.byteSize).toBe(0);
	});
});
