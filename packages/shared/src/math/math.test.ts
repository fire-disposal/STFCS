/**
 * 核心数学函数测试
 * 
 * 测试向量计算、角度计算、三阶段机动等核心功能
 */

import { describe, it, expect } from 'vitest';
import {
  distance,
  angleBetween,
  angleDifference,
  normalizeAngle,
  getForwardVector,
  getRightVector,
  calculateThreePhaseMove,
  validateThreePhaseMove,
  isPointInArc,
  toRadians,
  toDegrees,
} from './index.js';

describe('基础数学函数', () => {
  describe('distance', () => {
    it('计算两点之间的距离', () => {
      expect(distance(0, 0, 3, 4)).toBe(5);
      expect(distance(0, 0, 0, 0)).toBe(0);
      expect(distance(-3, -4, 3, 4)).toBe(10);
    });

    it('处理负坐标', () => {
      expect(distance(-5, -5, 5, 5)).toBeCloseTo(14.1421, 4);
    });
  });

  describe('toRadians / toDegrees', () => {
    it('角度转弧度', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 5);
      expect(toRadians(180)).toBeCloseTo(Math.PI, 5);
      expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 5);
    });

    it('弧度转角度', () => {
      expect(toDegrees(0)).toBe(0);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 5);
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 5);
      expect(toDegrees(2 * Math.PI)).toBeCloseTo(360, 5);
    });
  });

  describe('angleBetween', () => {
    it('计算两点之间的角度（标准数学坐标系）', () => {
      // angleBetween 使用标准数学坐标系：0 度是 +X 方向（右），逆时针增加
      expect(angleBetween(0, 0, 1, 0)).toBeCloseTo(0, 3);    // +X 方向 = 0 度
      expect(angleBetween(0, 0, 0, 1)).toBeCloseTo(90, 3);   // +Y 方向 = 90 度
      expect(angleBetween(0, 0, -1, 0)).toBeCloseTo(180, 3); // -X 方向 = 180 度
      expect(angleBetween(0, 0, 0, -1)).toBeCloseTo(270, 3); // -Y 方向 = 270 度
    });

    it('返回 0-360 范围的角度', () => {
      const angle = angleBetween(0, 0, 1, 1);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    });
  });

  describe('angleDifference', () => {
    it('计算两个角度之间的最小差值', () => {
      expect(angleDifference(0, 0)).toBe(0);
      expect(angleDifference(0, 90)).toBe(90);
      expect(angleDifference(0, 180)).toBe(180);
      expect(angleDifference(0, 270)).toBe(90); // 270 = -90
      expect(angleDifference(10, 350)).toBe(20); // 跨越 0 度
    });

    it('返回 0-180 范围的差值', () => {
      expect(angleDifference(45, 315)).toBe(90);
      expect(angleDifference(100, 260)).toBe(160);
    });
  });

  describe('normalizeAngle', () => {
    it('规范化角度到 0-360 范围', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(450)).toBe(90);
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-180)).toBe(180);
    });
  });
});

describe('向量函数', () => {
  describe('getForwardVector', () => {
    it('计算朝向前进向量（0 度朝上）', () => {
      const forward0 = getForwardVector(0);
      expect(forward0[0]).toBeCloseTo(0, 5);
      expect(forward0[1]).toBeCloseTo(-1, 5);

      const forward90 = getForwardVector(90);
      expect(forward90[0]).toBeCloseTo(1, 5);
      expect(forward90[1]).toBeCloseTo(0, 5);

      const forward180 = getForwardVector(180);
      expect(forward180[0]).toBeCloseTo(0, 5);
      expect(forward180[1]).toBeCloseTo(1, 5);
    });
  });

  describe('getRightVector', () => {
    it('计算右侧切线向量', () => {
      const right0 = getRightVector(0);
      expect(right0[0]).toBeCloseTo(1, 5);
      expect(right0[1]).toBeCloseTo(0, 5);

      const right90 = getRightVector(90);
      expect(right90[0]).toBeCloseTo(0, 5);
      expect(right90[1]).toBeCloseTo(1, 5);
    });
  });
});

describe('三阶段机动系统', () => {
  describe('calculateThreePhaseMove', () => {
    it('计算三阶段移动后的位置', () => {
      const result = calculateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 100,
          phaseAStrafe: 0,
          turnAngle: 0,
          phaseBForward: 100,
          phaseBStrafe: 0,
        }
      );

      // 朝向 0 度时，前进是向 -Y 方向
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(-200, 5);
      expect(result.heading).toBe(0);
    });

    it('处理转向后的移动', () => {
      const result = calculateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 100,
          phaseAStrafe: 0,
          turnAngle: 90,
          phaseBForward: 100,
          phaseBStrafe: 0,
        }
      );

      expect(result.heading).toBe(90);
      // 阶段 A 向 -Y，转向 90 度后，阶段 B 向 +X
      expect(result.y).toBeCloseTo(-100, 5);
      expect(result.x).toBeGreaterThan(0);
    });

    it('处理侧移', () => {
      const result = calculateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 0,
          phaseAStrafe: 50,
          turnAngle: 0,
          phaseBForward: 0,
          phaseBStrafe: 50,
        }
      );

      // 朝向 0 度时，右侧是 +X 方向
      expect(result.x).toBeCloseTo(100, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });
  });

  describe('validateThreePhaseMove', () => {
    const maxSpeed = 100;
    const maxTurnRate = 45;

    it('验证有效的移动计划', () => {
      const validation = validateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 100,
          phaseAStrafe: 50,
          turnAngle: 30,
          phaseBForward: 100,
          phaseBStrafe: 50,
        },
        maxSpeed,
        maxTurnRate
      );

      expect(validation.valid).toBe(true);
      expect(validation.finalPosition).toBeDefined();
      expect(validation.finalHeading).toBeDefined();
    });

    it('拒绝超过最大前进距离的计划', () => {
      const validation = validateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 250, // 超过 2X = 200
          phaseAStrafe: 0,
          turnAngle: 0,
          phaseBForward: 0,
          phaseBStrafe: 0,
        },
        maxSpeed,
        maxTurnRate
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Phase A forward distance');
    });

    it('拒绝超过最大侧移距离的计划', () => {
      const validation = validateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 0,
          phaseAStrafe: 150, // 超过 X = 100
          turnAngle: 0,
          phaseBForward: 0,
          phaseBStrafe: 0,
        },
        maxSpeed,
        maxTurnRate
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Phase A strafe distance');
    });

    it('拒绝超过最大转向角度的计划', () => {
      const validation = validateThreePhaseMove(
        0, 0, 0,
        {
          phaseAForward: 0,
          phaseAStrafe: 0,
          turnAngle: 60, // 超过 Y = 45
          phaseBForward: 0,
          phaseBStrafe: 0,
        },
        maxSpeed,
        maxTurnRate
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Turn angle');
    });
  });
});

describe('射界判定', () => {
  describe('isPointInArc', () => {
    it('检测点是否在扇形区域内', () => {
      // 中心在 (0, 0)，朝向 0 度（+X 方向），射界 90 度，射程 100
      // 射界范围是 -45 度到 +45 度（即 315 度到 45 度）
      expect(isPointInArc(100, 0, 0, 0, 0, 90, 100)).toBe(true);  // 在 0 度方向上
      expect(isPointInArc(70, 30, 0, 0, 0, 90, 100)).toBe(true);  // 在 30 度方向上
    });

    it('拒绝超出射程的点', () => {
      expect(isPointInArc(150, 0, 0, 0, 0, 90, 100)).toBe(false);
    });

    it('拒绝超出射界角度的点', () => {
      // 点在 90 度方向（+Y），不在 0 度朝向的 90 度射界内（-45 到 +45 度）
      expect(isPointInArc(0, 100, 0, 0, 0, 90, 100)).toBe(false);
      // 点在 270 度方向（-Y），不在射界内
      expect(isPointInArc(0, -100, 0, 0, 0, 90, 100)).toBe(false);
    });

    it('处理边缘情况', () => {
      // 点正好在射界边缘（45 度）
      expect(isPointInArc(70.71, 70.71, 0, 0, 0, 90, 100)).toBe(true);
    });
  });
});
