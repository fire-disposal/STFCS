/**
 * 战斗控制面板组件
 *
 * 提供完整的战斗交互界面：
 * - 目标选择
 * - 武器选择
 * - 象限选择
 * - 攻击预览
 * - 攻击确认
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '@/store';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { DamageType, ArmorQuadrant } from '@vt/shared/config';
import type { AttackPreviewResult, AttackResult } from '@vt/shared/protocol';
import { CombatInteractionService, CombatPhase, CombatState, WeaponInfo, TargetInfo } from './CombatInteractionService';
import {
  Target,
  Crosshair,
  Shield,
  Sword,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Zap,
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
    border: '1px solid rgba(239, 68, 68, 0.2)',
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
    color: 'rgba(239, 68, 68, 1)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  phaseIndicator: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: 'rgba(239, 68, 68, 1)',
  },
  section: {
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    maxHeight: '120px',
    overflowY: 'auto' as const,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: '1px solid transparent',
  },
  listItemHover: {
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderColor: 'rgba(74, 158, 255, 0.3)',
  },
  listItemActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
  },
  listItemDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  itemName: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  itemInfo: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  preview: {
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '4px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '11px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  previewLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  previewValue: {
    fontWeight: 'bold',
  },
  damageBar: {
    display: 'flex',
    height: '16px',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  damageSegment: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 'bold',
    color: 'white',
  },
  buttons: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  },
  button: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    fontSize: '11px',
    fontWeight: 'medium',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    color: 'rgba(239, 68, 68, 1)',
  },
  buttonSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    color: 'rgba(34, 197, 94, 1)',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  error: {
    padding: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: 'rgba(239, 68, 68, 1)',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  empty: {
    padding: '16px',
    textAlign: 'center' as const,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '11px',
  },
  quadrantGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
    marginTop: '4px',
  },
  quadrantButton: {
    padding: '8px 4px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '9px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  quadrantButtonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
    color: 'rgba(74, 158, 255, 1)',
  },
};

// 伤害类型颜色
const damageTypeColors: Record<DamageType, string> = {
  KINETIC: '#4a90d9',
  HIGH_EXPLOSIVE: '#e74c3c',
  FRAGMENTATION: '#95a5a6',
  ENERGY: '#f39c12',
};

// 阶段名称
const phaseNames: Record<CombatPhase, string> = {
  idle: '空闲',
  select_target: '选择目标',
  select_weapon: '选择武器',
  select_quadrant: '选择象限',
  preview: '预览攻击',
  confirm: '确认攻击',
  executing: '执行中',
};

// 象限名称
const quadrantNames: Record<ArmorQuadrant, string> = {
  FRONT_TOP: '前上',
  FRONT_BOTTOM: '前下',
  RIGHT_TOP: '右上',
  RIGHT_BOTTOM: '右下',
  LEFT_TOP: '左上',
  LEFT_BOTTOM: '左下',
};

interface CombatControlPanelProps {
  shipId: string;
  availableWeapons: WeaponInfo[];
  nearbyTargets: TargetInfo[];
  disabled?: boolean;
  onAttackComplete?: (result: AttackResult) => void;
}

export const CombatControlPanel: React.FC<CombatControlPanelProps> = ({
  shipId,
  availableWeapons,
  nearbyTargets,
  disabled = false,
  onAttackComplete,
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [combatService] = useState(() => new CombatInteractionService({
    attackerId: shipId,
    onStateChange: (state) => setCombatState(state),
    onAttackComplete: (result) => {
      onAttackComplete?.(result);
    },
    onError: (error) => setError(error),
  }));

  const [combatState, setCombatState] = useState<CombatState>(combatService.getState());
  const [error, setError] = useState<string | null>(null);

  // 清除错误
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 开始攻击
  const handleStartAttack = useCallback(() => {
    if (disabled) return;
    setError(null);
    combatService.startAttack();
  }, [disabled, combatService]);

  // 取消攻击
  const handleCancelAttack = useCallback(() => {
    combatService.cancelAttack();
    setError(null);
  }, [combatService]);

  // 选择目标
  const handleSelectTarget = useCallback((targetId: string) => {
    combatService.selectTarget(targetId).catch((err) => {
      setError(err.message);
    });
  }, [combatService]);

  // 选择武器
  const handleSelectWeapon = useCallback((weaponInstanceId: string) => {
    combatService.selectWeapon(weaponInstanceId).catch((err) => {
      setError(err.message);
    });
  }, [combatService]);

  // 选择象限
  const handleSelectQuadrant = useCallback((quadrant: ArmorQuadrant) => {
    combatService.selectQuadrant(quadrant).catch((err) => {
      setError(err.message);
    });
  }, [combatService]);

  // 确认攻击
  const handleConfirmAttack = useCallback(() => {
    combatService.confirmAttack().catch((err) => {
      setError(err.message);
    });
  }, [combatService]);

  // 快速攻击
  const handleQuickAttack = useCallback((targetId: string, weaponInstanceId: string) => {
    combatService.quickAttack(targetId, weaponInstanceId).catch((err) => {
      setError(err.message);
    });
  }, [combatService]);

  // 渲染阶段指示器
  const renderPhaseIndicator = () => (
    <div style={styles.header}>
      <span style={styles.title}>
        <Sword size={12} />
        战斗控制
      </span>
      <span style={styles.phaseIndicator}>
        {phaseNames[combatState.phase]}
      </span>
    </div>
  );

  // 渲染目标选择
  const renderTargetSelection = () => {
    if (combatState.phase !== 'select_target') return null;

    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Target size={12} />
          选择目标
        </div>
        {nearbyTargets.length === 0 ? (
          <div style={styles.empty}>附近没有可攻击的目标</div>
        ) : (
          <div style={styles.list}>
            {nearbyTargets.map((target) => (
              <div
                key={target.id}
                style={{
                  ...styles.listItem,
                  ...(combatState.targetId === target.id ? styles.listItemActive : {}),
                }}
                onClick={() => handleSelectTarget(target.id)}
              >
                <div>
                  <div style={styles.itemName}>{target.name}</div>
                  <div style={styles.itemInfo}>
                    {target.hullSize} · {target.distance.toFixed(0)}m
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {target.shieldActive && <Shield size={12} style={{ color: '#4a9eff' }} />}
                  <span style={{ fontSize: '10px', color: target.isEnemy ? '#ef4444' : '#22c55e' }}>
                    {target.isEnemy ? '敌方' : '友方'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染武器选择
  const renderWeaponSelection = () => {
    if (combatState.phase !== 'select_weapon') return null;

    const readyWeapons = availableWeapons.filter(w => w.canFire);

    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Crosshair size={12} />
          选择武器
        </div>
        {readyWeapons.length === 0 ? (
          <div style={styles.empty}>没有可用的武器</div>
        ) : (
          <div style={styles.list}>
            {readyWeapons.map((weapon) => (
              <div
                key={weapon.instanceId}
                style={{
                  ...styles.listItem,
                  ...(combatState.weaponInstanceId === weapon.instanceId ? styles.listItemActive : {}),
                }}
                onClick={() => handleSelectWeapon(weapon.instanceId)}
              >
                <div>
                  <div style={styles.itemName}>{weapon.name}</div>
                  <div style={styles.itemInfo}>
                    {weapon.damageType} · {weapon.baseDamage} dmg · {weapon.range}m
                  </div>
                </div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: damageTypeColors[weapon.damageType],
                }} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染象限选择
  const renderQuadrantSelection = () => {
    if (combatState.phase !== 'select_quadrant') return null;

    const quadrants: ArmorQuadrant[] = [
      'LEFT_TOP', 'FRONT_TOP', 'RIGHT_TOP',
      'LEFT_BOTTOM', 'FRONT_BOTTOM', 'RIGHT_BOTTOM',
    ];

    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Target size={12} />
          选择攻击象限
        </div>
        <div style={styles.quadrantGrid}>
          {quadrants.map((quadrant) => (
            <div
              key={quadrant}
              style={{
                ...styles.quadrantButton,
                ...(combatState.targetQuadrant === quadrant ? styles.quadrantButtonActive : {}),
              }}
              onClick={() => handleSelectQuadrant(quadrant)}
            >
              {quadrantNames[quadrant]}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染攻击预览
  const renderAttackPreview = () => {
    if (combatState.phase !== 'confirm' && combatState.phase !== 'preview') return null;
    if (!combatState.preview) return null;

    const preview = combatState.preview;
    const canAttack = preview.canAttack && preview.preview;

    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          {canAttack ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
          攻击预览
        </div>

        {!canAttack && preview.blockReason && (
          <div style={{ ...styles.error, marginBottom: '8px' }}>
            <AlertTriangle size={12} />
            无法攻击: {preview.blockReason}
          </div>
        )}

        {canAttack && preview.preview && (
          <>
            {/* 伤害分布条 */}
            <div style={styles.damageBar}>
              {preview.preview.estimatedShieldAbsorb > 0 && (
                <div
                  style={{
                    ...styles.damageSegment,
                    backgroundColor: '#3498db',
                    width: `${(preview.preview.estimatedShieldAbsorb / preview.preview.baseDamage) * 100}%`,
                  }}
                >
                  护盾
                </div>
              )}
              {preview.preview.estimatedArmorReduction > 0 && (
                <div
                  style={{
                    ...styles.damageSegment,
                    backgroundColor: '#e67e22',
                    width: `${(preview.preview.estimatedArmorReduction / preview.preview.baseDamage) * 100}%`,
                  }}
                >
                  护甲
                </div>
              )}
              {preview.preview.estimatedHullDamage > 0 && (
                <div
                  style={{
                    ...styles.damageSegment,
                    backgroundColor: '#e74c3c',
                    width: `${(preview.preview.estimatedHullDamage / preview.preview.baseDamage) * 100}%`,
                  }}
                >
                  船体
                </div>
              )}
            </div>

            {/* 详细信息 */}
            <div style={styles.preview}>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>基础伤害</span>
                <span style={styles.previewValue}>{preview.preview.baseDamage}</span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>护盾吸收</span>
                <span style={{ ...styles.previewValue, color: '#3498db' }}>
                  {Math.round(preview.preview.estimatedShieldAbsorb)}
                </span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>护甲减免</span>
                <span style={{ ...styles.previewValue, color: '#e67e22' }}>
                  {Math.round(preview.preview.estimatedArmorReduction)}
                </span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>船体伤害</span>
                <span style={{ ...styles.previewValue, color: '#e74c3c' }}>
                  {Math.round(preview.preview.estimatedHullDamage)}
                </span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>命中象限</span>
                <span style={styles.previewValue}>
                  {quadrantNames[preview.preview.hitQuadrant]}
                </span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>辐能消耗</span>
                <span style={{ ...styles.previewValue, color: '#f39c12' }}>
                  <Zap size={10} style={{ marginRight: '2px' }} />
                  {preview.preview.fluxCost}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // 渲染错误信息
  const renderError = () => {
    if (!error) return null;

    return (
      <div style={styles.error}>
        <AlertTriangle size={12} />
        {error}
      </div>
    );
  };

  // 渲染按钮
  const renderButtons = () => {
    if (combatState.phase === 'idle') {
      return (
        <div style={styles.buttons}>
          <button
            style={{ ...styles.button, ...styles.buttonPrimary }}
            onClick={handleStartAttack}
            disabled={disabled}
          >
            <Sword size={12} />
            开始攻击
          </button>
        </div>
      );
    }

    if (combatState.phase === 'confirm' && combatState.preview?.canAttack) {
      return (
        <div style={styles.buttons}>
          <button
            style={styles.button}
            onClick={handleCancelAttack}
          >
            取消
          </button>
          <button
            style={{ ...styles.button, ...styles.buttonSuccess }}
            onClick={handleConfirmAttack}
            disabled={combatState.isAttacking}
          >
            {combatState.isAttacking ? '攻击中...' : '确认攻击'}
          </button>
        </div>
      );
    }

    return (
      <div style={styles.buttons}>
        <button
          style={styles.button}
          onClick={handleCancelAttack}
        >
          取消攻击
        </button>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderPhaseIndicator()}
      {renderTargetSelection()}
      {renderWeaponSelection()}
      {renderQuadrantSelection()}
      {renderAttackPreview()}
      {renderError()}
      {renderButtons()}
    </div>
  );
};

export default CombatControlPanel;