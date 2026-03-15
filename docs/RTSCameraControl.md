# RTS Camera Control Improvements

## Overview

This document describes the improvements made to the camera control system, implementing RTS (Real-Time Strategy) game-style camera behavior for better user experience.

---

## Key Improvements

### 1. Optimized Zoom Ratio

**Before:**
- Zoom factor: 1.2x per scroll step (too fast)
- Min zoom: 0.5
- Max zoom: 4

**After:**
- Zoom factor: **1.15x** per scroll step (smoother, more precise)
- Min zoom: **0.3** (allows seeing more of the map)
- Max zoom: **6** (allows detailed inspection)

**Implementation:**
```typescript
// packages/client/src/utils/cameraBounds.ts
export function calculateZoomFactor(
  deltaY: number,
  baseFactor: number = 1.15
): number {
  const normalizedDelta = Math.sign(deltaY) * Math.min(Math.abs(deltaY), 100);
  const exponent = normalizedDelta / 100;
  return Math.pow(baseFactor, exponent);
}
```

---

### 2. Simplified Pan Logic

**Before:**
- Multiple trigger methods (middle button, space + left click, Ctrl + left click)
- Complex conditional logic
- Inconsistent behavior

**After:**
- **Primary:** Middle mouse button drag
- **Accessibility:** Space + left click (for users without middle button)
- Removed: Ctrl key logic

**Implementation:**
```typescript
// packages/client/src/components/map/GameCanvas.tsx
const handleMouseDown = (e: MouseEvent) => {
  // Middle button pan
  if (e.button === 1) {
    e.preventDefault();
    interaction.startCanvasPan({ ... });
  }
  // Space + left click: accessibility fallback
  else if (e.button === 0 && keyboard.isSpacePressed) {
    e.preventDefault();
    interaction.startCanvasPan({ ... });
  }
};
```

---

### 3. Map Boundary System

**Design Principles:**
1. **Screen center point cannot leave the map area** - prevents players from getting lost
2. **Partial out-of-bounds viewing allowed** - players can see slightly beyond edges
3. **Soft boundary resistance** - subtle resistance near edges (RTS-style)

**Configuration:**
```typescript
interface CameraBoundsConfig {
  mapWidth: number;
  mapHeight: number;
  minZoom: number;
  maxZoom: number;
  outOfBoundsMargin?: number;      // Default: 0.15 (15% of viewport)
  softBoundaryFactor?: number;     // Default: 0.25 (25% resistance)
}
```

**Boundary Calculation:**
```typescript
// Allow 15% out-of-bounds viewing
const marginX = Math.min(
  mapWidth * 0.15,
  worldViewportWidth * 0.25  // Max 25% of viewport
);

// Screen center must stay within:
// [margin, mapWidth - margin]
```

---

### 4. Zoom Towards Mouse Cursor

RTS-style zoom: the point under the mouse cursor remains stationary in world space during zoom.

**Implementation:**
```typescript
export function calculateZoomTowardsMouse(
  mouseScreenX: number,
  mouseScreenY: number,
  currentZoom: number,
  targetZoom: number,
  currentCenterX: number,
  currentCenterY: number,
  viewportWidth: number,
  viewportHeight: number
): { centerX: number; centerY: number } {
  // Calculate mouse position in world coordinates (before zoom)
  const viewportWorldWidthBefore = viewportWidth / currentZoom;
  const mouseWorldX = currentCenterX + (mouseScreenX / viewportWidth - 0.5) * viewportWorldWidthBefore;
  
  // Calculate new viewport size in world coordinates (after zoom)
  const viewportWorldWidthAfter = viewportWidth / targetZoom;
  
  // Calculate new camera center to keep mouse position stationary
  const newCenterX = mouseWorldX - (mouseScreenX / viewportWidth - 0.5) * viewportWorldWidthAfter;
  
  return { centerX: newCenterX, centerY: currentCenterY }; // Y calculation similar
}
```

---

### 5. Canvas Transform Optimization

**Before:**
```typescript
stage.position.set(width / 2 - centerX * zoom, height / 2 - centerY * zoom);
```

**After:**
```typescript
stage.pivot.set(centerX, centerY);
stage.position.set(width / 2, height / 2);
```

**Benefits:**
- Reduced floating-point accumulation errors
- Cleaner transformation hierarchy
- Better performance with rotation

---

## File Changes

### New Files
- `packages/client/src/utils/cameraBounds.ts` - Core camera boundary utilities
- `packages/client/src/utils/index.ts` - Utility exports

### Modified Files
- `packages/client/src/store/slices/cameraSlice.ts`
  - Updated default zoom range (0.3 - 6)
  - Integrated `clampZoom` utility
  
- `packages/client/src/hooks/useCamera.ts`
  - Updated zoom factors to 1.15
  - Integrated boundary utilities
  
- `packages/client/src/hooks/useInteraction.ts`
  - Removed Ctrl key logic
  - Added map bounds parameter
  - Integrated boundary clamping
  
- `packages/client/src/components/map/GameCanvas.tsx`
  - Optimized wheel zoom with mouse-position zooming
  - Updated pan logic (middle button primary)
  - Integrated boundary constraints
  - Optimized stage transform

---

## User Experience Improvements

### Zoom Behavior
- **Smoother zooming**: 1.15x factor provides finer control
- **Wider range**: 0.3-6 zoom range accommodates both strategic overview and tactical detail
- **Mouse-focused zoom**: Zoom towards cursor feels natural and intuitive

### Pan Behavior
- **Consistent controls**: Middle button always pans
- **Accessibility**: Space + left click for users without middle button
- **Boundary feedback**: Soft resistance near edges provides spatial awareness

### Boundary System
- **Prevents disorientation**: Center point constraint keeps players oriented
- **Flexible viewing**: 15% out-of-bounds margin allows edge inspection
- **Professional feel**: Soft boundaries mimic commercial RTS games

---

## Configuration Reference

### Zoom Settings
```typescript
const ZOOM_CONFIG = {
  minZoom: 0.3,        // Minimum zoom (wide view)
  maxZoom: 6,          // Maximum zoom (detailed view)
  zoomFactor: 1.15,    // Zoom step ratio
  zoomDuration: 200,   // Animation duration (ms)
};
```

### Boundary Settings
```typescript
const BOUNDARY_CONFIG = {
  outOfBoundsMargin: 0.15,    // 15% margin for edge viewing
  softBoundaryFactor: 0.25,   // 25% resistance near edges
  hardClampMargin: 100,       // Minimum pixels from edge
};
```

### Pan Settings
```typescript
const PAN_CONFIG = {
  primaryButton: 1,           // Middle button
  accessibilityKey: "Space",  // Space key + left click
  panSpeed: 1.0,              // Pan speed multiplier
};
```

---

## Testing Recommendations

### Zoom Testing
1. Test zoom in/out at different map positions
2. Verify zoom towards mouse cursor works correctly
3. Check boundary clamping at min/max zoom
4. Test zoom animation smoothness

### Pan Testing
1. Test middle button drag
2. Test space + left click (accessibility)
3. Verify boundary resistance near edges
4. Check pan smoothness at different zoom levels

### Boundary Testing
1. Move camera to each map edge
2. Verify center point constraint
3. Test out-of-bounds viewing margin
4. Check soft boundary resistance feel

---

## Future Enhancements

### Potential Improvements
1. **Edge scrolling**: Pan when mouse nears screen edges
2. **Minimap integration**: Click-to-pan from minimap
3. **Camera presets**: Save/restore camera positions
4. **Smooth damping**: Exponential smoothing for camera movement
5. **Collision avoidance**: Prevent camera from clipping through large objects

### Performance Optimizations
1. **View frustum culling**: Only render visible tokens
2. **Level of detail**: Reduce detail at low zoom levels
3. **Batch rendering**: Group similar draw calls
4. **Dirty rectangle tracking**: Only update changed regions

---

## Related Documentation

- [ArchitectureUsage.md](./ArchitectureUsage.md) - Architecture guide
- [TypeUnification.md](./TypeUnification.md) - Type system
- [LayerGraph.ts](../packages/client/src/features/game/view/LayerGraph.ts) - Layer system

---

## Summary

The camera control system now provides:
- ✅ Optimized zoom ratio (1.15x) for smoother control
- ✅ Simplified pan logic (middle button only)
- ✅ RTS-style boundary constraints
- ✅ Mouse-position zoom targeting
- ✅ Optimized canvas rendering
- ✅ Professional game-like feel
- ✅ Zoom direction toggle (user preference)
- ✅ Clean cursor state management

These changes significantly improve the user experience, making camera control more intuitive and responsive.

---

## Recent Updates (2026-03-15)

### Zoom Direction Toggle
Added a zoom direction toggle button in the settings menu, allowing users to flip the scroll wheel direction:
- **Normal**: Scroll up to zoom in, scroll down to zoom out (default)
- **Inverted**: Scroll down to zoom in, scroll up to zoom out

The setting is persisted in localStorage and survives page refresh.

### Interaction Layer Cleanup
Thoroughly cleaned up the interaction layer:
- Removed ALL space key pan logic
- Removed Ctrl key pan logic
- Only middle mouse button triggers canvas panning
- Fixed cursor state (no longer always shows "grab")
- Simplified `shouldPanCanvas()` to only check `interaction.mode === "panCanvas"`

### Critical Bug Fix: Stale Closure in Event Handlers
**Problem**: Event handlers in GameCanvas were capturing stale `interaction` object from closure, causing pan to not work.

**Root Cause**: 
- PixiJS canvas event handlers (`handleMouseDown`, `handleMouseMove`, `handleMouseUp`) are bound once during initialization
- These handlers referenced `interaction` from React state
- React state changes (via Redux) didn't update the closure

**Solution**:
1. Created `interactionRef` in GameCanvas to store latest interaction methods
2. Sync ref on every render: `interactionRef.current = { ...interaction }`
3. Event handlers now use `interactionRef.current` instead of stale closure

**Files Modified**:
- `packages/client/src/components/map/GameCanvas.tsx` - Added interactionRef
- `packages/client/src/hooks/useInteraction.ts` - Added dragRef for consistent drag state

### Complete File Changes
| File | Changes |
|------|---------|
| `TopBarMenu.tsx` | Added zoom direction toggle with RotateCcw icon |
| `GameCanvas.tsx` | Added interactionRef, integrated zoom direction, fixed event handlers |
| `interactionSlice.ts` | Removed space key cursor logic |
| `useInteraction.ts` | Added dragRef, simplified pan detection |
| `RTSCameraControl.md` | Updated documentation |
