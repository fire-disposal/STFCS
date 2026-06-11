# Texture Rendering Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize texture rendering by adding HTTP static asset serving, a global TextureManager singleton, and fixing rendering bugs.

**Architecture:** Add `GET /api/assets/:assetId` HTTP endpoint with LRU memory cache. Client loads textures via HTTP URLs through a global `TextureManager` singleton that survives React component lifecycle. Fix weapon texture offset rotation bug and unify `toPixiRotation` usage.

**Tech Stack:** Node.js HTTP server, PixiJS Assets, React `useSyncExternalStore`, Vitest

**Spec:** `docs/superpowers/specs/2026-06-11-texture-rendering-optimization-design.md`

**Verification commands:**
```bash
# Server
cd packages/server && npm run typecheck && npm run lint && npm run test

# Client
cd packages/client && npm run typecheck && npm run lint
```

---

## File Structure

**New files:**
- `packages/server/src/services/AssetCache.ts` — LRU memory cache for asset binary data
- `packages/server/src/services/AssetCache.test.ts` — Unit tests for AssetCache
- `packages/client/src/renderer/systems/TextureManager.ts` — Global texture loading singleton

**Modified files:**
- `packages/server/src/services/AssetService.ts` — Integrate AssetCache, add `getAssetBuffer`
- `packages/server/src/index.ts` — Add `/api/assets/:assetId` HTTP route
- `packages/server/src/server/socketio/handlers/room.ts` — Simplify `room:get_assets`
- `packages/client/vite.config.ts` — Add `/api` proxy
- `packages/client/src/renderer/systems/useTextureLoader.ts` — Thin wrapper over TextureManager
- `packages/client/src/renderer/core/PixiCanvas.tsx` — Remove `fetchAssets` prop, add loading indicator
- `packages/client/src/pages/GamePage.tsx` — Remove `fetchAssets` chain
- `packages/client/src/renderer/entities/WeaponTextureRenderer.ts` — Fix offset rotation
- `packages/client/src/renderer/entities/ShipTextureRenderer.ts` — Use `toPixiRotation`
- `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx` — HTTP URL for previews
- `packages/client/src/ui/panels/FactionSelector.tsx` — HTTP URL for flag previews
- `packages/client/src/ui/overlays/FactionCustomizerDialog.tsx` — HTTP URL for flag previews

---

### Task 1: Server — AssetCache LRU Class

**Files:**
- Create: `packages/server/src/services/AssetCache.ts`
- Create: `packages/server/src/services/AssetCache.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/services/AssetCache.test.ts`:

```typescript
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

	it("clears all entries", () => {
		cache.set("a", Buffer.alloc(10), "image/png");
		cache.set("b", Buffer.alloc(10), "image/png");
		cache.clear();
		expect(cache.size).toBe(0);
		expect(cache.byteSize).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && npx vitest run src/services/AssetCache.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AssetCache**

Create `packages/server/src/services/AssetCache.ts`:

```typescript
interface CacheEntry {
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

		if (buffer.length > this.maxSizeBytes) return;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/services/AssetCache.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/AssetCache.ts packages/server/src/services/AssetCache.test.ts
git commit -m "feat(server): add LRU AssetCache for texture binary data"
```

---

### Task 2: Server — Integrate AssetCache into AssetService

**Files:**
- Modify: `packages/server/src/services/AssetService.ts`

- [ ] **Step 1: Add cache import and instance**

At the top of `AssetService.ts`, add import and create cache instance inside the class:

```typescript
import { AssetCache } from "./AssetCache.js";
```

Inside the `AssetService` class, add a private field:

```typescript
private assetCache = new AssetCache(50 * 1024 * 1024);
```

- [ ] **Step 2: Add `getAssetBuffer` method**

Add a new public method to `AssetService` that checks cache first, then falls back to disk. Place it after the existing `getAssetData` method:

```typescript
async getAssetBuffer(assetId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const cached = this.assetCache.get(assetId);
    if (cached) return cached;

    const asset = await this.getAsset(assetId);
    if (!asset) return null;

    const data = await this.getAssetData(assetId);
    if (!data) return null;

    this.assetCache.set(assetId, data, asset.mimeType);
    return { buffer: data, mimeType: asset.mimeType };
}
```

- [ ] **Step 3: Add cache eviction on delete**

In the `deleteAsset` method, add cache eviction right before the "删除元数据" comment (around line 448):

```typescript
this.assetCache.evict(assetId);
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/server && npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/AssetService.ts
git commit -m "feat(server): integrate LRU cache into AssetService with getAssetBuffer"
```

---

### Task 3: Server — HTTP Asset Endpoint

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Add asset route handler**

In `packages/server/src/index.ts`, modify the `handleHttpRequest` function. Add the `/api/assets/` route **before** the existing static file serving logic (before `const requestedPath = safePublicPath(reqUrl);` line):

```typescript
if (reqUrl.startsWith("/api/assets/")) {
    const assetId = decodeURIComponent(reqUrl.slice("/api/assets/".length).split("?")[0] ?? "");
    if (!assetId) {
        res.statusCode = 400;
        res.end("Missing assetId");
        return;
    }

    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch === `"${assetId}"`) {
        res.statusCode = 304;
        res.end();
        return;
    }

    const result = await assetService.getAssetBuffer(assetId);
    if (!result) {
        res.statusCode = 404;
        res.setHeader("Cache-Control", "no-store");
        res.end("Not Found");
        return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Length", result.buffer.length.toString());
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", `"${assetId}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(result.buffer);
    return;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/server && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `cd packages/server && npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): add GET /api/assets/:assetId HTTP endpoint with caching"
```

---

### Task 4: Client — Vite Proxy Config

**Files:**
- Modify: `packages/client/vite.config.ts`

- [ ] **Step 1: Add proxy to Vite config**

In `packages/client/vite.config.ts`, add a `proxy` block inside the existing `server` config. The `server` block currently contains `port`, `strictPort`, `host`, `hmr`. Add `proxy` after `hmr`:

```typescript
proxy: {
    "/api": "http://localhost:3001",
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/vite.config.ts
git commit -m "feat(client): add Vite proxy for /api to backend server"
```

---

### Task 5: Client — TextureManager Singleton

**Files:**
- Create: `packages/client/src/renderer/systems/TextureManager.ts`

- [ ] **Step 1: Create TextureManager**

Create `packages/client/src/renderer/systems/TextureManager.ts`:

```typescript
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
		return `/api/assets/${encodeURIComponent(assetId)}`;
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
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/client && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/systems/TextureManager.ts
git commit -m "feat(client): add global TextureManager singleton with HTTP loading"
```

---

### Task 6: Client — Refactor useTextureLoader

**Files:**
- Modify: `packages/client/src/renderer/systems/useTextureLoader.ts`

- [ ] **Step 1: Rewrite useTextureLoader as thin wrapper**

Replace the entire contents of `packages/client/src/renderer/systems/useTextureLoader.ts` with:

```typescript
import type { Texture } from "pixi.js";
import { useEffect, useSyncExternalStore, useMemo } from "react";
import { textureManager } from "./TextureManager";

export function useTextureLoader(assetIds: string[]): Map<string, Texture | null> {
	const stableIds = useMemo(() => {
		const sorted = [...new Set(assetIds)].sort();
		return sorted;
	}, [assetIds.join(",")]);

	useEffect(() => {
		if (stableIds.length > 0) {
			textureManager.load(stableIds);
		}
	}, [stableIds]);

	useSyncExternalStore(
		textureManager.subscribe.bind(textureManager),
		textureManager.getSnapshot.bind(textureManager),
	);

	return useMemo(() => {
		const map = new Map<string, Texture | null>();
		for (const id of stableIds) {
			map.set(id, textureManager.getTexture(id));
		}
		return map;
	}, [stableIds, textureManager.getSnapshot()]);
}

export type TextureCache = Map<string, Texture | null>;
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/client && npm run typecheck`
Expected: No errors (may have errors in files that import old types — those are fixed in Task 7)

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/systems/useTextureLoader.ts
git commit -m "refactor(client): useTextureLoader as thin wrapper over TextureManager"
```

---

### Task 7: Client — Simplify PixiCanvas and GamePage

**Files:**
- Modify: `packages/client/src/renderer/core/PixiCanvas.tsx`
- Modify: `packages/client/src/pages/GamePage.tsx`

- [ ] **Step 1: Simplify PixiCanvas**

In `packages/client/src/renderer/core/PixiCanvas.tsx`:

**Remove** the `AssetBatchGetResult` interface (lines 65-69):
```typescript
// DELETE these lines
interface AssetBatchGetResult {
	assetId: string;
	info: AssetListItem | null;
	data?: string;
}
```

**Remove** `fetchAssets` from `GameCanvasProps` (line 85):
```typescript
// BEFORE
interface GameCanvasProps {
	onClick?: (x: number, y: number) => void;
	fetchAssets?: (assetIds: string[], includeData: boolean) => Promise<AssetBatchGetResult[]>;
	onOverlaySetup?: (handlers: OverlayHandlers) => void;
	overlayClientRef?: React.MutableRefObject<any>;
}

// AFTER
interface GameCanvasProps {
	onClick?: (x: number, y: number) => void;
	onOverlaySetup?: (handlers: OverlayHandlers) => void;
	overlayClientRef?: React.MutableRefObject<any>;
}
```

**Remove** `noopFetchAssets` (line 103):
```typescript
// DELETE this line
const noopFetchAssets = async (_assetIds: string[], _includeData: boolean): Promise<AssetBatchGetResult[]> => [];
```

**Update** the component destructuring (line 127-132):
```typescript
// BEFORE
export const GameCanvas: React.FC<GameCanvasProps> = ({
	onClick,
	fetchAssets = noopFetchAssets,
	onOverlaySetup,
	overlayClientRef,
}) => {

// AFTER
export const GameCanvas: React.FC<GameCanvasProps> = ({
	onClick,
	onOverlaySetup,
	overlayClientRef,
}) => {
```

**Update** the texture loader call (lines 194-195):
```typescript
// BEFORE
const assetIds = useMemo(() => collectAssetIds(ships), [ships]);
const textureCache = useTextureLoader({ assetIds, fetchAssets });

// AFTER
const assetIds = useMemo(() => collectAssetIds(ships), [ships]);
const textureCache = useTextureLoader(assetIds);
```

**Remove** the unused import of `AssetListItem` (line 56):
```typescript
// DELETE this line
import type { AssetListItem } from "@vt/data";
```

- [ ] **Step 2: Simplify GamePage**

In `packages/client/src/pages/GamePage.tsx`:

**Remove** the `useAssetSocket` import and usage for PixiCanvas. Keep `useAssetSocket` only if other parts of GamePage still use it. Currently, GamePage uses `assetSocket` only to pass `batchGet` to PixiCanvas.

Remove the `assetSocket` setup (line 61) and the socket response listener (lines 63-69):
```typescript
// DELETE these lines
const assetSocket = useAssetSocket(socket);

React.useEffect(() => {
    if (!socket) return;
    socket.on("response", assetSocket.handleResponse);
    return () => {
        socket.off("response", assetSocket.handleResponse);
    };
}, [socket, assetSocket.handleResponse]);
```

Remove `useAssetSocket` import (line 35):
```typescript
// DELETE this line
import { useAssetSocket } from "@/hooks/useAssetSocket";
```

**Update** the PixiCanvas usage (around line 250-254):
```typescript
// BEFORE
<PixiCanvas
    fetchAssets={assetSocket.batchGet}
    onOverlaySetup={setOverlayHandlers}
    overlayClientRef={overlayClientRef}
/>

// AFTER
<PixiCanvas
    onOverlaySetup={setOverlayHandlers}
    overlayClientRef={overlayClientRef}
/>
```

- [ ] **Step 3: Run typecheck**

Run: `cd packages/client && npm run typecheck`
Expected: No errors

- [ ] **Step 4: Run lint**

Run: `cd packages/client && npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/renderer/core/PixiCanvas.tsx packages/client/src/pages/GamePage.tsx
git commit -m "refactor(client): remove fetchAssets prop, TextureManager handles loading"
```

---

### Task 8: Client — Rendering Bug Fixes

**Files:**
- Modify: `packages/client/src/renderer/entities/WeaponTextureRenderer.ts`
- Modify: `packages/client/src/renderer/entities/ShipTextureRenderer.ts`

- [ ] **Step 1: Fix weapon texture offset rotation**

In `packages/client/src/renderer/entities/WeaponTextureRenderer.ts`, replace lines 71-72:

```typescript
// BEFORE
const worldX = mountWorldPos.x - weaponOffsetX;
const worldY = mountWorldPos.y - weaponOffsetY;

// AFTER
const totalHeading = ship.runtime.heading + mountFacing;
const totalRad = toPixiRotation(totalHeading);
const worldX = mountWorldPos.x - weaponOffsetX * Math.cos(totalRad) + weaponOffsetY * Math.sin(totalRad);
const worldY = mountWorldPos.y - weaponOffsetX * Math.sin(totalRad) - weaponOffsetY * Math.cos(totalRad);
```

Note: `toPixiRotation` is already imported in this file (line 17).

- [ ] **Step 2: Unify ShipTextureRenderer to use toPixiRotation**

In `packages/client/src/renderer/entities/ShipTextureRenderer.ts`:

Add `toPixiRotation` import. Change line 22:
```typescript
// BEFORE
import type { CombatToken } from "@vt/data";

// AFTER
import type { CombatToken } from "@vt/data";
import { toPixiRotation } from "@vt/data";
```

Replace line 70:
```typescript
// BEFORE
const headingRad = (ship.runtime.heading * Math.PI) / 180;

// AFTER
const headingRad = toPixiRotation(ship.runtime.heading);
```

- [ ] **Step 3: Run typecheck**

Run: `cd packages/client && npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/renderer/entities/WeaponTextureRenderer.ts packages/client/src/renderer/entities/ShipTextureRenderer.ts
git commit -m "fix(client): weapon texture offset rotation + unified toPixiRotation"
```

---

### Task 9: Client — Loading Status UI

**Files:**
- Modify: `packages/client/src/renderer/core/PixiCanvas.tsx`

- [ ] **Step 1: Add loading indicator**

In `packages/client/src/renderer/core/PixiCanvas.tsx`:

Add import for `textureManager`:
```typescript
import { textureManager } from "../systems/TextureManager";
```

Add import for `useSyncExternalStore`:
```typescript
// Update the existing React import to include useSyncExternalStore
import React, { useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
```

Inside the `GameCanvas` component, after the `textureCache` line, add:

```typescript
useSyncExternalStore(
    textureManager.subscribe.bind(textureManager),
    textureManager.getSnapshot.bind(textureManager),
);
const loadingProgress = textureManager.getLoadingProgress();
const isLoadingTextures = loadingProgress.total > 0 && loadingProgress.loaded < loadingProgress.total;
```

In the JSX return, add a loading overlay inside the host div, after `<Application>` but before the closing `</div>`:

```tsx
{isLoadingTextures && (
    <div style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        padding: "4px 8px",
        background: "rgba(0, 0, 0, 0.6)",
        color: "#6b8aaa",
        fontSize: 11,
        borderRadius: 4,
        pointerEvents: "none",
        zIndex: 100,
    }}>
        加载贴图 ({loadingProgress.loaded}/{loadingProgress.total})...
    </div>
)}
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/client && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/core/PixiCanvas.tsx
git commit -m "feat(client): add texture loading progress indicator"
```

---

### Task 10: Client/Server — UI Preview HTTP + room:get_assets Cleanup

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`
- Modify: `packages/client/src/ui/panels/FactionSelector.tsx`
- Modify: `packages/client/src/ui/overlays/FactionCustomizerDialog.tsx`
- Modify: `packages/server/src/server/socketio/handlers/room.ts`

- [ ] **Step 1: Add assetUrl helper**

Each of the three client files has a local `toDataUrl` helper. We need to add an `assetUrl` helper. The simplest approach: add a helper in each file (or import from TextureManager). Since `textureManager.getTextureUrl` exists, import and use it.

In `LoadoutCustomizerDialog.tsx`:

Add import:
```typescript
import { textureManager } from "@/renderer/systems/TextureManager";
```

Replace `loadTexturePreview` (the function that calls `assetSocket.batchGet` to load a ship texture preview). Find the `loadTexturePreview` callback and replace with:
```typescript
const loadTexturePreview = useCallback((assetId: string) => {
    setTexturePreviewUrl(textureManager.getTextureUrl(assetId));
}, []);
```

Replace `loadWeaponTexturePreview` similarly:
```typescript
const loadWeaponTexturePreview = useCallback((assetId: string) => {
    setWeaponTexturePreviewUrl(textureManager.getTextureUrl(assetId));
}, []);
```

Note: The color key processing in `applyColorKeyToDataUrl` creates an `Image()` from the URL and draws it on canvas. This works with HTTP URLs (same-origin via Vite proxy). However, the function name says "DataUrl" — the canvas approach works identically with any URL. No changes needed to `applyColorKeyToDataUrl`.

- [ ] **Step 2: Update FactionSelector**

In `packages/client/src/ui/panels/FactionSelector.tsx`:

Add import:
```typescript
import { textureManager } from "@/renderer/systems/TextureManager";
```

Replace the `loadFlags` callback. Instead of calling `assetSocket.batchGet` and converting to dataUrls, generate HTTP URLs directly:

```typescript
const loadFlags = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const urls: Record<string, string> = {};
    for (const f of Object.values(factions)) {
        if (f.flagAssetId) {
            urls[f.flagAssetId] = textureManager.getTextureUrl(f.flagAssetId);
        }
    }
    setFlagUrls(urls);
}, [factions]);
```

This is now synchronous (no async needed, no batchGet). `assetSocket` was only used for `batchGet` in this component, so also remove:
- `import { useAssetSocket } from "@/hooks/useAssetSocket"` (line 3)
- `const assetSocket = useAssetSocket(socket ?? null)` (line 29)
- The `socket.on("response", assetSocket.handleResponse)` effect (lines 33-36)
- The `toDataUrl` helper function (lines 19-21)
- The `socket` prop if it was only used for `useAssetSocket` — check if `socket` is still needed for other purposes in the component; if not, remove it from the component props

- [ ] **Step 3: Update FactionCustomizerDialog**

In `packages/client/src/ui/overlays/FactionCustomizerDialog.tsx`:

Add import:
```typescript
import { textureManager } from "@/renderer/systems/TextureManager";
```

Replace `loadFlagImages` to use HTTP URLs:

```typescript
const loadFlagImages = useCallback((list: FactionDef[]) => {
    const urls: Record<string, string> = {};
    for (const f of list) {
        if (f.flagAssetId) {
            urls[f.flagAssetId] = textureManager.getTextureUrl(f.flagAssetId);
        }
    }
    setFlagDataUrls(urls);
}, []);
```

`assetSocket` was only used for `batchGet` in this component (flag upload goes through `edit:faction:create`, not `assetSocket.upload`), so also remove:
- `import { useAssetSocket } from "@/hooks/useAssetSocket"` (line 12)
- `const assetSocket = useAssetSocket(socket)` (line 55)
- The `socket.on("response", assetSocket.handleResponse)` effect (lines 59-62)
- The `toDataUrl` helper function (lines 38-40)

Note: The local file upload path (`handleFlagSelect` which uses `FileReader.readAsDataURL`) remains unchanged — that's for local preview before upload, not server fetching.

Note: `LoadoutCustomizerDialog` still needs `useAssetSocket` for `upload` and `list` operations — do NOT remove it from that component.

- [ ] **Step 4: Simplify room:get_assets**

In `packages/server/src/server/socketio/handlers/room.ts`, modify the `get_assets` handler (line 261) to not include binary data by default:

```typescript
get_assets: async (payload: unknown, ctx: RpcContext) => {
    ctx.requireRoom();
    const room = ctx.roomManager.getRoom(ctx.roomId);
    if (!room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);
    const assetIds = new Set<string>();
    const tokens = room.getCombatTokens();
    for (const token of tokens) {
        if (token.spec.texture?.assetId) assetIds.add(token.spec.texture.assetId);
        for (const mount of token.spec.mounts ?? []) {
            if (typeof mount.weapon !== "string" && mount.weapon?.spec?.texture?.assetId) {
                assetIds.add(mount.weapon.spec.texture.assetId);
            }
        }
    }
    return { assetIds: [...assetIds] };
},
```

This returns only the list of asset IDs. The client can then call `textureManager.load(assetIds)` to preload them via HTTP.

- [ ] **Step 5: Run typecheck for both packages**

Run: `cd packages/server && npm run typecheck`
Run: `cd packages/client && npm run typecheck`
Expected: No errors in either

- [ ] **Step 6: Run lint for both packages**

Run: `cd packages/server && npm run lint`
Run: `cd packages/client && npm run lint`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx packages/client/src/ui/panels/FactionSelector.tsx packages/client/src/ui/overlays/FactionCustomizerDialog.tsx packages/server/src/server/socketio/handlers/room.ts
git commit -m "refactor: UI previews use HTTP URLs, simplify room:get_assets"
```

---

## Final Verification

- [ ] **Run all server tests:** `cd packages/server && npm run test`
- [ ] **Run server typecheck:** `cd packages/server && npm run typecheck`
- [ ] **Run server lint:** `cd packages/server && npm run lint`
- [ ] **Run client typecheck:** `cd packages/client && npm run typecheck`
- [ ] **Run client lint:** `cd packages/client && npm run lint`
