/**
 * 攻击预览组件
 *
 * 显示攻击预览信息：
 * - 预计伤害
 * - 护盾/护甲/船体伤害分布
 * - 辐能消耗
 * - 确认/取消按钮
 */

import React from 'react';
import type { AttackPreviewResult } from '@vt/shared/protocol';
import type { DamageType } from '@vt/shared/config';

// 样式
const styles = {
  container: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    minWidth: '280px',
  },
  header: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  canAttack: {
    color: 'var(--color-success)',
  },
  cannotAttack: {
    color: 'var(--color-error)',
  },
  previewSection: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--color-text-secondary)',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
  },
  damageBar: {
    display: 'flex',
    height: '24px',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  damageSegment: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'white',
    minWidth: '30px',
  },
  damageList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  damageItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  damageLabel: {
    color: 'var(--color-text-secondary)',
  },
  damageValue: {
    fontWeight: 'bold',
  },
  fluxInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: 'var(--color-info-light)',
    borderRadius: '4px',
    fontSize: '13px',
  },
  fluxIcon: {
    fontSize: '16px',
  },
  blockReason: {
    padding: '12px',
    backgroundColor: 'var(--color-error-light)',
    borderRadius: '4px',
    color: 'var(--color-error)',
    fontSize: '13px',
    marginBottom: '16px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
  button: {
    flex: 1,
    padding: '10px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  confirmButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  cancelButton: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text)',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// 伤害类型颜色
const damageTypeColors: Record<DamageType, string> = {
  KINETIC: '#4a90d9',
  HIGH_EXPLOSIVE: '#e74c3c',
  FRAGMENTATION: '#95a5a6',
  ENERGY: '#f39c12',
};

// 阻止原因文本
const blockReasonText: Record<string, string> = {
  OUT_OF_RANGE: '目标超出射程',
  NOT_IN_ARC: '目标不在射界内',
  WEAPON_NOT_READY: '武器未就绪',
  NOT_ENOUGH_FLUX_CAPACITY: '辐能容量不足',
  TARGET_IS_ALLY: '不能攻击友方目标',
  SHIP_IS_OVERLOADED: '舰船已过载',
  SHIP_IS_VENTING: '舰船正在散热',
  ALREADY_FIRED_THIS_TURN: '本回合已射击',
};

interface AttackPreviewProps {
  preview: AttackPreviewResult | null;
  damageType?: DamageType;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const AttackPreview: React.FC<AttackPreviewProps> = ({
  preview,
  damageType = 'ENERGY',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!preview) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.header, ...styles.cannotAttack }}>
          加载预览中...
        </div>
      </div>
    );
  }

  const canAttack = preview.canAttack && preview.preview;

  // 计算伤害分布
  const totalDamage = preview.preview?.baseDamage ?? 0;
  const shieldDamage = preview.preview?.estimatedShieldAbsorb ?? 0;
  const armorDamage = preview.preview?.estimatedArmorReduction ?? 0;
  const hullDamage = preview.preview?.estimatedHullDamage ?? 0;

  // 计算各部分比例
  const shieldPercent = totalDamage > 0 ? (shieldDamage / totalDamage) * 100 : 0;
  const armorPercent = totalDamage > 0 ? (armorDamage / totalDamage) * 100 : 0;
  const hullPercent = totalDamage > 0 ? (hullDamage / totalDamage) * 100 : 0;

  return (
    <div style={styles.container}>
      {/* 标题 */}
      <div style={{
        ...styles.header,
        ...(canAttack ? styles.canAttack : styles.cannotAttack),
      }}>
        <span>攻击预览</span>
        <span>{canAttack ? '✓ 可攻击' : '✗ 不可攻击'}</span>
      </div>

      {/* 阻止原因 */}
      {!canAttack && preview.blockReason && (
        <div style={styles.blockReason}>
          ⚠️ {blockReasonText[preview.blockReason] ?? preview.blockReason}
        </div>
      )}

      {/* 伤害预览 */}
      {canAttack && preview.preview && (
        <>
          {/* 伤害分布条 */}
          <div style={styles.previewSection}>
            <div style={styles.sectionTitle}>伤害分布</div>
            <div style={styles.damageBar}>
              {shieldPercent > 0 && (
                <div
                  style={{
                    ...styles.damageSegment,
                    backgroundColor: '#3498db',
                    width: `${shieldPercent}%`,
                  }}
                >
                  护盾
                </div>
              )}
              {armorPercent > 0 && (
                <div
                  style={{
                    ...styles.damageSegment,
                    backgroundColor: '#e67e22',
                    width: `${armorPercent}%`,
                  }}
                >
                  护甲
                </div>
              )}
              {hullPercent > 0 && (
                <div
                  style={{
                    ...styles.damageSegment,
                    backgroundColor: '#e74c3c',
                    width: `${hullPercent}%`,
                  }}
                >
                  船体
                </div>
              )}
            </div>

            {/* 详细伤害 */}
            <div style={styles.damageList}>
              <div style={styles.damageItem}>
                <span style={styles.damageLabel}>基础伤害</span>
                <span style={styles.damageValue}>{preview.preview.baseDamage}</span>
              </div>
              {shieldDamage > 0 && (
                <div style={styles.damageItem}>
                  <span style={styles.damageLabel}>护盾吸收</span>
                  <span style={{ ...styles.damageValue, color: '#3498db' }}>
                    {Math.round(shieldDamage)}
                  </span>
                </div>
              )}
              {armorDamage > 0 && (
                <div style={styles.damageItem}>
                  <span style={styles.damageLabel}>护甲减免</span>
                  <span style={{ ...styles.damageValue, color: '#e67e22' }}>
                    {Math.round(armorDamage)}
                  </span>
                </div>
              )}
              <div style={styles.damageItem}>
                <span style={styles.damageLabel}>船体伤害</span>
                <span style={{ ...styles.damageValue, color: '#e74c3c' }}>
                  {Math.round(hullDamage)}
                </span>
              </div>
              <div style={styles.damageItem}>
                <span style={styles.damageLabel}>命中象限</span>
                <span style={styles.damageValue}>
                  {preview.preview.hitQuadrant}
                </span>
              </div>
            </div>
          </div>

          {/* 辐能消耗 */}
          <div style={styles.previewSection}>
            <div style={styles.sectionTitle}>辐能消耗</div>
            <div style={styles.fluxInfo}>
              <span style={styles.fluxIcon}>⚡</span>
              <span>攻击消耗: {preview.preview.fluxCost}</span>
              {preview.preview.willGenerateHardFlux && (
                <span style={{ color: 'var(--color-warning)' }}>
                  (产生硬辐能)
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* 按钮 */}
      <div style={styles.buttons}>
        <button
          style={{
            ...styles.button,
            ...styles.cancelButton,
          }}
          onClick={onCancel}
          disabled={isLoading}
        >
          取消
        </button>
        <button
          style={{
            ...styles.button,
            ...styles.confirmButton,
            ...(!canAttack || isLoading ? styles.disabledButton : {}),
          }}
          onClick={onConfirm}
          disabled={!canAttack || isLoading}
        >
          {isLoading ? '处理中...' : '确认攻击'}
        </button>
      </div>
    </div>
  );
};

export default AttackPreview;