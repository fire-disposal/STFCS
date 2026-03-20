/**
 * 战斗控制面板
 *
 * 使用新的房间框架：
 * - useRoomState 订阅状态
 * - useRoomOperations 调用操作
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Target, Crosshair, Shield, Sword, Zap, AlertTriangle } from 'lucide-react';
import { useRoomState, useRoomOperations } from '@/room';
import type { RoomClient } from '@/room';
import type { OperationMap } from '@vt/shared/room';
import type { ArmorQuadrant, FactionId } from '@vt/shared/types';
import type { TokenState } from '@vt/shared/room';

// ==================== 样式 ====================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--color-danger)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  section: {
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--color-text-secondary)',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    maxHeight: '150px',
    overflowY: 'auto' as const,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: '2px solid transparent',
    backgroundColor: 'var(--color-surface)',
  },
  listItemSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-light)',
  },
  listItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  itemName: {
    fontSize: '13px',
    fontWeight: 'bold',
  },
  itemStats: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  button: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  primaryButton: {
    backgroundColor: 'var(--color-danger)',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text)',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  quadrantGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    gap: '4px',
    width: '100%',
    aspectRatio: '3/2',
  },
  quadrantButton: {
    padding: '8px',
    borderRadius: '4px',
    border: '2px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    transition: 'all 0.15s ease',
  },
  quadrantButtonSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-light)',
  },
  statusText: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    textAlign: 'center' as const,
    padding: '8px',
  },
  warningText: {
    color: 'var(--color-warning)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};

// ==================== 武器配置 ====================

const WEAPONS = [
  { id: 'auto_cannon', name: '自动炮', damage: 20, range: 500, fluxCost: 10 },
  { id: 'pulse_laser', name: '脉冲激光', damage: 30, range: 600, fluxCost: 20 },
  { id: 'harpoon', name: '鱼叉导弹', damage: 50, range: 800, fluxCost: 30 },
];

// ==================== 象限配置 ====================

const QUADRANTS: { id: ArmorQuadrant; name: string }[] = [
  { id: 'LEFT_TOP', name: '左上' },
  { id: 'FRONT_TOP', name: '前上' },
  { id: 'RIGHT_TOP', name: '右上' },
  { id: 'LEFT_BOTTOM', name: '左下' },
  { id: 'FRONT_BOTTOM', name: '前下' },
  { id: 'RIGHT_BOTTOM', name: '右下' },
];

// ==================== Props ====================

interface CombatControlPanelProps {
  client: RoomClient<OperationMap> | null;
  currentPlayerId: string;
  selectedShipId?: string;
}

// ==================== Component ====================

export const CombatControlPanel: React.FC<CombatControlPanelProps> = ({
  client,
  currentPlayerId,
  selectedShipId,
}) => {
  const state = useRoomState(client);
  const ops = useRoomOperations(client);

  // 从状态中提取数据
  const tokens = state?.game?.tokens || {};
  const selectedTargets = state?.game?.selectedTargets[currentPlayerId] || [];
  const selectedWeapon = state?.game?.selectedWeapons[currentPlayerId];
  const selectedQuadrant = state?.game?.selectedQuadrants[currentPlayerId];

  // 当前玩家信息
  const currentPlayer = state?.players[currentPlayerId];
  const playerFaction = currentPlayer?.faction;
  const isDM = currentPlayer?.isDM;

  // 选中的舰船
  const selectedShip = selectedShipId ? tokens[selectedShipId] : null;

  // 可攻击的目标（敌方舰船）
  const availableTargets = useMemo(() => {
    return Object.values(tokens).filter(token => {
      if (token.type !== 'ship') return false;
      if (isDM) return true; // DM 可以攻击任何目标
      return token.faction !== playerFaction;
    });
  }, [tokens, playerFaction, isDM]);

  // 处理目标选择
  const handleSelectTarget = useCallback(async (targetId: string) => {
    if (!ops) return;

    try {
      if (selectedTargets.includes(targetId)) {
        await ops.clearTarget(targetId);
      } else {
        await ops.selectTarget(targetId);
      }
    } catch (error) {
      console.error('Failed to select target:', error);
    }
  }, [ops, selectedTargets]);

  // 处理武器选择
  const handleSelectWeapon = useCallback(async (weaponId: string) => {
    if (!ops) return;

    try {
      if (selectedWeapon === weaponId) {
        await ops.clearWeapon();
      } else {
        await ops.selectWeapon(weaponId);
      }
    } catch (error) {
      console.error('Failed to select weapon:', error);
    }
  }, [ops, selectedWeapon]);

  // 处理象限选择
  const handleSelectQuadrant = useCallback(async (quadrant: ArmorQuadrant) => {
    if (!ops) return;

    try {
      if (selectedQuadrant === quadrant) {
        await ops.clearQuadrant();
      } else {
        await ops.selectQuadrant(quadrant);
      }
    } catch (error) {
      console.error('Failed to select quadrant:', error);
    }
  }, [ops, selectedQuadrant]);

  // 处理攻击
  const handleAttack = useCallback(async () => {
    if (!ops || !selectedShipId || selectedTargets.length === 0 || !selectedWeapon || !selectedQuadrant) {
      return;
    }

    try {
      const result = await ops.attack(
        selectedShipId,
        selectedTargets[0],
        selectedWeapon,
        selectedQuadrant
      );

      // 清除选择
      await ops.clearTarget();
      await ops.clearWeapon();
      await ops.clearQuadrant();

      if (result.destroyed) {
        alert('目标已被摧毁！');
      }
    } catch (error) {
      console.error('Failed to attack:', error);
      alert(error instanceof Error ? error.message : '攻击失败');
    }
  }, [ops, selectedShipId, selectedTargets, selectedWeapon, selectedQuadrant]);

  // 检查是否可以攻击
  const canAttack = selectedShip && 
    !selectedShip.hasActed && 
    !selectedShip.isOverloaded &&
    selectedTargets.length > 0 && 
    selectedWeapon && 
    selectedQuadrant;

  // 加载状态
  if (!state) {
    return <div style={styles.container}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <Sword size={16} />
          战斗控制
        </div>
      </div>

      {/* 当前舰船状态 */}
      {selectedShip && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>当前舰船</div>
          <div style={styles.listItem}>
            <div>
              <div style={styles.itemName}>舰船 {selectedShip.id.slice(-4)}</div>
              <div style={styles.itemStats}>
                船体: {selectedShip.hull}/{selectedShip.maxHull} | 
                辐能: {selectedShip.flux}/{selectedShip.maxFlux}
              </div>
            </div>
            {selectedShip.isOverloaded && (
              <span style={styles.warningText}>
                <AlertTriangle size={14} />
                过载
              </span>
            )}
          </div>
        </div>
      )}

      {/* 目标选择 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Target size={14} />
          选择目标
        </div>
        {availableTargets.length === 0 ? (
          <div style={styles.statusText}>没有可攻击的目标</div>
        ) : (
          <div style={styles.list}>
            {availableTargets.map(target => (
              <div
                key={target.id}
                style={{
                  ...styles.listItem,
                  ...(selectedTargets.includes(target.id) ? styles.listItemSelected : {}),
                }}
                onClick={() => handleSelectTarget(target.id)}
              >
                <div>
                  <div style={styles.itemName}>舰船 {target.id.slice(-4)}</div>
                  <div style={styles.itemStats}>
                    船体: {target.hull}/{target.maxHull}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 武器选择 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Crosshair size={14} />
          选择武器
        </div>
        <div style={styles.list}>
          {WEAPONS.map(weapon => (
            <div
              key={weapon.id}
              style={{
                ...styles.listItem,
                ...(selectedWeapon === weapon.id ? styles.listItemSelected : {}),
              }}
              onClick={() => handleSelectWeapon(weapon.id)}
            >
              <div>
                <div style={styles.itemName}>{weapon.name}</div>
                <div style={styles.itemStats}>
                  伤害: {weapon.damage} | 射程: {weapon.range} | 辐能: {weapon.fluxCost}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 象限选择 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Shield size={14} />
          攻击象限
        </div>
        <div style={styles.quadrantGrid}>
          {QUADRANTS.map(quadrant => (
            <div
              key={quadrant.id}
              style={{
                ...styles.quadrantButton,
                ...(selectedQuadrant === quadrant.id ? styles.quadrantButtonSelected : {}),
              }}
              onClick={() => handleSelectQuadrant(quadrant.id)}
            >
              {quadrant.name}
            </div>
          ))}
        </div>
      </div>

      {/* 攻击按钮 */}
      <button
        style={{
          ...styles.button,
          ...styles.primaryButton,
          ...(!canAttack ? styles.disabledButton : {}),
        }}
        onClick={handleAttack}
        disabled={!canAttack}
      >
        <Zap size={16} />
        发动攻击
      </button>

      {/* 其他操作 */}
      {selectedShip && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              flex: 1,
            }}
            onClick={() => ops?.toggleShield(selectedShipId!)}
            disabled={selectedShip.isOverloaded}
          >
            <Shield size={14} />
            {selectedShip.isShieldOn ? '关闭护盾' : '开启护盾'}
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              flex: 1,
            }}
            onClick={() => ops?.ventFlux(selectedShipId!)}
            disabled={selectedShip.hasActed}
          >
            <Zap size={14} />
            散热
          </button>
        </div>
      )}
    </div>
  );
};

export default CombatControlPanel;