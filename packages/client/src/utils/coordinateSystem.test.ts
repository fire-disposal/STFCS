/**
 * 坐标系统行为一致性测试
 * 
 * 验证 CoordinateSystem 模块的函数行为与原有实现完全一致
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeAngle,
  normalizeRotation,
  screenToWorld,
  worldToScreen,
  screenDeltaToWorldDelta,
  angleDifference,
  toRadians,
  toDegrees,
} from '@/utils/coordinateSystem';

describe('CoordinateSystem - 行为一致性测试', () => {
  describe('normalizeAngle', () => {
    it('应该规范化角度到 0-360 范围', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(450)).toBe(90);
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-360)).toBe(0);
      expect(normalizeAngle(720)).toBe(0);
    });
  });

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

  describe('angleDifference', () => {
    it('应该计算两个角度之间的最短差值', () => {
      expect(angleDifference(0, 90)).toBe(90);
      expect(angleDifference(90, 0)).toBe(-90);
      expect(angleDifference(0, 180)).toBe(180);
      expect(angleDifference(0, 270)).toBe(-90); // 最短路径是顺时针 90 度
      expect(angleDifference(350, 10)).toBe(20); // 跨越 0 度的情况
    });
  });

  describe('screenToWorld', () => {
    it('应该正确转换屏幕坐标到世界坐标（无旋转）', () => {
      const result = screenToWorld(100, 50, 1, 1000, 1000, 0);
      expect(result.x).toBeCloseTo(1100, 5); // 1000 + 100/1
      expect(result.y).toBeCloseTo(1050, 5); // 1000 + 50/1
    });

    it('应该正确转换屏幕坐标到世界坐标（有缩放）', () => {
      const result = screenToWorld(100, 50, 2, 1000, 1000, 0);
      expect(result.x).toBeCloseTo(1050, 5); // 1000 + 100/2
      expect(result.y).toBeCloseTo(1025, 5); // 1000 + 50/2
    });

    it('应该正确转换屏幕坐标到世界坐标（90 度旋转）', () => {
      // 90 度逆时针旋转：屏幕 (100, 0) 应该对应世界 (-100, 0) 相对于相机
      const result = screenToWorld(100, 0, 1, 1000, 1000, 90);
      // cos(90°) = 0, sin(90°) = 1
      // rotatedX = 100*0 - 0*1 = 0
      // rotatedY = 100*1 + 0*0 = 100
      // worldX = 1000 + 0/1 = 1000
      // worldY = 1000 + 100/1 = 1100
      expect(result.x).toBeCloseTo(1000, 5);
      expect(result.y).toBeCloseTo(1100, 5);
    });
  });

  describe('worldToScreen', () => {
    it('应该正确转换世界坐标到屏幕坐标（无旋转）', () => {
      const result = worldToScreen(1100, 1050, 1, 1000, 1000, 0);
      expect(result.x).toBeCloseTo(100, 5); // (1100-1000)*1 = 100
      expect(result.y).toBeCloseTo(50, 5);  // (1050-1000)*1 = 50
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
      expect(result.x).toBeCloseTo(50, 5); // 100/2
      expect(result.y).toBeCloseTo(25, 5); // 50/2
    });

    it('应该正确转换屏幕向量到世界向量（90 度旋转）', () => {
      const result = screenDeltaToWorldDelta(100, 0, 1, 90);
      // cos(90°) = 0, sin(90°) = 1
      // rotatedX = 100*0 - 0*1 = 0
      // rotatedY = 100*1 + 0*0 = 100
      // worldX = 0/1 = 0
      // worldY = 100/1 = 100
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
      expect(normalizeAngle(450 - 0)).toBe(90);   // 数学 0° (东) → 航海 90° (东)
      expect(normalizeAngle(450 - 90)).toBe(0);   // 数学 90° (北) → 航海 0° (北)
      expect(normalizeAngle(450 - 180)).toBe(270); // 数学 180° (西) → 航海 270° (西)
    });

    it('应该正确转换数学角度到屏幕角度', () => {
      expect(normalizeAngle(360 - 0)).toBe(0);    // 数学 0° → 屏幕 0°
      expect(normalizeAngle(360 - 90)).toBe(270); // 数学 90° → 屏幕 270°
      expect(normalizeAngle(360 - 180)).toBe(180); // 数学 180° → 屏幕 180°
    });
  });
});
