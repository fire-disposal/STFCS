# Loadout Customizer UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the ship/weapon workshop (LoadoutCustomizerDialog) UX without changing any functionality.

**Architecture:** All changes target one primary component (`LoadoutCustomizerDialog.tsx`, 1759 lines) and its CSS files. Changes are sequentially applied: layout stabilization first, then dead code cleanup, then incremental UX improvements. No new components are created; no backend/protocol changes.

**Tech Stack:** React 18, Radix UI Themes, PixiJS (preview components untouched), Biome (lint/format), TypeScript

**Verification commands (run from `packages/client`):**
```
npm run typecheck
npm run lint
```

**Spec:** `docs/superpowers/specs/2026-06-11-loadout-customizer-ux-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx` | Modify | Primary component — all UX changes |
| `packages/client/src/ui/overlays/ship-customization-modal.css` | Modify | Layout classes, slider theme, new CSS classes |
| `packages/client/src/ui/overlays/weapon-customization-modal.css` | Delete contents or leave | Currently only has unused weapon-form styles; review if still needed |

---

### Task 0: Layout Review & Stabilization

**Files:**
- Modify: `packages/client/src/ui/overlays/ship-customization-modal.css`
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Extract critical inline styles to CSS classes so subsequent tasks can modify layout safely.

- [ ] **Step 0.1: Add layout CSS classes to ship-customization-modal.css**

Append to the end of `ship-customization-modal.css`:

```css
/* === Layout stabilization === */

.customizer-dialog-body {
	display: flex;
	flex-direction: column;
	max-height: 80vh;
	overflow: hidden;
}

.customizer-sidebar {
	max-height: 70vh;
	overflow-y: auto;
	padding-right: 4px;
}

.customizer-list-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 8px 10px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(255, 255, 255, 0.03);
	cursor: pointer;
	transition: border-color 0.15s, background 0.15s;
}

.customizer-list-item:hover {
	border-color: rgba(74, 158, 255, 0.4);
	background: rgba(74, 158, 255, 0.08);
}

.customizer-list-item--selected {
	border-color: rgba(74, 158, 255, 0.9);
	background: rgba(74, 158, 255, 0.18);
}

.customizer-list-item__info {
	min-width: 0;
	flex: 1;
}

.customizer-list-item__name {
	display: block;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
```

- [ ] **Step 0.2: Migrate ship list inline styles to CSS classes**

In `LoadoutCustomizerDialog.tsx`, find the ship list item rendering (around line 637-678). Replace the inline style Flex items with CSS class usage.

Replace:
```tsx
<Box style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
```
with:
```tsx
<Box className="customizer-sidebar">
```

Replace each ship list item's outer Flex (the one with inline `style={{ padding, borderRadius, border, background, cursor }}`):
```tsx
<Flex
    key={item.$id}
    align="center"
    justify="between"
    gap="2"
    onClick={() => setSelectedShipBuildId(item.$id)}
    style={{
        padding: "8px 10px",
        borderRadius: 6,
        border: selected ? "1px solid rgba(74, 158, 255, 0.9)" : "1px solid rgba(255,255,255,0.08)",
        background: selected ? "rgba(74, 158, 255, 0.18)" : "rgba(255,255,255,0.03)",
        cursor: "pointer",
    }}
>
```
with:
```tsx
<Flex
    key={item.$id}
    className={`customizer-list-item${selected ? " customizer-list-item--selected" : ""}`}
    onClick={() => setSelectedShipBuildId(item.$id)}
>
```

Replace inner Box:
```tsx
<Box style={{ minWidth: 0, flex: 1 }}>
```
with:
```tsx
<Box className="customizer-list-item__info">
```

Replace name Text:
```tsx
<Text size="2" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
```
with:
```tsx
<Text size="2" className="customizer-list-item__name">
```

- [ ] **Step 0.3: Migrate weapon list inline styles to CSS classes**

Apply the same CSS class migration to the weapon list items (around line 1306-1347). The structure is identical to the ship list.

Replace `<Box style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>` with `<Box className="customizer-sidebar">`.

Replace each weapon list item's outer Flex inline styles with CSS classes, same pattern as step 0.2.

- [ ] **Step 0.4: Migrate mount list inline styles**

The mount list items (around line 838-881) use a similar inline style pattern. Replace with:
```tsx
<Flex
    key={mount.id}
    className={`customizer-list-item${mountSelection === mount.id ? " customizer-list-item--selected" : ""}`}
    onClick={() => setMountSelection(mount.id)}
>
```

And replace the inner `<Box style={{ minWidth: 0, flex: 1 }}>` with `<Box className="customizer-list-item__info">`.

And the name Text with `className="customizer-list-item__name"`.

- [ ] **Step 0.5: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass with no errors.

---

### Task 1: Clean Dead Code

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Remove the `display: none` Card in the weapon tab that contains a full duplicate of the weapon edit form.

- [ ] **Step 1.1: Delete the hidden Card**

Find and delete the entire `<Card style={{ display: "none" }}>` block in the weapon tab (around lines 1352-1469). This block starts with:
```tsx
<Card style={{ display: "none" }}>
    <Flex justify="between" align="center" mb="2">
        <Text weight="bold">武器</Text>
    </Flex>
```
and ends with:
```tsx
</Card>
```

Delete this entire Card element including all its children.

- [ ] **Step 1.2: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 2: Delete Confirmation Dialogs

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Add `window.confirm` before ship/weapon deletion, consistent with how mount deletion already works.

- [ ] **Step 2.1: Add confirmation to ship delete**

Find the ship delete button onClick (the `void deleteShip(item.$id)` call). Change:
```tsx
onClick={(e) => {
    e.stopPropagation();
    void deleteShip(item.$id);
}}
```
to:
```tsx
onClick={(e) => {
    e.stopPropagation();
    if (window.confirm(`确定删除舰船 "${item.metadata?.name ?? shortId(item.$id)}"？`)) {
        void deleteShip(item.$id);
    }
}}
```

- [ ] **Step 2.2: Add confirmation to weapon delete**

Find the weapon delete button onClick (the `void deleteWeapon(item.$id)` call). Change:
```tsx
onClick={(e) => {
    e.stopPropagation();
    void deleteWeapon(item.$id);
}}
```
to:
```tsx
onClick={(e) => {
    e.stopPropagation();
    if (window.confirm(`确定删除武器 "${item.metadata?.name ?? shortId(item.$id)}"？`)) {
        void deleteWeapon(item.$id);
    }
}}
```

- [ ] **Step 2.3: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 3: Dirty Data Detection

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Warn users when switching items with unsaved changes; highlight save button when dirty.

- [ ] **Step 3.1: Add isDirty computation for ships**

After the existing `selectedMount` useMemo (around line 273), add:

```tsx
const isShipDirty = useMemo(() => {
    if (!shipDraft || !selectedShipBuildId) return false;
    const original = shipBuilds.find((item) => item.$id === selectedShipBuildId);
    if (!original) return false;
    return JSON.stringify(shipDraft) !== JSON.stringify(ensureShipDefaults(original));
}, [shipDraft, selectedShipBuildId, shipBuilds]);

const isWeaponDirty = useMemo(() => {
    if (!weaponDraft || !selectedWeaponBuildId) return false;
    const original = weaponBuilds.find((item) => item.$id === selectedWeaponBuildId);
    if (!original) return false;
    return JSON.stringify(weaponDraft) !== JSON.stringify(ensureWeaponDefaults(original));
}, [weaponDraft, selectedWeaponBuildId, weaponBuilds]);
```

- [ ] **Step 3.2: Add dirty-check wrappers for selection change**

Add two handler functions after the isDirty computations:

```tsx
const handleSelectShip = useCallback((id: string) => {
    if (id === selectedShipBuildId) return;
    if (isShipDirty && !window.confirm("当前修改未保存，是否放弃？")) return;
    setSelectedShipBuildId(id);
}, [selectedShipBuildId, isShipDirty]);

const handleSelectWeapon = useCallback((id: string) => {
    if (id === selectedWeaponBuildId) return;
    if (isWeaponDirty && !window.confirm("当前修改未保存，是否放弃？")) return;
    setSelectedWeaponBuildId(id);
}, [selectedWeaponBuildId, isWeaponDirty]);
```

- [ ] **Step 3.3: Replace direct setSelected calls with handlers**

In the ship list item onClick, replace:
```tsx
onClick={() => setSelectedShipBuildId(item.$id)}
```
with:
```tsx
onClick={() => handleSelectShip(item.$id)}
```

In the weapon list item onClick, replace:
```tsx
onClick={() => setSelectedWeaponBuildId(item.$id)}
```
with:
```tsx
onClick={() => handleSelectWeapon(item.$id)}
```

- [ ] **Step 3.4: Highlight save button when dirty**

For the ship save button, change:
```tsx
<Button onClick={() => void saveShip()} data-magnetic><Save size={14} /> 保存</Button>
```
to:
```tsx
<Button onClick={() => void saveShip()} color={isShipDirty ? "green" : undefined} data-magnetic><Save size={14} /> 保存</Button>
```

For the weapon save button, change:
```tsx
<Button onClick={() => void saveWeapon()} data-magnetic><Save size={14} /> 保存</Button>
```
to:
```tsx
<Button onClick={() => void saveWeapon()} color={isWeaponDirty ? "green" : undefined} data-magnetic><Save size={14} /> 保存</Button>
```

- [ ] **Step 3.5: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 4: Removable Weapon Tags

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Allow users to click an x on each tag Badge to remove it; filter already-selected tags from the add dropdown.

- [ ] **Step 4.1: Add X import**

Verify that `X` is already imported from `lucide-react` (line 29: `import { Plus, Save, Upload, Copy, ShieldCheck, Trash2, X } from "lucide-react";`). It is — no change needed.

- [ ] **Step 4.2: Make tags removable in the weapon editor form tab**

Find the tags section in the weapon editor (the `weaponEditorTab === "form"` block). The tags rendering looks like:

```tsx
{(weaponDraft.spec.tags ?? []).map((tag) => (
    <Badge key={tag} size="1">{tag}</Badge>
))}
```

Replace with:

```tsx
{(weaponDraft.spec.tags ?? []).map((tag) => (
    <Badge key={tag} size="1">
        {tag}
        <X
            size={10}
            style={{ marginLeft: 4, cursor: "pointer" }}
            onClick={() => updateWeaponDraft((d) => { d.spec.tags = (d.spec.tags ?? []).filter((t) => t !== tag); })}
        />
    </Badge>
))}
```

- [ ] **Step 4.3: Filter already-selected tags from dropdown**

In the same tags section, find the Select.Content that maps `WeaponTagValues`:

```tsx
<Select.Content>{WeaponTagValues.map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
```

Replace with:

```tsx
<Select.Content>{WeaponTagValues.filter((v) => !(weaponDraft.spec.tags ?? []).includes(v)).map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
```

- [ ] **Step 4.4: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 5: Slider Theme Adaptation

**Files:**
- Modify: `packages/client/src/ui/overlays/ship-customization-modal.css`
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Style native range inputs to match the dark Radix theme.

- [ ] **Step 5.1: Add slider CSS to ship-customization-modal.css**

Append to the end of `ship-customization-modal.css`:

```css
/* === Range slider dark theme === */

.customizer-range {
	-webkit-appearance: none;
	appearance: none;
	height: 4px;
	background: rgba(255, 255, 255, 0.12);
	border-radius: 2px;
	outline: none;
	cursor: pointer;
}

.customizer-range::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: #4a9eff;
	border: 2px solid rgba(10, 20, 35, 0.9);
	cursor: pointer;
	transition: background 0.15s;
}

.customizer-range::-webkit-slider-thumb:hover {
	background: #6db3ff;
}

.customizer-range::-moz-range-thumb {
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: #4a9eff;
	border: 2px solid rgba(10, 20, 35, 0.9);
	cursor: pointer;
}

.customizer-range::-moz-range-track {
	height: 4px;
	background: rgba(255, 255, 255, 0.12);
	border-radius: 2px;
}
```

- [ ] **Step 5.2: Add className to all range inputs in LoadoutCustomizerDialog.tsx**

Search for all `<input` elements with `type="range"` in the file. There are approximately 10 occurrences across ship texture sliders, weapon texture sliders, and mount point sliders.

Add `className="customizer-range"` to each one. For example, change:
```tsx
<input
    type="range"
    min={-100}
    max={100}
    value={shipDraft?.spec.texture?.offsetX ?? 0}
    onChange={(e) => updateShipTexture({ offsetX: Number(e.target.value) })}
    style={{ width: 80 }}
/>
```
to:
```tsx
<input
    className="customizer-range"
    type="range"
    min={-100}
    max={100}
    value={shipDraft?.spec.texture?.offsetX ?? 0}
    onChange={(e) => updateShipTexture({ offsetX: Number(e.target.value) })}
    style={{ width: 80 }}
/>
```

Apply this to ALL `<input type="range"` elements in the file. Do NOT touch the range inputs inside `MiniShipPreview.tsx` or `MiniWeaponPreview.tsx` — those are in separate files with their own preview zoom sliders.

- [ ] **Step 5.3: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 6: List Search

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`
- Modify: `packages/client/src/ui/overlays/ship-customization-modal.css`

Goal: Add a search box to filter ship/weapon build lists by name.

- [ ] **Step 6.1: Add search icon import**

Add `Search` to the lucide-react import:

```tsx
import { Plus, Save, Upload, Copy, ShieldCheck, Trash2, X, Search } from "lucide-react";
```

- [ ] **Step 6.2: Add search state**

After the existing `loadError` state declaration (around line 164), add:

```tsx
const [shipSearch, setShipSearch] = useState("");
const [weaponSearch, setWeaponSearch] = useState("");
```

- [ ] **Step 6.3: Add filtered lists**

After the `compatibleWeapons` useMemo (around line 283), add:

```tsx
const filteredShipBuilds = useMemo(() => {
    if (!shipSearch.trim()) return shipBuilds;
    const q = shipSearch.trim().toLowerCase();
    return shipBuilds.filter((item) => (item.metadata?.name ?? item.$id).toLowerCase().includes(q));
}, [shipBuilds, shipSearch]);

const filteredWeaponBuilds = useMemo(() => {
    if (!weaponSearch.trim()) return weaponBuilds;
    const q = weaponSearch.trim().toLowerCase();
    return weaponBuilds.filter((item) => (item.metadata?.name ?? item.$id).toLowerCase().includes(q));
}, [weaponBuilds, weaponSearch]);
```

- [ ] **Step 6.4: Add search input CSS**

Append to `ship-customization-modal.css`:

```css
/* === Search box === */

.customizer-search {
	margin-bottom: 8px;
}
```

- [ ] **Step 6.5: Add search input to ship list**

In the ship list Card, between the header `<Flex>` (containing "舰船存档" + "新增" button) and the `<Box className="customizer-sidebar">`, add:

```tsx
<TextField.Root
    className="customizer-search"
    size="1"
    placeholder="搜索舰船..."
    value={shipSearch}
    onChange={(e) => setShipSearch(e.target.value)}
>
    <TextField.Slot>
        <Search size={12} />
    </TextField.Slot>
</TextField.Root>
```

- [ ] **Step 6.6: Use filtered list for rendering**

Replace `{shipBuilds.map((item) => {` with `{filteredShipBuilds.map((item) => {`.

Replace the empty state text:
```tsx
{shipBuilds.length === 0 && <Text color="gray" size="1">暂无舰船存档</Text>}
```
with:
```tsx
{shipBuilds.length === 0 && <Text color="gray" size="1">暂无舰船存档</Text>}
{shipBuilds.length > 0 && filteredShipBuilds.length === 0 && <Text color="gray" size="1">无匹配结果</Text>}
```

- [ ] **Step 6.7: Add search input to weapon list**

Same pattern: add search input between weapon list header and `<Box className="customizer-sidebar">`:

```tsx
<TextField.Root
    className="customizer-search"
    size="1"
    placeholder="搜索武器..."
    value={weaponSearch}
    onChange={(e) => setWeaponSearch(e.target.value)}
>
    <TextField.Slot>
        <Search size={12} />
    </TextField.Slot>
</TextField.Root>
```

Replace `{weaponBuilds.map((item) => {` with `{filteredWeaponBuilds.map((item) => {`.

Add empty search result text after the existing empty state:
```tsx
{weaponBuilds.length > 0 && filteredWeaponBuilds.length === 0 && <Text color="gray" size="1">无匹配结果</Text>}
```

- [ ] **Step 6.8: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 7: Texture Upload Flow Simplification

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Move the "confirm upload" button to a more prominent position below the texture preview.

- [ ] **Step 7.1: Reorganize ship texture buttons**

In the ship texture Card, the current layout has all buttons ("删除", "选择图片", "确认上传") in the header Flex. Restructure so:
- Header keeps only "选择图片" and "删除贴图"
- "确认上传" moves below the preview thumbnail

Find the ship texture Card's pending upload button:
```tsx
{pendingShipTextureFile && (
    <Button size="1" variant="solid" color="green" onClick={() => void uploadShipTextureFromPreview()} data-magnetic>
        <Save size={12} /> 确认上传
    </Button>
)}
```

Remove it from the header `<Flex gap="2">` and place it after the preview image Box. After the `{shipColorKeyPreviewUrl && (...)}` block (the 120x120 preview), add:

```tsx
{pendingShipTextureFile && (
    <Button size="2" variant="solid" color="green" onClick={() => void uploadShipTextureFromPreview()} style={{ width: "100%" }} data-magnetic>
        <Upload size={14} /> 上传并应用
    </Button>
)}
```

Note: changed from size="1" to size="2" and full width for prominence; label changed from "确认上传" to "上传并应用" for clarity.

- [ ] **Step 7.2: Reorganize weapon texture buttons**

Apply the same restructuring to the weapon texture Card. Move the pending upload button from the header to below the preview:

Remove from header:
```tsx
{pendingWeaponTextureFile && (
    <Button size="1" variant="solid" color="green" onClick={() => void uploadWeaponTextureFromPreview()} data-magnetic>
        <Save size={12} /> 确认上传
    </Button>
)}
```

Add after the weapon preview area (after `MiniWeaponPreview` and zoom controls), before the texture position adjustments:

```tsx
{pendingWeaponTextureFile && (
    <Button size="2" variant="solid" color="green" onClick={() => void uploadWeaponTextureFromPreview()} style={{ width: "100%" }} data-magnetic>
        <Upload size={14} /> 上传并应用
    </Button>
)}
```

- [ ] **Step 7.3: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 8: Preset Template Enhancement

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Show key specs in the preset template list items.

- [ ] **Step 8.1: Enhance ship preset display**

Find the ship preset list rendering:
```tsx
{shipPresets.map((preset) => (
    <Flex key={preset.$id} justify="between" align="center">
        <Box>
            <Text size="2">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
            <Text size="1" color="gray"> {preset.spec.size}/{preset.spec.class}</Text>
        </Box>
        <Button size="1" variant="ghost" onClick={() => void copyShipPreset(preset.$id)}><Plus size={12} /></Button>
    </Flex>
))}
```

Replace with:
```tsx
{shipPresets.map((preset) => (
    <Flex key={preset.$id} justify="between" align="center" gap="2" py="1">
        <Box style={{ minWidth: 0, flex: 1 }}>
            <Text size="2" className="customizer-list-item__name">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
            <Text size="1" color="gray">{preset.spec.size}/{preset.spec.class} · HP {preset.spec.maxHitPoints} · {preset.spec.mounts?.length ?? 0} 挂点</Text>
        </Box>
        <Button size="1" variant="ghost" onClick={() => void copyShipPreset(preset.$id)}><Copy size={12} /></Button>
    </Flex>
))}
```

Note: icon changed from Plus to Copy (more semantically correct for "copy preset").

- [ ] **Step 8.2: Enhance weapon preset display**

Find the weapon preset list rendering:
```tsx
{weaponPresets.map((preset) => (
    <Flex key={preset.$id} justify="between" align="center">
        <Box>
            <Text size="2">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
            <Text size="1" color="gray"> {preset.spec.size}/{preset.spec.damageType}</Text>
        </Box>
        <Button size="1" variant="ghost" onClick={() => void copyWeaponPreset(preset.$id)}><Plus size={12} /></Button>
    </Flex>
))}
```

Replace with:
```tsx
{weaponPresets.map((preset) => (
    <Flex key={preset.$id} justify="between" align="center" gap="2" py="1">
        <Box style={{ minWidth: 0, flex: 1 }}>
            <Text size="2" className="customizer-list-item__name">{preset.metadata?.name ?? shortId(preset.$id)}</Text>
            <Text size="1" color="gray">{preset.spec.size}/{preset.spec.damageType} · {preset.spec.damage}伤害 · {preset.spec.range}射程</Text>
        </Box>
        <Button size="1" variant="ghost" onClick={() => void copyWeaponPreset(preset.$id)}><Copy size={12} /></Button>
    </Flex>
))}
```

- [ ] **Step 8.3: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 9: Ctrl+S Keyboard Shortcut

**Files:**
- Modify: `packages/client/src/ui/overlays/LoadoutCustomizerDialog.tsx`

Goal: Allow saving the current draft via Ctrl+S / Cmd+S.

- [ ] **Step 9.1: Add keyboard shortcut effect**

Add a new `useEffect` after the existing effects (after the color-key preview effects, around line 591). Place it before the `if (loadError)` early return:

```tsx
useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            if (activeTopTab === "ship") {
                void saveShip();
            } else {
                void saveWeapon();
            }
        }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
}, [open, activeTopTab, saveShip, saveWeapon]);
```

- [ ] **Step 9.2: Verify**

Run from `packages/client`:
```
npm run typecheck
npm run lint
```
Expected: both pass.

---

## Final Verification

After all tasks are complete:

```bash
cd packages/client
npm run typecheck
npm run lint
```

Both must pass with zero errors.
