/**
 * Camera Boundary Utilities
 * 
 * Handles map boundary constraints for RTS-style camera control.
 * 
 * Design principles:
 * - Screen center point cannot leave the map area
 * - Players can see slightly beyond map edges (partial out-of-bounds viewing)
 * - Smooth clamping with optional soft boundaries
 */

/**
 * Camera boundary configuration
 */
export interface CameraBoundsConfig {
  /** Map width */
  mapWidth: number;
  /** Map height */
  mapHeight: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** 
   * Allow out-of-bounds viewing margin (in pixels)
   * This defines how far beyond the map edge the camera center can go
   * Value is relative to viewport size at zoom=1
   */
  outOfBoundsMargin?: number;
  /** 
   * Soft boundary factor (0-1)
   * 0 = hard clamp at boundary
   * 1 = completely free movement
   * Recommended: 0.2-0.3 for subtle resistance near edges
   */
  softBoundaryFactor?: number;
}

/**
 * Calculate the allowed camera center bounds
 * 
 * The camera center can move within:
 * - X: [margin, mapWidth - margin]
 * - Y: [margin, mapHeight - margin]
 * 
 * Where margin allows partial out-of-bounds viewing
 */
export function calculateCameraBounds(
  config: CameraBoundsConfig,
  viewportWidth: number,
  viewportHeight: number
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const {
    mapWidth,
    mapHeight,
    minZoom,
    outOfBoundsMargin = 0.15, // 15% of viewport allows looking beyond edges
  } = config;

  // Calculate viewport size in world coordinates at current zoom
  const worldViewportWidth = viewportWidth / minZoom;
  const worldViewportHeight = viewportHeight / minZoom;

  // Calculate margin based on viewport size
  // This allows players to see beyond edges but keeps center constrained
  const marginX = Math.min(
    mapWidth * outOfBoundsMargin,
    worldViewportWidth * 0.25 // Max 25% of viewport
  );
  
  const marginY = Math.min(
    mapHeight * outOfBoundsMargin,
    worldViewportHeight * 0.25
  );

  return {
    minX: marginX,
    maxX: mapWidth - marginX,
    minY: marginY,
    maxY: mapHeight - marginY,
  };
}

/**
 * Clamp camera center to valid bounds
 * 
 * Ensures the camera center stays within allowed area.
 * Screen center point cannot leave the map region.
 */
export function clampCameraCenter(
  centerX: number,
  centerY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, centerX)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, centerY)),
  };
}

/**
 * Apply soft boundary resistance
 * 
 * Creates a subtle resistance effect when approaching map edges,
 * similar to RTS games. The closer to the edge, the more resistance.
 */
export function applySoftBoundary(
  centerX: number,
  centerY: number,
  targetX: number,
  targetY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  softFactor: number = 0.25
): { x: number; y: number } {
  // Calculate distance to nearest boundary
  const distToLeft = targetX - bounds.minX;
  const distToRight = bounds.maxX - targetX;
  const distToTop = targetY - bounds.minY;
  const distToBottom = bounds.maxY - targetY;

  // Calculate resistance factors (0 = at boundary, 1 = far from boundary)
  const resistanceX = Math.min(
    distToLeft / 500,
    distToRight / 500,
    1
  );
  const resistanceY = Math.min(
    distToTop / 500,
    distToBottom / 500,
    1
  );

  // Apply resistance: movement is reduced near boundaries
  const effectiveFactorX = softFactor + (1 - softFactor) * resistanceX;
  const effectiveFactorY = softFactor + (1 - softFactor) * resistanceY;

  const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
  const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));

  // Blend between current and clamped position based on resistance
  return {
    x: centerX + (clampedX - centerX) * effectiveFactorX,
    y: centerY + (clampedY - centerY) * effectiveFactorY,
  };
}

/**
 * Validate and clamp zoom level
 * 
 * Optimized zoom ratios for better UX:
 * - Zoom speed: 1.15x per scroll step (faster than 1.1x, slower than 1.2x)
 * - Min zoom: 0.3 (allows seeing more of the map)
 * - Max zoom: 6 (allows detailed inspection)
 */
export function clampZoom(
  zoom: number,
  minZoom: number = 0.3,
  maxZoom: number = 6
): number {
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * Calculate zoom factor for mouse wheel
 * 
 * Optimized for smooth, responsive zooming.
 * Uses exponential zoom curve for natural feel.
 */
export function calculateZoomFactor(
  deltaY: number,
  baseFactor: number = 1.15
): number {
  // Normalize delta to consistent steps
  const normalizedDelta = Math.sign(deltaY) * Math.min(Math.abs(deltaY), 100);
  
  // Exponential curve for smoother zoom
  const exponent = normalizedDelta / 100;
  return Math.pow(baseFactor, exponent);
}

/**
 * Calculate new camera position for zoom towards mouse
 * 
 * RTS-style zoom: zoom towards the mouse cursor position,
 * keeping the point under cursor stationary in world space.
 */
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
  const viewportWorldHeightBefore = viewportHeight / currentZoom;
  
  const mouseWorldX = currentCenterX + (mouseScreenX / viewportWidth - 0.5) * viewportWorldWidthBefore;
  const mouseWorldY = currentCenterY + (mouseScreenY / viewportHeight - 0.5) * viewportWorldHeightBefore;

  // Calculate new viewport size in world coordinates (after zoom)
  const viewportWorldWidthAfter = viewportWidth / targetZoom;
  const viewportWorldHeightAfter = viewportHeight / targetZoom;

  // Calculate new camera center to keep mouse position stationary
  const newCenterX = mouseWorldX - (mouseScreenX / viewportWidth - 0.5) * viewportWorldWidthAfter;
  const newCenterY = mouseWorldY - (mouseScreenY / viewportHeight - 0.5) * viewportWorldHeightAfter;

  return { centerX: newCenterX, centerY: newCenterY };
}

/**
 * Complete camera update with all constraints
 * 
 * Combines zoom clamping, boundary checking, and soft boundaries.
 */
export function updateCameraWithConstraints(
  updates: {
  x?: number;
  y?: number;
    zoom?: number;
  },
  current: {
  x: number;
  y: number;
    zoom: number;
  },
  config: CameraBoundsConfig,
  viewportWidth: number,
  viewportHeight: number,
  options?: {
    /** Mouse position for zoom-towards-mouse (screen coordinates) */
    mousePosition?: { x: number; y: number };
    /** Enable soft boundaries */
    enableSoftBoundary?: boolean;
  }
): {
  x: number;
  y: number;
  zoom: number;
} {
  const {
    minZoom,
    maxZoom,
    softBoundaryFactor = 0.25,
  } = config;

  // Clamp zoom
  const newZoom = updates.zoom !== undefined
    ? clampZoom(updates.zoom, minZoom, maxZoom)
    : current.zoom;

  let newCenterX = updates.x ?? current.x;
  let newCenterY = updates.y ?? current.y;

  // If zooming towards mouse, recalculate center
  if (updates.zoom !== undefined && options?.mousePosition) {
    const zoomResult = calculateZoomTowardsMouse(
      options.mousePosition.x,
      options.mousePosition.y,
      current.zoom,
      newZoom,
      current.x,
      current.y,
      viewportWidth,
      viewportHeight
    );
    newCenterX = zoomResult.centerX;
    newCenterY = zoomResult.centerY;
  }

  // Calculate bounds
  const bounds = calculateCameraBounds(config, viewportWidth, viewportHeight);

  // Apply soft boundary if enabled
  if (options?.enableSoftBoundary !== false) {
    const softResult = applySoftBoundary(
      current.x,
      current.y,
      newCenterX,
      newCenterY,
      bounds,
      softBoundaryFactor
    );
    newCenterX = softResult.x;
    newCenterY = softResult.y;
  } else {
    // Hard clamp
    const clamped = clampCameraCenter(newCenterX, newCenterY, bounds);
    newCenterX = clamped.x;
    newCenterY = clamped.y;
  }

  return {
    x: newCenterX,
    y: newCenterY,
    zoom: newZoom,
  };
}
