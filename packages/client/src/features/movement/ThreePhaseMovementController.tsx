/**
 * 三阶段移动控制器组件
 * 
 * 支持：
 * - 三个阶段独立执行
 * - 可以在任何阶段进行攻击
 * - 攻击后不切换阶段，可以继续移动
 * - 过渡动画
 */

import React, { useMemo, useCallback } from 'react';
import type { ShipState } from '@vt/contracts';
import { useAppSelector, useAppDispatch } from '@/store';
import { 
  startMovement,
  setCurrentPlan, 
  clearCurrentPlan, 
  updateValidation,
  setMovementRange,
  markMoveExecuted,
  advancePhase,
  executePhase,
  completePhase,
  registerAttack,
  MovementPhase,
} from '@/store/slices/movementSlice';
import { selectCurrentShip } from '@/store/slices/shipSlice';
import { ClientCommand } from '@vt/contracts';
import type { MovementPlan } from '@/store/slices/movementSlice';
import { MovementResourceDisplay } from '@/features/ui/MovementResourceDisplay';
import { notify } from '@/components/ui/Notification';

const styles = {
  container: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    marginBottom: '12px',
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#cfe8ff',
    marginBottom: '12px',
    borderBottom: '1px solid #2b4261',
    paddingBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseIndicator: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
  },
  phaseStep: {
    flex: 1,
    padding: '8px 4px',
    backgroundColor: 'rgba(20, 30, 40, 0.6)',
    border: '1px solid #2b4261',
    borderRadius: '4px',
    textAlign: 'center' as const,
    fontSize: '10px',
    color: '#6b7280',
    transition: 'all 0.3s',
  },
  phaseStepActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  phaseStepCompleted: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: '#2ecc71',
    color: '#2ecc71',
  },
  phaseGroup: {
    marginBottom: '16px',
  },
  phaseTitle: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#7aa2d4',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  inputGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  label: {
    fontSize: '10px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%',
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.5)',
    border: '1px solid #2b4261',
    borderRadius: '0',
    color: '#cfe8ff',
    fontSize: '12px',
    outline: 'none',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  button: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '0',
    border: 'none',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    backgroundColor: '#1a4a7a',
    color: '#4a9eff',
  },
  buttonAttack: {
    backgroundColor: '#5a2a3a',
    color: '#ff6f8f',
  },
  buttonNext: {
    backgroundColor: '#1a5a3a',
    color: '#2ecc71',
  },
  buttonDanger: {
    backgroundColor: '#5a2a3a',
    color: '#ff6f8f',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  validationError: {
    padding: '8px',
    background: 'rgba(255, 74, 74, 0.15)',
    border: '1px solid #ff4a4a',
    color: '#ff6f8f',
    fontSize: '11px',
    marginTop: '8px',
  },
  rangeInfo: {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '8px',
  },
  attackStatus: {
    padding: '12px',
    backgroundColor: 'rgba(255, 100, 100, 0.1)',
    border: '1px solid rgba(255, 100, 100, 0.3)',
    borderRadius: '4px',
    marginTop: '12px',
  },
  attackStatusText: {
    fontSize: '11px',
    color: '#ff6f8f',
    textAlign: 'center' as const,
  },
};

interface MovementPhaseInputs {
  phaseAForward: number;
  phaseAStrafe: number;
  turnAngle: number;
  phaseBForward: number;
  phaseBStrafe: number;
}

interface ThreePhaseMovementControllerProps {
  ship: ShipState | null;
  networkManager: any;
  onClose: () => void;
  onOpenAttack: () => void;
}

export const ThreePhaseMovementController: React.FC<ThreePhaseMovementControllerProps> = ({
  ship,
  networkManager,
  onClose,
  onOpenAttack,
}) => {
  const dispatch = useAppDispatch();
  const movementState = useAppSelector((state: any) => state.movement);
  const selectedShipId = useAppSelector(selectCurrentShip);

  // 本地输入状态
  const [inputs, setInputs] = React.useState<MovementPhaseInputs>({
    phaseAForward: 0,
    phaseAStrafe: 0,
    turnAngle: 0,
    phaseBForward: 0,
    phaseBStrafe: 0,
  });

  // 舰船机动参数
  const maxSpeed = ship?.maxSpeed || 100;
  const maxTurnRate = ship?.maxTurnRate || 45;

  // 阶段名称
  const phaseNames: Record<MovementPhase, string> = {
    [MovementPhase.NONE]: '准备',
    [MovementPhase.PHASE_A]: 'A - 平移',
    [MovementPhase.PHASE_B]: 'B - 转向',
    [MovementPhase.PHASE_C]: 'C - 平移',
    [MovementPhase.COMPLETED]: '完成',
  } as const;

  // 计算机动范围
  const calculateMovementRange = useCallback(() => {
    if (!ship) return;

    const range: { x: number; y: number; reachable: boolean; distance: number }[] = [];
    const steps = 36;

    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 360;
      for (let dist = 0; dist <= maxSpeed * 4; dist += 10) {
        const rad = (angle * Math.PI) / 180;
        range.push({
          x: ship.transform.x + Math.cos(rad) * dist,
          y: ship.transform.y + Math.sin(rad) * dist,
          reachable: dist <= maxSpeed * 4,
          distance: dist,
        });
      }
    }

    dispatch(setMovementRange(range));
  }, [ship, maxSpeed, dispatch]);

  // 验证当前阶段输入
  const validateCurrentPhase = useCallback((): { isValid: boolean; error?: string } => {
    const phase = movementState.currentPhase;
    
    if (phase === MovementPhase.PHASE_A) {
      if (Math.abs(inputs.phaseAForward) > maxSpeed * 2) {
        return {
          isValid: false,
          error: `阶段 A 前进距离超出限制 (最大 ${maxSpeed * 2})`,
        };
      }
      if (Math.abs(inputs.phaseAStrafe) > maxSpeed) {
        return {
          isValid: false,
          error: `阶段 A 侧移距离超出限制 (最大 ${maxSpeed})`,
        };
      }
    } else if (phase === MovementPhase.PHASE_B) {
      if (Math.abs(inputs.turnAngle) > maxTurnRate) {
        return {
          isValid: false,
          error: `转向角度超出限制 (最大 ${maxTurnRate}°)`,
        };
      }
    } else if (phase === MovementPhase.PHASE_C) {
      if (Math.abs(inputs.phaseBForward) > maxSpeed * 2) {
        return {
          isValid: false,
          error: `阶段 C 前进距离超出限制 (最大 ${maxSpeed * 2})`,
        };
      }
      if (Math.abs(inputs.phaseBStrafe) > maxSpeed) {
        return {
          isValid: false,
          error: `阶段 C 侧移距离超出限制 (最大 ${maxSpeed})`,
        };
      }
    }

    return { isValid: true };
  }, [inputs, movementState.currentPhase, maxSpeed, maxTurnRate]);

  // 输入变化时验证
  React.useEffect(() => {
    const result = validateCurrentPhase();
    dispatch(updateValidation(result));
  }, [inputs, validateCurrentPhase, dispatch]);

  // 输入处理
  const handleInputChange = useCallback((field: keyof MovementPhaseInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs(prev => ({ ...prev, [field]: numValue }));
  }, []);

  // 执行当前阶段移动
  const handleExecutePhase = useCallback(async () => {
    if (!ship || !movementState.isValid) return;

    let movementPlan: MovementPlan = {
      phaseAForward: 0,
      phaseAStrafe: 0,
      turnAngle: 0,
      phaseBForward: 0,
      phaseBStrafe: 0,
    };
    
    // 根据当前阶段设置对应的参数
    switch (movementState.currentPhase) {
      case MovementPhase.PHASE_A:
        movementPlan.phaseAForward = inputs.phaseAForward;
        movementPlan.phaseAStrafe = inputs.phaseAStrafe;
        break;
      case MovementPhase.PHASE_B:
        movementPlan.turnAngle = inputs.turnAngle;
        break;
      case MovementPhase.PHASE_C:
        movementPlan.phaseBForward = inputs.phaseBForward;
        movementPlan.phaseBStrafe = inputs.phaseBStrafe;
        break;
    }

    try {
      // 开始执行动画
      dispatch(executePhase({
        phase: movementState.currentPhase,
        forward: movementState.currentPhase === MovementPhase.PHASE_B ? undefined : 
          (movementState.currentPhase === MovementPhase.PHASE_A ? inputs.phaseAForward : inputs.phaseBForward),
        strafe: movementState.currentPhase === MovementPhase.PHASE_B ? undefined :
          (movementState.currentPhase === MovementPhase.PHASE_A ? inputs.phaseAStrafe : inputs.phaseBStrafe),
        turn: movementState.currentPhase === MovementPhase.PHASE_B ? inputs.turnAngle : undefined,
      }));

      // 发送移动指令
      await networkManager.getCurrentRoom()?.send(ClientCommand.CMD_MOVE_TOKEN, {
        shipId: ship.id,
        x: ship.transform.x,
        y: ship.transform.y,
        heading: ship.transform.heading,
        movementPlan,
        phase: movementState.currentPhase,
      });

      // 模拟动画时间（实际应该监听服务端确认）
      setTimeout(() => {
        const currentPhaseName = phaseNames[movementState.currentPhase as keyof typeof phaseNames];
        dispatch(completePhase(movementState.currentPhase));
        dispatch(advancePhase()); // 进入下一阶段
        notify.success(`${currentPhaseName} 移动完成`);
      }, 1000);
      
      console.log('[Movement] Phase executed:', movementState.currentPhase, movementPlan);
    } catch (error) {
      console.error('[Movement] Failed to execute phase:', error);
      dispatch(completePhase(movementState.currentPhase));
    }
  }, [ship, inputs, movementState, networkManager, dispatch, phaseNames]);

  // 执行攻击
  const handleAttack = useCallback(() => {
    if (onOpenAttack) {
      onOpenAttack();
    }
    
    // 注册攻击（不切换阶段）
    dispatch(registerAttack());
    notify.info('武器系统就绪，请选择目标');
  }, [onOpenAttack, dispatch]);

  // 取消移动
  const handleCancel = useCallback(() => {
    dispatch(clearCurrentPlan());
    setInputs({
      phaseAForward: 0,
      phaseAStrafe: 0,
      turnAngle: 0,
      phaseBForward: 0,
      phaseBStrafe: 0,
    });
    onClose();
  }, [dispatch, onClose]);

  // 初始化时计算机动范围
  React.useEffect(() => {
    calculateMovementRange();
    return () => {
      dispatch(setMovementRange([]));
    };
  }, [ship, calculateMovementRange, dispatch]);

  // 开始移动流程
  React.useEffect(() => {
    if (movementState.currentPhase === MovementPhase.NONE && ship) {
      dispatch(startMovement({
        phaseAForward: 0,
        phaseAStrafe: 0,
        turnAngle: 0,
        phaseBForward: 0,
        phaseBStrafe: 0,
      }));
    }
  }, [movementState.currentPhase, ship, dispatch]);

  if (!ship) {
    return <div style={styles.container}>请先选择舰船</div>;
  }

  const phase = movementState.currentPhase;
  const isAnimating = movementState.isAnimating;
  const attackCount = movementState.attacks.attackCount;

  // 渲染阶段指示器
  const renderPhaseIndicator = () => {
    const phases: MovementPhase[] = [
      MovementPhase.PHASE_A,
      MovementPhase.PHASE_B,
      MovementPhase.PHASE_C,
    ];

    return (
      <div style={styles.phaseIndicator}>
        {phases.map((p, i) => {
          const isActive = p === phase;
          const isCompleted = phases.indexOf(phase) > i || phase === MovementPhase.COMPLETED;
          
          return (
            <div
              key={p}
              style={{
                ...styles.phaseStep,
                ...(isActive ? styles.phaseStepActive : {}),
                ...(isCompleted ? styles.phaseStepCompleted : {}),
              }}
            >
              {phaseNames[p]}
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染当前阶段输入
  const renderPhaseInputs = () => {
    const isExecuting = movementState.phaseA.executing ||
                        movementState.phaseB.executing ||
                        movementState.phaseC.executing;

    // 滑块输入组件
    const renderSlider = (
      label: string,
      icon: string,
      value: number,
      min: number,
      max: number,
      field: keyof MovementPhaseInputs
    ) => {
      const percent = ((value - min) / (max - min)) * 100;
      const isNegative = min < 0 && value < 0;
      
      return (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              {icon} {label}
            </span>
            <span style={{ 
              fontSize: '11px', 
              color: value < 0 ? '#ff6f8f' : '#4a9eff',
              fontFamily: 'monospace',
            }}>
              {value.toFixed(0)}
            </span>
          </div>
          
          {/* 滑块轨道 */}
          <div style={{
            position: 'relative' as const,
            height: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
          }}>
            {/* 零点标记 */}
            {min < 0 && (
              <div style={{
                position: 'absolute',
                left: `${(-min / (max - min)) * 100}%`,
                top: '0',
                bottom: '0',
                width: '2px',
                backgroundColor: '#6b7280',
              }} />
            )}
            
            {/* 填充条 */}
            <div style={{
              position: 'absolute',
              left: min < 0 ? `${(-min / (max - min)) * 100}%` : '0',
              top: '0',
              bottom: '0',
              width: `${percent}%`,
              backgroundColor: value < 0 ? '#ff6f8f' : '#4a9eff',
              borderRadius: '4px',
              transition: 'width 0.2s',
            }} />
            
            {/* 滑块手柄 */}
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={value}
              onChange={(e) => handleInputChange(field, e.target.value)}
              disabled={isExecuting}
              style={{
                position: 'absolute',
                left: '0',
                right: '0',
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
            <div style={{
              position: 'absolute',
              left: `${percent}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '16px',
              height: '16px',
              backgroundColor: value < 0 ? '#ff6f8f' : '#4a9eff',
              borderRadius: '50%',
              border: '2px solid #fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              pointerEvents: 'none' as const,
              transition: 'left 0.2s',
            }} />
          </div>
          
          {/* 刻度标记 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
          }}>
            <span style={{ fontSize: '9px', color: '#6b7280' }}>{min}</span>
            {min < 0 && <span style={{ fontSize: '9px', color: '#6b7280' }}>0</span>}
            <span style={{ fontSize: '9px', color: '#6b7280' }}>{max}</span>
          </div>
        </div>
      );
    };

    switch (phase) {
      case MovementPhase.PHASE_A:
        return (
          <>
            <div style={styles.phaseGroup}>
              <div style={styles.phaseTitle}>
                {isExecuting ? '⏳' : '📍'} 阶段 A - 平移
                {isExecuting && <span style={{ color: '#f1c40f', fontSize: '10px' }}>执行中...</span>}
              </div>
              
              {renderSlider('前进 (-)', '⬆️', inputs.phaseAForward, -maxSpeed * 2, maxSpeed * 2, 'phaseAForward')}
              {renderSlider('侧移 (+)', '➡️', inputs.phaseAStrafe, -maxSpeed, maxSpeed, 'phaseAStrafe')}
            </div>
            
            {/* 资源显示 */}
            <MovementResourceDisplay
              resources={inputs}
              maxSpeed={maxSpeed}
              maxTurnRate={maxTurnRate}
              currentPhase="PHASE_A"
            />
          </>
        );

      case MovementPhase.PHASE_B:
        return (
          <>
            <div style={styles.phaseGroup}>
              <div style={styles.phaseTitle}>
                {isExecuting ? '⏳' : '🔄'} 阶段 B - 转向
                {isExecuting && <span style={{ color: '#f1c40f', fontSize: '10px' }}>执行中...</span>}
              </div>
              
              {renderSlider('转向角度 (°)', '🔄', inputs.turnAngle, -maxTurnRate, maxTurnRate, 'turnAngle')}
            </div>
            
            {/* 资源显示 */}
            <MovementResourceDisplay
              resources={inputs}
              maxSpeed={maxSpeed}
              maxTurnRate={maxTurnRate}
              currentPhase="PHASE_B"
            />
          </>
        );

      case MovementPhase.PHASE_C:
        return (
          <>
            <div style={styles.phaseGroup}>
              <div style={styles.phaseTitle}>
                {isExecuting ? '⏳' : '📍'} 阶段 C - 平移
                {isExecuting && <span style={{ color: '#f1c40f', fontSize: '10px' }}>执行中...</span>}
              </div>
              
              {renderSlider('前进 (-)', '⬆️', inputs.phaseBForward, -maxSpeed * 2, maxSpeed * 2, 'phaseBForward')}
              {renderSlider('侧移 (+)', '➡️', inputs.phaseBStrafe, -maxSpeed, maxSpeed, 'phaseBStrafe')}
            </div>
            
            {/* 资源显示 */}
            <MovementResourceDisplay
              resources={inputs}
              maxSpeed={maxSpeed}
              maxTurnRate={maxTurnRate}
              currentPhase="PHASE_C"
            />
          </>
        );

      case MovementPhase.COMPLETED:
        return (
          <div style={styles.phaseGroup}>
            <div style={{ padding: '16px', textAlign: 'center' as const, color: '#2ecc71' }}>
              ✅ 本回合移动已完成
            </div>
          </div>
        );

      default:
        return (
          <div style={styles.phaseGroup}>
            <div style={{ padding: '16px', textAlign: 'center' as const, color: '#6b7280' }}>
              准备开始移动...
            </div>
          </div>
        );
    }
  };

  // 攻击状态显示
  const renderAttackStatus = () => {
    if (attackCount === 0) {
      return (
        <div style={styles.attackStatus}>
          <div style={styles.attackStatusText}>
            ⚔️ 可以在任何阶段进行攻击
          </div>
        </div>
      );
    }
    
    return (
      <div style={styles.attackStatus}>
        <div style={styles.attackStatusText}>
          ✅ 本回合已攻击 {attackCount} 次
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>🚀 三阶段移动控制</span>
      </div>

      {/* 阶段指示器 */}
      {renderPhaseIndicator()}

      {/* 阶段输入 */}
      {renderPhaseInputs()}

      {/* 验证错误 */}
      {!movementState.isValid && movementState.validationError && (
        <div style={styles.validationError}>
          ⚠️ {movementState.validationError}
        </div>
      )}

      {/* 机动范围信息 */}
      <div style={styles.rangeInfo}>
        最大速度：{maxSpeed} | 最大转向：{maxTurnRate}°
      </div>

      {/* 攻击状态 */}
      {phase !== MovementPhase.COMPLETED && phase !== MovementPhase.NONE && renderAttackStatus()}

      {/* 操作按钮 */}
      <div style={styles.buttonGroup}>
        {phase !== MovementPhase.COMPLETED && phase !== MovementPhase.NONE && !isAnimating && (
          <>
            <button
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(!movementState.isValid ? styles.buttonDisabled : {}),
              }}
              onClick={handleExecutePhase}
              disabled={!movementState.isValid}
            >
              ▶️ 执行{phaseNames[phase as keyof typeof phaseNames]}
            </button>
            
            <button
              style={{
                ...styles.button,
                ...styles.buttonAttack,
              }}
              onClick={handleAttack}
            >
              ⚔️ 攻击
            </button>
          </>
        )}
        
        {phase === MovementPhase.COMPLETED && (
          <button
            style={{
              ...styles.button,
              ...styles.buttonNext,
            }}
            onClick={onClose}
          >
            ✅ 完成移动
          </button>
        )}
        
        <button
          style={{
            ...styles.button,
            ...styles.buttonDanger,
          }}
          onClick={handleCancel}
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default ThreePhaseMovementController;
