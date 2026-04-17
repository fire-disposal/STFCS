/**
 * 坐标系统行为一致性测试
 *
 * 验证 CoordinateSystem 模块的 UI/渲染函数行为
 *
 * ⚠️ 游戏规则相关函数（distance, angleBetween, angleDifference, normalizeAngle）
 * 已移至 @vt/rules 包，相关测试应在 @vt/rules 中进行
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRotation,
  screenToWorld,
  worldToScreen,
  screenDeltaToWorldDelta,
  mathToNav,
  navToMath,
  mathToScreen,
  screenToMath,
  toRadians,
  toDegrees,
} from '@/utils/coordinateSystem';

describe('CoordinateSystem - UI/渲染函数测试', () => {
  describe('normalizeRotation', () => {
    it('应该规范化角度到 -180~180 范围', () => {
      expect(normalizeRotation(0)).toBe(0);
      expect(normalizeRotation(90)).toBe(90);
      expect(normalizeRotation(180)).toBe(180);
      expect(normalizeRotation(270)).toBe(-90);
      expect(normalizeRotation(360)).toBe(0);
      expect(normalizeRotation(-90)).toBe(-90);
      expect(normalizeRotation(-180)).toBe(-180);
      expect(normalizeRotation(-270)).toBe(90);
    });
  });

  describe('screenToWorld', () => {
    it('应该正确转换屏幕坐标到世界坐标（无旋转）', () => {
      const result = screenToWorld(100, 50, 1, 1000, 1000, 0);
      expect(result.x).toBeCloseTo(1100, 5);
      expect(result.y).toBeCloseTo(1050, 5);
    });

    it('应该正确转换屏幕坐标到世界坐标（有缩放）', () => {
      const result = screenToWorld(100, 50, 2, 1000, 1000, 0);
      expect(result.x).toBeCloseTo(1050, 5);
      expect(result.y).toBeCloseTo(1025, 5);
    });

    it('应该正确转换屏幕坐标到世界坐标（90 度旋转）', () => {
      const result = screenToWorld(100, 0, 1, 1000, 1000, 90);
      expect(result.x).toBeCloseTo(1000, 5);
      expect(result.y).toBeCloseTo(1100, 5);
    });
  });

  describe('worldToScreen', () => {
    it('应该正确转换世界坐标到屏幕坐标（无旋转）', () => {
      const result = worldToScreen(1100, 1050, 1, 1000, 1000, 0);
      expect(result.x).toBeCloseTo(100, 5);
      expect(result.y).toBeCloseTo(50, 5);
    });

    it('应该与 screenToWorld 互为逆变换', () => {
      const screenX = 150;
      const screenY = 75;
      const zoom = 1.5;
      const cameraX = 2000;
      const cameraY = 2000;
      const viewRotation = 45;

      const world = screenToWorld(screenX, screenY, zoom, cameraX, cameraY, viewRotation);
      const screen = worldToScreen(world.x, world.y, zoom, cameraX, cameraY, viewRotation);

      expect(screen.x).toBeCloseTo(screenX, 5);
      expect(screen.y).toBeCloseTo(screenY, 5);
    });
  });

  describe('screenDeltaToWorldDelta', () => {
    it('应该正确转换屏幕向量到世界向量（无旋转）', () => {
      const result = screenDeltaToWorldDelta(100, 50, 2, 0);
      expect(result.x).toBeCloseTo(50, 5);
      expect(result.y).toBeCloseTo(25, 5);
    });

    it('应该正确转换屏幕向量到世界向量（90 度旋转）', () => {
      const result = screenDeltaToWorldDelta(100, 0, 1, 90);
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(100, 5);
    });
  });

  describe('角度转换函数', () => {
    it('应该正确转换度数和弧度', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(180)).toBe(Math.PI);
      expect(toRadians(360)).toBe(2 * Math.PI);
      expect(toDegrees(0)).toBe(0);
      expect(toDegrees(Math.PI)).toBe(180);
      expect(toDegrees(2 * Math.PI)).toBe(360);
    });

    it('应该保持度和弧度转换的逆变换', () => {
      const degrees = [0, 45, 90, 180, 270, 360, -90, -180];
      for (const deg of degrees) {
        expect(toDegrees(toRadians(deg))).toBeCloseTo(deg, 5);
      }
    });
  });

  describe('参考系转换', () => {
    it('应该正确转换数学角度到航海角度', () => {
      expect(mathToNav(0)).toBe(90);   // 数学 0° (东) → 航海 90° (东)
      expect(mathToNav(90)).toBe(0);   // 数学 90° (北) → 航海 0° (北)
      expect(mathToNav(180)).toBe(270); // 数学 180° (西) → 航海 270° (西)
      expect(mathToNav(270)).toBe(180); // 数学 270° (南) → 航海 180° (南)
    });

    it('应该正确转换航海角度到数学角度', () => {
      expect(navToMath(90)).toBe(0);   // 航海 90° (东) → 数学 0° (东)
      expect(navToMath(0)).toBe(90);   // 航海 0° (北) → 数学 90° (北)
      expect(navToMath(270)).toBe(180); // 航海 270° (西) → 数学 180° (西)
      expect(navToMath(180)).toBe(270); // 航海 180° (南) → 数学 270° (南)
    });

    it('应该正确转换数学角度到屏幕角度', () => {
      expect(mathToScreen(0)).toBe(0);
      expect(mathToScreen(90)).toBe(270);
      expect(mathToScreen(180)).toBe(180);
      expect(mathToScreen(270)).toBe(90);
    });

    it('应该正确转换屏幕角度到数学角度', () => {
      expect(screenToMath(0)).toBe(0);
      expect(screenToMath(270)).toBe(90);
      expect(screenToMath(180)).toBe(180);
      expect(screenToMath(90)).toBe(270);
    });

    it('应该保持参考系转换的逆变换', () => {
      const angles = [0, 45, 90, 180, 270, 315];
      for (const angle of angles) {
        expect(navToMath(mathToNav(angle))).toBeCloseTo(angle, 5);
        expect(screenToMath(mathToScreen(angle))).toBeCloseTo(angle, 5);
      }
    });
  });
});