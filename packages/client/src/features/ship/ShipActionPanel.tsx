/**
 * 舰船操作面板
 *
 * 提供舰船的核心操作按钮：
 * - 移动操作（三阶段移动）
 * - 护盾开关
 * - 武器开火
 * - 辐能排散
 * - 结束回合
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ShipState, WeaponSlot, ClientCommand } from '@vt/shared';
import { ClientCommand as CC } from '@vt/shared';

// 样式定义
const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    minWidth: '280px',
    maxWidth: '320px',
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    marginBottom: '12px',
    borderBottom: '1px solid #2b4261',
    paddingBottom: '8px',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#7aa2d4',
    marginBottom: '8px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  button: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  buttonPrimary: {
    backgroundColor: '#1a4a7a',
    borderColor: '#43c1ff',
  },
  buttonDanger: {
    backgroundColor: '#5a2a3a',
    borderColor: '#ff6f8f',
  },
  buttonSuccess: {
    backgroundColor: '#1a5a3a',
    borderColor: '#2ecc71',
  },
  buttonWarning: {
    backgroundColor: '#5a4a2a',
    borderColor: '#f1c40f',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#1a2d42',
    borderColor: '#2b4261',
  },
  buttonActive: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
    color: 'white',
  },
  sliderContainer: {
    marginBottom: '8px',
  },
  sliderLabel: {
    fontSize: '11px',
    color: '#8ba4c7',
    marginBottom: '4px',
    display: 'flex',
    justifyContent: 'space-between',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    backgroundColor: '#1a2d42',
    outline: 'none',
    cursor: 'pointer',
  },
  weaponList: {
    maxHeight: '100px',
    overflow: 'auto',
  },
  weaponItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    backgroundColor: '#1a2d42',
    borderRadius: '4px',
    marginBottom: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
  },
  weaponItemSelected: {
    borderColor: '#43c1ff',
    backgroundColor: '#1a3a5a',
  },
  weaponName: {
    flex: 1,
    fontSize: '11px',
    color: '#cfe8ff',
  },
  weaponStats: {
    fontSize: '10px',
    color: '#8ba4c7',
  },
  targetSelect: {
    padding: '8px',
    backgroundColor: '#1a2d42',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  targetItem: {
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
  },
  targetItemSelected: {
    borderColor: '#ff6f8f',
    backgroundColor: '#3a2a4a',
  },
  statusMessage: {
    padding: '8px',
    borderRadius: '4px',
    fontSize: '11px',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#8ba4c7',
    padding: '16px',
    fontSize: '12px',
  },
};

// 阶段名称
const phaseNames: Record<string, string> = {
  DEPLOYMENT: '部署阶段',
  PLAYER_TURN: '玩家回合',
  DM_TURN: 'DM回合',
  END_PHASE: '结算阶段',
};

interface ShipActionPanelProps {
  ship: ShipState | null;
  allShips: ShipState[];
  currentPhase: string;
  activeFaction: string;
  playerRole: 'dm' | 'player';
  playerSessionId: string;
  onSendCommand: (command: ClientCommand, payload: Record<string, unknown>) => void;
  disabled?: boolean;
}

export const ShipActionPanel: React.FC<ShipActionPanelProps> = ({
  ship,
  allShips,
  currentPhase,
  activeFaction,
  playerRole,
  playerSessionId,
  onSendCommand,
  disabled = false,
}) => {
  // 移动参数状态
  const [movePhaseA, setMovePhaseA] = useState(0);
  const [movePhaseAStrafe, setMovePhaseAStrafe] = useState(0);
  const [turnAngle, setTurnAngle] = useState(0);
  const [movePhaseB, setMovePhaseB] = useState(0);
  const [movePhaseBStrafe, setMovePhaseBStrafe] = useState(0);

  // 武器选择状态
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // 检查是否可以操作此舰船
  const canOperate = useMemo(() => {
    if (!ship) return false;
    if (disabled) return false;
    if (ship.isOverloaded) return false;

    // DM 可以操作任何舰船
    if (playerRole === 'dm') return true;

    // 玩家只能操作自己的舰船
    if (ship.ownerId !== playerSessionId) return false;

    // 玩家只能在 PLAYER_TURN 阶段操作
    if (currentPhase !== 'PLAYER_TURN') return false;

    return true;
  }, [ship, disabled, playerRole, playerSessionId, currentPhase]);

  // 检查是否可以移动
  const canMove = useMemo(() => {
    return canOperate && ship && !ship.hasMoved;
  }, [canOperate, ship]);

  // 检查是否可以开火
  const canFire = useMemo(() => {
    return canOperate && ship && !ship.hasFired;
  }, [canOperate, ship]);

  // 检查是否可以排散
  const canVent = useMemo(() => {
    if (!canOperate || !ship) return false;
    if (ship.isShieldUp) return false; // 需要关闭护盾
    if (ship.fluxHard + ship.fluxSoft <= 0) return false; // 没有辐能
    return true;
  }, [canOperate, ship]);

  // 检查是否可以切换护盾
  const canToggleShield = useMemo(() => {
    if (!canOperate || !ship) return false;
    if (ship.isOverloaded && !ship.isShieldUp) return false; // 过载时不能开启护盾
    return true;
  }, [canOperate, ship]);

  // 获取可用武器
  const availableWeapons = useMemo(() => {
    if (!ship) return [];
    const result: WeaponSlot[] = [];
    ship.weapons.forEach((weapon) => {
      if (weapon.cooldown <= 0) {
        result.push(weapon);
      }
    });
    return result;
  }, [ship]);

  // 获取可选目标
  const availableTargets = useMemo(() => {
    if (!ship) return [];
    return allShips.filter((target) => {
      // 不能攻击自己
      if (target.id === ship.id) return false;
      // 不能攻击同阵营（简化规则）
      if (target.faction === ship.faction) return false;
      return true;
    });
  }, [ship, allShips]);

  // 处理移动
  const handleMove = useCallback(() => {
    if (!ship || !canMove) return;

    // 计算最终位置
    const radA = (ship.transform.heading * Math.PI) / 180;
    const forwardXA = Math.sin(radA);
    const forwardYA = -Math.cos(radA);
    const rightXA = Math.cos(radA);
    const rightYA = Math.sin(radA);

    let newX = ship.transform.x + forwardXA * movePhaseA + rightXA * movePhaseAStrafe;
    let newY = ship.transform.y + forwardYA * movePhaseA + rightYA * movePhaseAStrafe;

    // 转向后的新朝向
    const newHeading = ((ship.transform.heading + turnAngle) % 360 + 360) % 360;

    // 阶段B移动
    const radB = (newHeading * Math.PI) / 180;
    const forwardXB = Math.sin(radB);
    const forwardYB = -Math.cos(radB);
    const rightXB = Math.cos(radB);
    const rightYB = Math.sin(radB);

    newX += forwardXB * movePhaseB + rightXB * movePhaseBStrafe;
    newY += forwardYB * movePhaseB + rightYB * movePhaseBStrafe;

    onSendCommand(CC.CMD_MOVE_TOKEN, {
      shipId: ship.id,
      x: newX,
      y: newY,
      heading: newHeading,
      movementPlan: {
        phaseAForward: movePhaseA,
        phaseAStrafe: movePhaseAStrafe,
        turnAngle: turnAngle,
        phaseBForward: movePhaseB,
        phaseBStrafe: movePhaseBStrafe,
      },
    });

    // 重置移动参数
    setMovePhaseA(0);
    setMovePhaseAStrafe(0);
    setTurnAngle(0);
    setMovePhaseB(0);
    setMovePhaseBStrafe(0);
  }, [ship, canMove, movePhaseA, movePhaseAStrafe, turnAngle, movePhaseB, movePhaseBStrafe, onSendCommand]);

  // 处理护盾切换
  const handleToggleShield = useCallback(() => {
    if (!ship || !canToggleShield) return;

    onSendCommand(CC.CMD_TOGGLE_SHIELD, {
      shipId: ship.id,
      isActive: !ship.isShieldUp,
      orientation: ship.transform.heading,
    });
  }, [ship, canToggleShield, onSendCommand]);

  // 处理开火
  const handleFire = useCallback(() => {
    if (!ship || !canFire || !selectedWeaponId || !selectedTargetId) return;

    onSendCommand(CC.CMD_FIRE_WEAPON, {
      attackerId: ship.id,
      weaponId: selectedWeaponId,
      targetId: selectedTargetId,
    });

    // 重置选择
    setSelectedWeaponId(null);
    setSelectedTargetId(null);
  }, [ship, canFire, selectedWeaponId, selectedTargetId, onSendCommand]);

  // 处理排散
  const handleVent = useCallback(() => {
    if (!ship || !canVent) return;

    onSendCommand(CC.CMD_VENT_FLUX, {
      shipId: ship.id,
    });
  }, [ship, canVent, onSendCommand]);

  // 获取操作状态消息
  const getStatusMessage = () => {
    if (!ship) return null;

    if (ship.isOverloaded) {
      return { type: 'error', text: '舰船过载，无法操作' };
    }

    if (playerRole === 'player' && ship.ownerId !== playerSessionId) {
      return { type: 'warning', text: '这不是你的舰船' };
    }

    if (playerRole === 'player' && currentPhase !== 'PLAYER_TURN') {
      return { type: 'warning', text: `当前是${phaseNames[currentPhase] || currentPhase}` };
    }

    if (ship.hasMoved && ship.hasFired) {
      return { type: 'success', text: '本回合行动已完成' };
    }

    return null;
  };

  const status = getStatusMessage();

  if (!ship) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>🎯 操作面板</div>
        <div style={styles.emptyState}>
          选择一艘舰船进行操作
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        🎯 操作面板
        <span style={{ fontSize: '11px', color: '#8ba4c7', marginLeft: '8px' }}>
          {ship.id.slice(-6)}
        </span>
      </div>

      {/* 状态消息 */}
      {status && (
        <div style={{
          ...styles.statusMessage,
          backgroundColor: status.type === 'error' ? '#5a2a3a' :
            status.type === 'warning' ? '#5a4a2a' : '#1a5a3a',
          color: status.type === 'error' ? '#ff6f8f' :
            status.type === 'warning' ? '#f1c40f' : '#2ecc71',
        }}>
          {status.text}
        </div>
      )}

      {/* 移动操作 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🚀 移动</div>

        {/* 阶段A */}
        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span>阶段A 前进</span>
            <span>{movePhaseA} / {ship.maxSpeed * 2}</span>
          </div>
          <input
            type="range"
            min={-ship.maxSpeed * 2}
            max={ship.maxSpeed * 2}
            value={movePhaseA}
            onChange={(e) => setMovePhaseA(Number(e.target.value))}
            style={styles.slider}
            disabled={!canMove}
          />
        </div>

        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span>阶段A 横移</span>
            <span>{movePhaseAStrafe} / {ship.maxSpeed}</span>
          </div>
          <input
            type="range"
            min={-ship.maxSpeed}
            max={ship.maxSpeed}
            value={movePhaseAStrafe}
            onChange={(e) => setMovePhaseAStrafe(Number(e.target.value))}
            style={styles.slider}
            disabled={!canMove}
          />
        </div>

        {/* 转向 */}
        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span>转向角度</span>
            <span>{turnAngle}° / {ship.maxTurnRate}°</span>
          </div>
          <input
            type="range"
            min={-ship.maxTurnRate}
            max={ship.maxTurnRate}
            value={turnAngle}
            onChange={(e) => setTurnAngle(Number(e.target.value))}
            style={styles.slider}
            disabled={!canMove}
          />
        </div>

        {/* 阶段B */}
        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span>阶段B 前进</span>
            <span>{movePhaseB} / {ship.maxSpeed * 2}</span>
          </div>
          <input
            type="range"
            min={-ship.maxSpeed * 2}
            max={ship.maxSpeed * 2}
            value={movePhaseB}
            onChange={(e) => setMovePhaseB(Number(e.target.value))}
            style={styles.slider}
            disabled={!canMove}
          />
        </div>

        <div style={styles.sliderContainer}>
          <div style={styles.sliderLabel}>
            <span>阶段B 横移</span>
            <span>{movePhaseBStrafe} / {ship.maxSpeed}</span>
          </div>
          <input
            type="range"
            min={-ship.maxSpeed}
            max={ship.maxSpeed}
            value={movePhaseBStrafe}
            onChange={(e) => setMovePhaseBStrafe(Number(e.target.value))}
            style={styles.slider}
            disabled={!canMove}
          />
        </div>

        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(ship.hasMoved || !canMove ? styles.buttonDisabled : {}),
          }}
          onClick={handleMove}
          disabled={ship.hasMoved || !canMove}
        >
          {ship.hasMoved ? '✓ 已移动' : '🚀 执行移动'}
        </button>
      </div>

      {/* 护盾操作 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔮 护盾</div>
        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.button,
              ...(ship.isShieldUp ? styles.buttonActive : {}),
              ...(!canToggleShield ? styles.buttonDisabled : {}),
            }}
            onClick={handleToggleShield}
            disabled={!canToggleShield}
          >
            {ship.isShieldUp ? '🛡️ 关闭护盾' : '🛡️ 开启护盾'}
          </button>
        </div>
      </div>

      {/* 武器开火 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔫 开火</div>

        {/* 武器选择 */}
        <div style={styles.weaponList}>
          {availableWeapons.length > 0 ? (
            availableWeapons.map((weapon) => (
              <div
                key={weapon.weaponId}
                style={{
                  ...styles.weaponItem,
                  ...(selectedWeaponId === weapon.weaponId ? styles.weaponItemSelected : {}),
                }}
                onClick={() => setSelectedWeaponId(weapon.weaponId)}
              >
                <span style={styles.weaponName}>{weapon.weaponId.slice(-6)}</span>
                <span style={styles.weaponStats}>
                  伤害:{weapon.damage} 射程:{weapon.range}
                </span>
              </div>
            ))
          ) : (
            <div style={styles.emptyState}>
              {ship.weapons.size > 0 ? '武器冷却中...' : '无可用武器'}
            </div>
          )}
        </div>

        {/* 目标选择 */}
        {selectedWeaponId && (
          <div style={styles.targetSelect}>
            <div style={{ fontSize: '11px', color: '#8ba4c7', marginBottom: '4px' }}>
              选择目标:
            </div>
            {availableTargets.map((target) => (
              <div
                key={target.id}
                style={{
                  ...styles.targetItem,
                  ...(selectedTargetId === target.id ? styles.targetItemSelected : {}),
                }}
                onClick={() => setSelectedTargetId(target.id)}
              >
                <span style={{ color: '#cfe8ff' }}>{target.id.slice(-6)}</span>
                <span style={{ color: '#8ba4c7' }}>
                  {target.faction === 'player' ? '玩家' : '敌方'}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          style={{
            ...styles.button,
            ...styles.buttonDanger,
            ...(ship.hasFired || !canFire || !selectedWeaponId || !selectedTargetId
              ? styles.buttonDisabled : {}),
          }}
          onClick={handleFire}
          disabled={ship.hasFired || !canFire || !selectedWeaponId || !selectedTargetId}
        >
          {ship.hasFired ? '✓ 已开火' : '💥 开火'}
        </button>
      </div>

      {/* 辐能排散 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>⚡ 辐能</div>
        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.button,
              ...styles.buttonWarning,
              ...(!canVent ? styles.buttonDisabled : {}),
            }}
            onClick={handleVent}
            disabled={!canVent}
          >
            💨 排散辐能
          </button>
        </div>
        {!canVent && ship && (
          <div style={{ fontSize: '10px', color: '#8ba4c7', textAlign: 'center' }}>
            {ship.isShieldUp ? '需要关闭护盾' : '没有辐能可排散'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipActionPanel;