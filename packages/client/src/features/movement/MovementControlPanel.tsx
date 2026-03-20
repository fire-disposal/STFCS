/**
 * 移动控制面板组件
 *
 * 集成到战术指挥面板中，提供：
 * - 三阶段移动控制
 * - 移动预览
 * - 快捷键支持
 * - 移动历史显示
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '@/store';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { MovementState, MovementPhase, MovementType } from '@vt/shared/types';
import {
  ChevronUp,
  ChevronDown,
  RotateCcw,
  SkipForward,
  CheckCircle,
  AlertCircle,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  RotateCcw as RotateCcwIcon,
} from 'lucide-react';

// 样式
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '8px',
    backgroundColor: 'rgba(15, 18, 25, 0.8)',
    borderRadius: '6px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  title: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'rgba(74, 158, 255, 1)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  phaseIndicator: {
    display: 'flex',
    gap: '4px',
  },
  phaseDot: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  phaseDotActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.8)',
    color: 'white',
    boxShadow: '0 0 8px rgba(74, 158, 255, 0.5)',
  },
  phaseDotComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
    color: 'white',
  },
  phaseDotPending: {
    backgroundColor: 'rgba(100, 116, 139, 0.4)',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  controlRow: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    fontSize: '11px',
    fontWeight: 'medium',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: '60px',
  },
  buttonHover: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
  },
  buttonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: 'rgba(74, 158, 255, 0.6)',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
  },
  buttonSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    color: 'rgba(34, 197, 94, 1)',
  },
  buttonWarning: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    color: 'rgba(234, 179, 8, 1)',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    fontSize: '11px',
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  infoValue: {
    color: 'rgba(74, 158, 255, 1)',
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center' as const,
    padding: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '4px',
  },
  errorText: {
    fontSize: '10px',
    color: 'rgba(239, 68, 68, 1)',
    textAlign: 'center' as const,
    padding: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  history: {
    maxHeight: '60px',
    overflowY: 'auto' as const,
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    borderTop: '1px solid rgba(74, 158, 255, 0.1)',
    paddingTop: '4px',
    marginTop: '4px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 4px',
  },
};

// 阶段名称
const phaseNames: Record<MovementPhase, string> = {
  1: '平移A',
  2: '转向',
  3: '平移B',
};

interface MovementControlPanelProps {
  shipId: string;
  movementState: MovementState;
  disabled?: boolean;
  onMove?: (type: MovementType, distance: number, angle?: number) => void;
  onRotate?: (angle: number) => void;
  onSkipPhase?: () => void;
  onEndMovement?: () => void;
}

export const MovementControlPanel: React.FC<MovementControlPanelProps> = ({
  shipId,
  movementState,
  disabled = false,
  onMove,
  onRotate,
  onSkipPhase,
  onEndMovement,
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [error, setError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const currentPhase = movementState.currentPhase;
  const allPhasesComplete = movementState.phase3Complete;

  // 清除错误
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 键盘快捷键
  useEffect(() => {
    if (disabled || allPhasesComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // 平移阶段快捷键
      if (currentPhase === 1 || currentPhase === 3) {
        const distance = movementState.maxSpeed;
        switch (key) {
          case 'w':
          case 'arrowup':
            e.preventDefault();
            handleMove('straight', distance);
            break;
          case 's':
          case 'arrowdown':
            e.preventDefault();
            handleMove('straight', -distance / 2);
            break;
          case 'a':
          case 'arrowleft':
            e.preventDefault();
            handleMove('strafe', -distance / 2);
            break;
          case 'd':
          case 'arrowright':
            e.preventDefault();
            handleMove('strafe', distance / 2);
            break;
        }
      }

      // 转向阶段快捷键
      if (currentPhase === 2) {
        const angle = movementState.maxTurnRate / 2;
        switch (key) {
          case 'q':
            e.preventDefault();
            handleRotate(-angle);
            break;
          case 'e':
            e.preventDefault();
            handleRotate(angle);
            break;
        }
      }

      // 通用快捷键
      if (key === 'tab') {
        e.preventDefault();
        handleSkipPhase();
      }
      if (key === 'enter' || key === ' ') {
        e.preventDefault();
        handleEndMovement();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, allPhasesComplete, currentPhase, movementState.maxSpeed, movementState.maxTurnRate]);

  // 处理移动
  const handleMove = useCallback((type: MovementType, distance: number) => {
    if (disabled || isMoving || allPhasesComplete) return;

    // 验证移动
    if (type === 'straight' && Math.abs(distance) > movementState.maxSpeed * 2) {
      setError(`移动距离超过最大值 ${movementState.maxSpeed * 2}`);
      return;
    }
    if (type === 'strafe' && Math.abs(distance) > movementState.maxSpeed) {
      setError(`横移距离超过最大值 ${movementState.maxSpeed}`);
      return;
    }

    setIsMoving(true);
    onMove?.(type, distance);

    // 发送到服务器
    websocketService.send({
      type: WS_MESSAGE_TYPES.SHIP_ACTION,
      payload: {
        shipId,
        actionType: 'move',
        actionData: {
          type,
          distance,
          phase: currentPhase,
        },
        timestamp: Date.now(),
      },
    });

    setTimeout(() => setIsMoving(false), 200);
  }, [disabled, isMoving, allPhasesComplete, movementState, shipId, currentPhase, onMove]);

  // 处理旋转
  const handleRotate = useCallback((angle: number) => {
    if (disabled || isMoving || allPhasesComplete) return;

    // 验证旋转
    if (Math.abs(angle) > movementState.maxTurnRate) {
      setError(`旋转角度超过最大值 ${movementState.maxTurnRate}°`);
      return;
    }

    setIsMoving(true);
    onRotate?.(angle);

    // 发送到服务器
    websocketService.send({
      type: WS_MESSAGE_TYPES.SHIP_ACTION,
      payload: {
        shipId,
        actionType: 'rotate',
        actionData: {
          angle,
          phase: currentPhase,
        },
        timestamp: Date.now(),
      },
    });

    setTimeout(() => setIsMoving(false), 200);
  }, [disabled, isMoving, allPhasesComplete, movementState, shipId, currentPhase, onRotate]);

  // 跳过当前阶段
  const handleSkipPhase = useCallback(() => {
    if (disabled || allPhasesComplete) return;

    onSkipPhase?.();

    websocketService.send({
      type: WS_MESSAGE_TYPES.SHIP_ACTION,
      payload: {
        shipId,
        actionType: 'skip_phase',
        actionData: {
          phase: currentPhase,
        },
        timestamp: Date.now(),
      },
    });
  }, [disabled, allPhasesComplete, shipId, currentPhase, onSkipPhase]);

  // 结束移动
  const handleEndMovement = useCallback(() => {
    if (disabled) return;

    onEndMovement?.();

    websocketService.send({
      type: WS_MESSAGE_TYPES.SHIP_ACTION,
      payload: {
        shipId,
        actionType: 'end_movement',
        timestamp: Date.now(),
      },
    });
  }, [disabled, shipId, onEndMovement]);

  // 渲染阶段指示器
  const renderPhaseIndicator = () => (
    <div style={styles.header}>
      <span style={styles.title}>
        <Move size={12} style={{ marginRight: '4px' }} />
        移动控制
      </span>
      <div style={styles.phaseIndicator}>
        {[1, 2, 3].map((phase) => {
          const phaseNum = phase as MovementPhase;
          const isComplete = phase === 1 ? movementState.phase1Complete
            : phase === 2 ? movementState.phase2Complete
              : movementState.phase3Complete;
          const isActive = phase === currentPhase && !isComplete;

          return (
            <div
              key={phase}
              style={{
                ...styles.phaseDot,
                ...(isActive ? styles.phaseDotActive : {}),
                ...(isComplete ? styles.phaseDotComplete : {}),
                ...(!isActive && !isComplete ? styles.phaseDotPending : {}),
              }}
              title={phaseNames[phaseNum]}
            >
              {isComplete ? <CheckCircle size={10} /> : phase}
            </div>
          );
        })}
      </div>
    </div>
  );

  // 渲染平移控制（阶段1和3）
  const renderTranslationControls = () => (
    <div style={styles.controls}>
      <div style={styles.controlRow}>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(disabled || isMoving ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleMove('straight', movementState.maxSpeed)}
          disabled={disabled || isMoving}
          title="前进 (W)"
        >
          <ArrowUp size={12} />
          前进
        </button>
      </div>
      <div style={styles.controlRow}>
        <button
          style={{
            ...styles.button,
            ...(disabled || isMoving ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleMove('strafe', -movementState.maxSpeed / 2)}
          disabled={disabled || isMoving}
          title="左横移 (A)"
        >
          <ArrowLeft size={12} />
          左移
        </button>
        <button
          style={{
            ...styles.button,
            ...(disabled || isMoving ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleMove('straight', -movementState.maxSpeed)}
          disabled={disabled || isMoving}
          title="后退 (S)"
        >
          <ArrowDown size={12} />
          后退
        </button>
        <button
          style={{
            ...styles.button,
            ...(disabled || isMoving ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleMove('strafe', movementState.maxSpeed / 2)}
          disabled={disabled || isMoving}
          title="右横移 (D)"
        >
          右移
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );

  // 渲染旋转控制（阶段2）
  const renderRotationControls = () => (
    <div style={styles.controls}>
      <div style={styles.controlRow}>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(disabled || isMoving ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleRotate(-movementState.maxTurnRate / 2)}
          disabled={disabled || isMoving}
          title="左转 (Q)"
        >
          <RotateCcwIcon size={12} />
          左转
        </button>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(disabled || isMoving ? styles.buttonDisabled : {}),
          }}
          onClick={() => handleRotate(movementState.maxTurnRate / 2)}
          disabled={disabled || isMoving}
          title="右转 (E)"
        >
          右转
          <RotateCw size={12} />
        </button>
      </div>
    </div>
  );

  // 渲染信息行
  const renderInfoRow = () => (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>阶段: </span>
      <span style={styles.infoValue}>{phaseNames[currentPhase]}</span>
      <span style={styles.infoLabel}> | 剩余移动: </span>
      <span style={styles.infoValue}>{movementState.remainingSpeed.toFixed(0)}</span>
      <span style={styles.infoLabel}> | 剩余转向: </span>
      <span style={styles.infoValue}>{movementState.remainingTurn.toFixed(0)}°</span>
    </div>
  );

  // 渲染操作按钮
  const renderActionButtons = () => (
    <div style={styles.controlRow}>
      <button
        style={{
          ...styles.button,
          ...styles.buttonWarning,
          ...(disabled || allPhasesComplete ? styles.buttonDisabled : {}),
        }}
        onClick={handleSkipPhase}
        disabled={disabled || allPhasesComplete}
        title="跳过当前阶段 (Tab)"
      >
        <SkipForward size={12} />
        跳过
      </button>
      <button
        style={{
          ...styles.button,
          ...styles.buttonSuccess,
          ...(disabled ? styles.buttonDisabled : {}),
        }}
        onClick={handleEndMovement}
        disabled={disabled}
        title="结束移动 (Enter)"
      >
        <CheckCircle size={12} />
        {allPhasesComplete ? '已完成' : '结束移动'}
      </button>
    </div>
  );

  // 渲染帮助文本
  const renderHelpText = () => {
    if (allPhasesComplete) {
      return (
        <div style={styles.helpText}>
          ✓ 移动阶段已完成
        </div>
      );
    }

    const helpTexts: Record<MovementPhase, string> = {
      1: 'W/S 前进/后退 | A/D 横移 | Tab 跳过',
      2: 'Q/E 左转/右转 | Tab 跳过',
      3: 'W/S 前进/后退 | A/D 横移 | Enter 结束',
    };

    return (
      <div style={styles.helpText}>
        {helpTexts[currentPhase]}
      </div>
    );
  };

  // 渲染错误信息
  const renderError = () => {
    if (!error) return null;

    return (
      <div style={styles.errorText}>
        <AlertCircle size={10} style={{ marginRight: '4px' }} />
        {error}
      </div>
    );
  };

  // 渲染移动历史
  const renderHistory = () => {
    if (movementState.movementHistory.length === 0) return null;

    return (
      <div style={styles.history}>
        {movementState.movementHistory.map((action, index) => (
          <div key={index} style={styles.historyItem}>
            <span>{action.type === 'rotate' ? '转向' : action.type === 'strafe' ? '横移' : '移动'}</span>
            <span>
              {action.type === 'rotate'
                ? `${action.angle?.toFixed(0)}°`
                : `${action.distance?.toFixed(0)}`}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderPhaseIndicator()}

      {!allPhasesComplete && (
        <>
          {currentPhase === 1 && renderTranslationControls()}
          {currentPhase === 2 && renderRotationControls()}
          {currentPhase === 3 && renderTranslationControls()}
        </>
      )}

      {renderInfoRow()}
      {renderActionButtons()}
      {renderHelpText()}
      {renderError()}
      {renderHistory()}
    </div>
  );
};

export default MovementControlPanel;