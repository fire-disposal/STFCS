/**
 * 移动预览组件
 *
 * 在画布上显示移动预览：
 * - 移动路径预览
 * - 移动范围指示
 * - 阶段状态显示
 */

import React, { useMemo, useCallback } from 'react';
import type { MovementState, MovementPhase, MovementAction } from '@vt/shared/types';
import type { Point } from '@vt/shared/core-types';

// 样式
const styles = {
  container: {
    position: 'absolute' as const,
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none' as const,
    zIndex: 100,
  },
  phaseIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '8px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '20px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
  },
  phaseDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
  },
  phaseDotActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.8)',
    color: 'white',
    boxShadow: '0 0 10px rgba(74, 158, 255, 0.5)',
  },
  phaseDotComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
    color: 'white',
  },
  phaseDotPending: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  phaseLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center' as const,
    marginTop: '2px',
  },
  infoPanel: {
    padding: '8px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: 'white',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  infoValue: {
    fontWeight: 'bold',
    color: 'rgba(74, 158, 255, 1)',
  },
  helpText: {
    padding: '6px 12px',
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderRadius: '4px',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    fontSize: '11px',
    color: 'rgba(234, 179, 8, 1)',
    maxWidth: '300px',
    textAlign: 'center' as const,
  },
};

// 阶段名称
const phaseNames: Record<MovementPhase, string> = {
  1: '平移A',
  2: '转向',
  3: '平移B',
};

// 阶段描述
const phaseDescriptions: Record<MovementPhase, string> = {
  1: '沿当前朝向移动或横移',
  2: '原地旋转舰船',
  3: '沿新朝向移动或横移',
};

// 阶段快捷键提示
const phaseHelpText: Record<MovementPhase, string> = {
  1: 'W/S 前进/后退 | A/D 横移 | 拖拽移动',
  2: 'Q/E 左转/右转 | 滚轮调整角度',
  3: 'W/S 前进/后退 | A/D 横移 | 拖拽移动',
};

interface MovementPreviewProps {
  movementState: MovementState;
  currentPosition: Point;
  currentHeading: number;
  previewPosition?: Point;
  previewHeading?: number;
  isValidMove?: boolean;
  showHelp?: boolean;
}

export const MovementPreview: React.FC<MovementPreviewProps> = ({
  movementState,
  currentPosition,
  currentHeading,
  previewPosition,
  previewHeading,
  isValidMove = true,
  showHelp = true,
}) => {
  const currentPhase = movementState.currentPhase;

  // 计算移动距离
  const moveDistance = useMemo(() => {
    if (!previewPosition) return 0;
    const dx = previewPosition.x - currentPosition.x;
    const dy = previewPosition.y - currentPosition.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, [previewPosition, currentPosition]);

  // 计算旋转角度
  const rotateAngle = useMemo(() => {
    if (previewHeading === undefined) return 0;
    let diff = previewHeading - currentHeading;
    // 标准化到 -180 到 180
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }, [previewHeading, currentHeading]);

  // 渲染阶段指示器
  const renderPhaseIndicator = () => (
    <div style={styles.phaseIndicator}>
      {[1, 2, 3].map((phase) => {
        const phaseNum = phase as MovementPhase;
        const isComplete = phase === 1 ? movementState.phase1Complete
          : phase === 2 ? movementState.phase2Complete
            : movementState.phase3Complete;
        const isActive = phase === currentPhase && !isComplete;

        return (
          <div key={phase} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                ...styles.phaseDot,
                ...(isActive ? styles.phaseDotActive : {}),
                ...(isComplete ? styles.phaseDotComplete : {}),
                ...(!isActive && !isComplete ? styles.phaseDotPending : {}),
              }}
            >
              {isComplete ? '✓' : phase}
            </div>
            <div style={styles.phaseLabel}>
              {phaseNames[phaseNum]}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 渲染信息面板
  const renderInfoPanel = () => {
    const isTranslationPhase = currentPhase === 1 || currentPhase === 3;
    const isRotationPhase = currentPhase === 2;

    return (
      <div style={styles.infoPanel}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>阶段:</span>
          <span style={styles.infoValue}>{phaseNames[currentPhase]}</span>
        </div>
        {isTranslationPhase && (
          <>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>移动:</span>
              <span style={{
                ...styles.infoValue,
                color: moveDistance > movementState.maxSpeed * 2 ? '#ef4444' : '#4a9eff',
              }}>
                {moveDistance.toFixed(1)} / {movementState.maxSpeed * 2}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>剩余:</span>
              <span style={styles.infoValue}>{movementState.remainingSpeed.toFixed(1)}</span>
            </div>
          </>
        )}
        {isRotationPhase && (
          <>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>旋转:</span>
              <span style={{
                ...styles.infoValue,
                color: Math.abs(rotateAngle) > movementState.maxTurnRate ? '#ef4444' : '#4a9eff',
              }}>
                {rotateAngle.toFixed(1)}° / ±{movementState.maxTurnRate}°
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>剩余:</span>
              <span style={styles.infoValue}>{movementState.remainingTurn.toFixed(1)}°</span>
            </div>
          </>
        )}
      </div>
    );
  };

  // 渲染帮助文本
  const renderHelpText = () => {
    if (!showHelp) return null;

    return (
      <div style={styles.helpText}>
        {phaseHelpText[currentPhase]}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderPhaseIndicator()}
      {renderInfoPanel()}
      {renderHelpText()}
    </div>
  );
};

/**
 * 移动路径渲染器
 * 用于在 PixiJS 画布上绘制移动路径
 */
export class MovementPathRenderer {
  private graphics: PIXI.Graphics | null = null;

  constructor() {
    // Graphics will be created when needed
  }

  /**
   * 绘制移动路径
   */
  drawPath(
    graphics: PIXI.Graphics,
    startPos: Point,
    endPos: Point,
    startHeading: number,
    endHeading: number,
    phase: MovementPhase,
    isValid: boolean
  ): void {
    graphics.clear();

    const color = isValid ? 0x4a9eff : 0xef4444;
    const alpha = 0.8;

    // 绘制起点
    graphics.circle(startPos.x, startPos.y, 5);
    graphics.fill({ color: 0xffffff, alpha: 0.5 });

    // 绘制路径线
    graphics.setStrokeStyle({ width: 2, color, alpha });
    graphics.moveTo(startPos.x, startPos.y);

    if (phase === 1 || phase === 3) {
      // 平移阶段：绘制直线
      graphics.lineTo(endPos.x, endPos.y);
    } else if (phase === 2) {
      // 转向阶段：绘制弧线
      const radius = 30;
      const startRad = (startHeading * Math.PI) / 180;
      const endRad = (endHeading * Math.PI) / 180;
      graphics.arc(startPos.x, startPos.y, radius, startRad, endRad);
    }

    graphics.stroke();

    // 绘制终点
    graphics.circle(endPos.x, endPos.y, 8);
    graphics.fill({ color, alpha: 0.3 });
    graphics.setStrokeStyle({ width: 2, color, alpha: 1 });
    graphics.stroke();

    // 绘制朝向指示器
    const arrowLength = 20;
    const arrowAngle = (endHeading * Math.PI) / 180;
    const arrowX = endPos.x + Math.cos(arrowAngle) * arrowLength;
    const arrowY = endPos.y + Math.sin(arrowAngle) * arrowLength;

    graphics.setStrokeStyle({ width: 2, color, alpha });
    graphics.moveTo(endPos.x, endPos.y);
    graphics.lineTo(arrowX, arrowY);
    graphics.stroke();

    // 绘制箭头头部
    const headLength = 8;
    const headAngle = 0.5;
    graphics.moveTo(arrowX, arrowY);
    graphics.lineTo(
      arrowX - Math.cos(arrowAngle - headAngle) * headLength,
      arrowY - Math.sin(arrowAngle - headAngle) * headLength
    );
    graphics.moveTo(arrowX, arrowY);
    graphics.lineTo(
      arrowX - Math.cos(arrowAngle + headAngle) * headLength,
      arrowY - Math.sin(arrowAngle + headAngle) * headLength
    );
    graphics.stroke();
  }

  /**
   * 绘制移动范围指示
   */
  drawMovementRange(
    graphics: PIXI.Graphics,
    center: Point,
    heading: number,
    maxSpeed: number,
    maxTurnRate: number,
    phase: MovementPhase
  ): void {
    graphics.clear();

    const rangeColor = 0x4a9eff;
    const rangeAlpha = 0.2;

    if (phase === 1 || phase === 3) {
      // 平移阶段：绘制扇形范围
      const forwardRange = maxSpeed * 2;
      const strafeRange = maxSpeed;

      // 前进范围（前方扇形）
      graphics.moveTo(center.x, center.y);
      const headingRad = (heading * Math.PI) / 180;
      const arcStart = headingRad - Math.PI / 3;
      const arcEnd = headingRad + Math.PI / 3;
      graphics.arc(center.x, center.y, forwardRange, arcStart, arcEnd);
      graphics.lineTo(center.x, center.y);
      graphics.fill({ color: rangeColor, alpha: rangeAlpha });

      // 横移范围（两侧）
      graphics.moveTo(center.x, center.y);
      const leftStrafeX = center.x + Math.cos(headingRad + Math.PI / 2) * strafeRange;
      const leftStrafeY = center.y + Math.sin(headingRad + Math.PI / 2) * strafeRange;
      graphics.lineTo(leftStrafeX, leftStrafeY);
      graphics.stroke();

      graphics.moveTo(center.x, center.y);
      const rightStrafeX = center.x + Math.cos(headingRad - Math.PI / 2) * strafeRange;
      const rightStrafeY = center.y + Math.sin(headingRad - Math.PI / 2) * strafeRange;
      graphics.lineTo(rightStrafeX, rightStrafeY);
      graphics.stroke();
    } else if (phase === 2) {
      // 转向阶段：绘制旋转范围
      const headingRad = (heading * Math.PI) / 180;
      const leftRad = headingRad - (maxTurnRate * Math.PI) / 180;
      const rightRad = headingRad + (maxTurnRate * Math.PI) / 180;

      graphics.moveTo(center.x, center.y);
      graphics.arc(center.x, center.y, 50, leftRad, rightRad);
      graphics.lineTo(center.x, center.y);
      graphics.fill({ color: rangeColor, alpha: rangeAlpha });

      // 绘制旋转边界线
      graphics.setStrokeStyle({ width: 1, color: rangeColor, alpha: 0.5 });
      graphics.moveTo(center.x, center.y);
      graphics.lineTo(
        center.x + Math.cos(leftRad) * 50,
        center.y + Math.sin(leftRad) * 50
      );
      graphics.moveTo(center.x, center.y);
      graphics.lineTo(
        center.x + Math.cos(rightRad) * 50,
        center.y + Math.sin(rightRad) * 50
      );
      graphics.stroke();
    }
  }

  /**
   * 清除绘制
   */
  clear(graphics: PIXI.Graphics): void {
    graphics.clear();
  }
}

export default MovementPreview;