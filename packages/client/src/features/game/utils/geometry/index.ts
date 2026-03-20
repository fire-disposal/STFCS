/**
 * 几何体渲染模块导出
 *
 * 提供素材缺失时的几何体渲染回退方案
 */

// 基础几何体绘制工具
export {
  // 颜色配置
  HULL_SIZE_COLORS,
  DAMAGE_TYPE_COLORS,
  SHIELD_COLORS,
  STATUS_COLORS,
  // 舰船绘制
  drawShipGeometry,
  // 武器绘制
  drawWeaponArcGeometry,
  // 护盾绘制
  drawShieldGeometry,
  // 护甲绘制
  drawArmorQuadrantGeometry,
  // 辅助绘制
  drawDashedCircle,
  drawIndicatorArrow,
  drawStatusBar,
  drawHexagon,
  drawGridBackground,
  drawScanLine,
  drawWaveform,
  createGeometryContainer,
  // 类型
  type ShipGeometryConfig,
  type WeaponGeometryConfig,
  type ShieldGeometryConfig,
  type ArmorQuadrantGeometryConfig,
} from './GeometryRenderer';

// 舰船几何体渲染器
export {
  renderShipGeometry,
  renderOverloadIndicator,
  renderVentingIndicator,
  renderMovementPreview,
} from './ShipGeometryRenderer';
export type { ShipGeometryRenderOptions } from './ShipGeometryRenderer';

// 武器几何体渲染器
export {
  renderWeaponArc,
  renderAllWeaponArcs,
  renderWeaponCharging,
  renderWeaponCooldown,
  renderProjectilePreview,
  renderWeaponStatusIndicator,
} from './WeaponGeometryRenderer';
export type { WeaponRenderOptions } from './WeaponGeometryRenderer';

// 防御系统几何体渲染器
export {
  renderShieldGeometry,
  renderShieldHitEffect,
  renderArmorQuadrants,
  renderArmorHitEffect,
  renderFluxBar,
  renderOverloadEffect,
  renderVentingEffect,
} from './DefenseGeometryRenderer';
export type {
  ShieldRenderOptions,
  ArmorRenderOptions,
  FluxRenderOptions,
} from './DefenseGeometryRenderer';