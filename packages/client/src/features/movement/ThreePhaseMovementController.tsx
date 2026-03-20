/**
 * 三阶段移动控制器
 *
 * 实现基于 Starsector 的三阶段移动系统：
 * - 阶段1 (平移A)：沿当前朝向前进/后退或横移
 * - 阶段2 (转向)：原地旋转
 * - 阶段3 (平移B)：沿新朝向前进/后退或横移
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { MovementState, MovementPhase, MovementType } from '@vt/shared/types';

// 样式
const styles = {
  container: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  header: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseIndicator: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  phaseDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
  },
  phaseDotActive: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    boxShadow: '0 0 8px var(--color-primary)',
  },
  phaseDotComplete: {
    backgroundColor: 'var(--color-success)',
    color: 'white',
  },
  phaseDotPending: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text-secondary)',
  },
  phaseLabel: {
    fontSize: '11px',
    textAlign: 'center' as const,
    marginTop: '4px',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  controlLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--color-text-secondary)',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    flex: 1,
    padding: '10px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text)',
  },
  buttonPrimary: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  slider: {
    width: '100%',
    marginTop: '8px',
  },
  sliderValue: {
    textAlign: 'center' as const,
    fontSize: '13px',
    marginTop: '4px',
  },
  info: {
    padding: '12px',
    backgroundColor: 'var(--color-info-light)',
    borderRadius: '4px',
    fontSize: '12px',
    marginTop: '12px',
  },
  resources: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderTop: '1px solid var(--color-border)',
    marginTop: '12px',
    fontSize: '13px',
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

interface ThreePhaseMovementControllerProps {
  movementState: MovementState;
  onMove: (type: MovementType, distance: number, angle?: number) => void;
  onRotate: (angle: number) => void;
  onEndMovement: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

export const ThreePhaseMovementController: React.FC<ThreePhaseMovementControllerProps> = ({
  movementState,
  onMove,
  onRotate,
  onEndMovement,
  onReset,
  disabled = false,
}) => {
  const [moveDistance, setMoveDistance] = useState(0);
  const [rotateAngle, setRotateAngle] = useState(0);

  // 当前阶段
  const currentPhase = movementState.currentPhase;

  // 是否可以执行当前阶段
  const canExecutePhase = useCallback((phase: MovementPhase): boolean => {
    switch (phase) {
      case 1:
        return !movementState.phase1Complete;
      case 2:
        return movementState.phase1Complete && !movementState.phase2Complete;
      case 3:
        return movementState.phase1Complete && movementState.phase2Complete && !movementState.phase3Complete;
      default:
        return false;
    }
  }, [movementState]);

  // 是否所有阶段完成
  const allPhasesComplete = movementState.phase3Complete;

  // 处理前进
  const handleMoveForward = useCallback(() => {
    if (disabled || !canExecutePhase(currentPhase)) return;
    onMove('straight', moveDistance > 0 ? moveDistance : movementState.maxSpeed);
  }, [disabled, canExecutePhase, currentPhase, moveDistance, movementState.maxSpeed, onMove]);

  // 处理后退
  const handleMoveBackward = useCallback(() => {
    if (disabled || !canExecutePhase(currentPhase)) return;
    onMove('straight', -(moveDistance > 0 ? moveDistance : movementState.maxSpeed / 2));
  }, [disabled, canExecutePhase, currentPhase, moveDistance, movementState.maxSpeed, onMove]);

  // 处理横移
  const handleStrafe = useCallback((direction: 'left' | 'right') => {
    if (disabled || !canExecutePhase(currentPhase)) return;
    const distance = moveDistance > 0 ? moveDistance : movementState.maxSpeed / 2;
    onMove('strafe', direction === 'left' ? -distance : distance);
  }, [disabled, canExecutePhase, currentPhase, moveDistance, movementState.maxSpeed, onMove]);

  // 处理旋转
  const handleRotate = useCallback((direction: 'left' | 'right') => {
    if (disabled || !canExecutePhase(currentPhase)) return;
    const angle = rotateAngle > 0 ? rotateAngle : movementState.maxTurnRate;
    onRotate(direction === 'left' ? -angle : angle);
  }, [disabled, canExecutePhase, currentPhase, rotateAngle, movementState.maxTurnRate, onRotate]);

  // 处理结束移动
  const handleEndMovement = useCallback(() => {
    onEndMovement();
  }, [onEndMovement]);

  // 渲染阶段指示器
  const renderPhaseIndicator = () => (
    <div style={styles.phaseIndicator}>
      {[1, 2, 3].map(phase => {
        const isComplete = phase === 1 ? movementState.phase1Complete
          : phase === 2 ? movementState.phase2Complete
            : movementState.phase3Complete;
        const isActive = phase === currentPhase && !isComplete;

        return (
          <div key={phase} style={{ flex: 1, textAlign: 'center' }}>
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
              {phaseNames[phase as MovementPhase]}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 渲染移动控制（阶段1和3）
  const renderMovementControls = () => (
    <div style={styles.controls}>
      <div style={styles.controlGroup}>
        <div style={styles.controlLabel}>移动距离</div>
        <input
          type="range"
          min={0}
          max={movementState.maxSpeed * 2}
          value={moveDistance}
          onChange={e => setMoveDistance(Number(e.target.value))}
          style={styles.slider}
          disabled={disabled}
        />
        <div style={styles.sliderValue}>
          {moveDistance} / {movementState.maxSpeed * 2} 单位
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button
          style={{
            ...styles.button,
            ...(!canExecutePhase(currentPhase) || disabled ? styles.buttonDisabled : {}),
          }}
          onClick={handleMoveForward}
          disabled={!canExecutePhase(currentPhase) || disabled}
        >
          ↑ 前进
        </button>
        <button
          style={{
            ...styles.button,
            ...(!canExecutePhase(currentPhase) || disabled ? styles.buttonDisabled : {}),
          }}
          onClick={handleMoveBackward}
          disabled={!canExecutePhase(currentPhase) || disabled}
        >
          ↓ 后退
        </button>
      </div>

      <div style={styles.buttonRow}>
        <button
          style={{
            ...styles.button,
            ...(!canExecutePhase(currentPhase) || disabled ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleStrafe('left')}
          disabled={!canExecutePhase(currentPhase) || disabled}
        >
          ← 左移
        </button>
        <button
          style={{
            ...styles.button,
            ...(!canExecutePhase(currentPhase) || disabled ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleStrafe('right')}
          disabled={!canExecutePhase(currentPhase) || disabled}
        >
          → 右移
        </button>
      </div>
    </div>
  );

  // 渲染旋转控制（阶段2）
  const renderRotationControls = () => (
    <div style={styles.controls}>
      <div style={styles.controlGroup}>
        <div style={styles.controlLabel}>旋转角度</div>
        <input
          type="range"
          min={0}
          max={movementState.maxTurnRate}
          value={rotateAngle}
          onChange={e => setRotateAngle(Number(e.target.value))}
          style={styles.slider}
          disabled={disabled}
        />
        <div style={styles.sliderValue}>
          {rotateAngle}° / {movementState.maxTurnRate}°
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button
          style={{
            ...styles.button,
            ...(!canExecutePhase(currentPhase) || disabled ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleRotate('left')}
          disabled={!canExecutePhase(currentPhase) || disabled}
        >
          ↺ 左转
        </button>
        <button
          style={{
            ...styles.button,
            ...(!canExecutePhase(currentPhase) || disabled ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleRotate('right')}
          disabled={!canExecutePhase(currentPhase) || disabled}
        >
          ↻ 右转
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>移动控制</span>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          阶段 {currentPhase}/3
        </span>
      </div>

      {/* 阶段指示器 */}
      {renderPhaseIndicator()}

      {/* 当前阶段控制 */}
      {!allPhasesComplete && (
        <>
          {currentPhase === 1 && renderMovementControls()}
          {currentPhase === 2 && renderRotationControls()}
          {currentPhase === 3 && renderMovementControls()}
        </>
      )}

      {/* 阶段说明 */}
      <div style={styles.info}>
        <strong>{phaseNames[currentPhase]}:</strong> {phaseDescriptions[currentPhase]}
      </div>

      {/* 剩余资源 */}
      <div style={styles.resources}>
        <span>剩余移动: {movementState.remainingSpeed}</span>
        <span>剩余转向: {movementState.remainingTurn}°</span>
      </div>

      {/* 结束移动按钮 */}
      <div style={{ marginTop: '12px' }}>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            width: '100%',
          }}
          onClick={handleEndMovement}
          disabled={disabled}
        >
          {allPhasesComplete ? '移动完成' : '结束移动阶段'}
        </button>
      </div>
    </div>
  );
};

export default ThreePhaseMovementController;