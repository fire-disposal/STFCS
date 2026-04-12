/**
 * DM 控制面板
 *
 * DM 专用操作界面：
 * - 创建测试舰船
 * - 清除舰船过载
 * - 修改护甲值
 * - 分配舰船控制权
 * - 强制推进阶段
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ShipState, PlayerState } from '@vt/contracts';

// 样式定义
const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #ff6f8f',
    minWidth: '280px',
    maxWidth: '320px',
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ff6f8f',
    marginBottom: '12px',
    borderBottom: '1px solid #5a2a3a',
    paddingBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#ff6f8f',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
    border: '1px solid #5a2a3a',
    backgroundColor: '#3a2a4a',
    color: '#ff6f8f',
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
    backgroundColor: '#5a2a3a',
    borderColor: '#ff6f8f',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #5a2a3a',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '12px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #5a2a3a',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '12px',
    marginBottom: '8px',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  inputLabel: {
    fontSize: '11px',
    color: '#8ba4c7',
    minWidth: '60px',
  },
  shipList: {
    maxHeight: '120px',
    overflow: 'auto',
  },
  shipItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    backgroundColor: '#1a2d42',
    borderRadius: '4px',
    marginBottom: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
    fontSize: '11px',
  },
  shipItemSelected: {
    borderColor: '#ff6f8f',
    backgroundColor: '#3a2a4a',
  },
  shipInfo: {
    flex: 1,
    color: '#cfe8ff',
  },
  shipStatus: {
    fontSize: '10px',
    color: '#8ba4c7',
  },
  warning: {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#5a4a2a',
    color: '#f1c40f',
    fontSize: '11px',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#8ba4c7',
    padding: '12px',
    fontSize: '11px',
  },
};

// 象限名称
const quadrantNames = ['前', '前右', '后右', '后', '后左', '前左'];

interface DMControlPanelProps {
  ships: ShipState[];
  players: PlayerState[];
  isDM: boolean;
  onCreateTestShip: (faction: 'player' | 'dm', x: number, y: number) => void;
  onClearOverload: (shipId: string) => void;
  onSetArmor: (shipId: string, section: number, value: number) => void;
  onAssignShip: (shipId: string, targetSessionId: string) => void;
  onNextPhase: () => void;
  disabled?: boolean;
}

export const DMControlPanel: React.FC<DMControlPanelProps> = ({
  ships,
  players,
  isDM,
  onCreateTestShip,
  onClearOverload,
  onSetArmor,
  onAssignShip,
  onNextPhase,
  disabled = false,
}) => {
  // 选中的舰船
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  // 选中的玩家
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // 护甲修改参数
  const [armorSection, setArmorSection] = useState(0);
  const [armorValue, setArmorValue] = useState(100);
  // 创建舰船位置
  const [createX, setCreateX] = useState(200);
  const [createY, setCreateY] = useState(200);
  const [createFaction, setCreateFaction] = useState<'player' | 'dm'>('dm');

  // 选中的舰船详情
  const selectedShip = useMemo(() => {
    return ships.find((s) => s.id === selectedShipId);
  }, [ships, selectedShipId]);

  // 过载舰船列表
  const overloadedShips = useMemo(() => {
    return ships.filter((s) => s.isOverloaded);
  }, [ships]);

  // 非DM玩家列表
  const regularPlayers = useMemo(() => {
    return players.filter((p) => p.role !== 'dm' && p.connected);
  }, [players]);

  // 处理创建测试舰船
  const handleCreateShip = useCallback(() => {
    onCreateTestShip(createFaction, createX, createY);
  }, [createFaction, createX, createY, onCreateTestShip]);

  // 处理清除过载
  const handleClearOverload = useCallback(() => {
    if (selectedShipId) {
      onClearOverload(selectedShipId);
    }
  }, [selectedShipId, onClearOverload]);

  // 处理修改护甲
  const handleSetArmor = useCallback(() => {
    if (selectedShipId) {
      onSetArmor(selectedShipId, armorSection, armorValue);
    }
  }, [selectedShipId, armorSection, armorValue, onSetArmor]);

  // 处理分配舰船
  const handleAssignShip = useCallback(() => {
    if (selectedShipId && selectedPlayerId) {
      onAssignShip(selectedShipId, selectedPlayerId);
    }
  }, [selectedShipId, selectedPlayerId, onAssignShip]);

  if (!isDM) {
    return null;
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        👑 DM 控制面板
      </div>

      {!isDM && (
        <div style={styles.warning}>
          ⚠️ 只有 DM 可以使用此面板
        </div>
      )}

      {/* 创建测试舰船 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🚀 创建舰船</div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>阵营</span>
          <select
            style={styles.select}
            value={createFaction}
            onChange={(e) => setCreateFaction(e.target.value as 'player' | 'dm')}
            disabled={disabled}
          >
            <option value="player">玩家</option>
            <option value="dm">敌方</option>
          </select>
        </div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>位置 X</span>
          <input
            type="number"
            style={styles.input}
            value={createX}
            onChange={(e) => setCreateX(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>位置 Y</span>
          <input
            type="number"
            style={styles.input}
            value={createY}
            onChange={(e) => setCreateY(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(disabled ? styles.buttonDisabled : {}),
          }}
          onClick={handleCreateShip}
          disabled={disabled}
        >
          ✨ 创建舰船
        </button>
      </div>

      {/* 舰船选择 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎯 选择舰船 ({ships.length})</div>
        <div style={styles.shipList}>
          {ships.length > 0 ? (
            ships.map((ship) => (
              <div
                key={ship.id}
                style={{
                  ...styles.shipItem,
                  ...(selectedShipId === ship.id ? styles.shipItemSelected : {}),
                }}
                onClick={() => setSelectedShipId(ship.id)}
              >
                <span style={styles.shipInfo}>
                  {ship.id.slice(-6)} · {ship.faction === 'player' ? '玩家' : '敌方'}
                </span>
                {ship.isOverloaded && (
                  <span style={{ color: '#e74c3c', fontSize: '10px' }}>过载</span>
                )}
              </div>
            ))
          ) : (
            <div style={styles.emptyState}>暂无舰船</div>
          )}
        </div>
      </div>

      {/* 清除过载 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>⚡ 过载管理 ({overloadedShips.length})</div>
        {overloadedShips.length > 0 ? (
          <>
            <div style={styles.shipList}>
              {overloadedShips.map((ship) => (
                <div
                  key={ship.id}
                  style={{
                    ...styles.shipItem,
                    ...(selectedShipId === ship.id ? styles.shipItemSelected : {}),
                  }}
                  onClick={() => setSelectedShipId(ship.id)}
                >
                  <span style={styles.shipInfo}>{ship.id.slice(-6)}</span>
                  <span style={{ color: '#e74c3c', fontSize: '10px' }}>
                    {Math.round(ship.overloadTime)}s
                  </span>
                </div>
              ))}
            </div>
            <button
              style={{
                ...styles.button,
                ...(!selectedShipId || disabled ? styles.buttonDisabled : {}),
              }}
              onClick={handleClearOverload}
              disabled={!selectedShipId || disabled}
            >
              🔓 清除过载
            </button>
          </>
        ) : (
          <div style={styles.emptyState}>无过载舰船</div>
        )}
      </div>

      {/* 修改护甲 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🛡️ 护甲修改</div>
        {selectedShip && (
          <>
            <div style={styles.inputRow}>
              <span style={styles.inputLabel}>象限</span>
              <select
                style={styles.select}
                value={armorSection}
                onChange={(e) => setArmorSection(Number(e.target.value))}
                disabled={disabled}
              >
                {quadrantNames.map((name, i) => (
                  <option key={i} value={i}>
                    {name} ({selectedShip.armorCurrent[i]}/{selectedShip.armorMax[i]})
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.inputRow}>
              <span style={styles.inputLabel}>新值</span>
              <input
                type="number"
                style={styles.input}
                value={armorValue}
                onChange={(e) => setArmorValue(Number(e.target.value))}
                min={0}
                max={selectedShip.armorMax[armorSection]}
                disabled={disabled}
              />
            </div>
            <button
              style={{
                ...styles.button,
                ...(disabled ? styles.buttonDisabled : {}),
              }}
              onClick={handleSetArmor}
              disabled={disabled}
            >
              ✏️ 修改护甲
            </button>
          </>
        )}
        {!selectedShip && (
          <div style={styles.emptyState}>请先选择舰船</div>
        )}
      </div>

      {/* 分配舰船 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>👥 分配舰船</div>
        {selectedShip && regularPlayers.length > 0 ? (
          <>
            <select
              style={styles.select}
              value={selectedPlayerId || ''}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              disabled={disabled}
            >
              <option value="">选择玩家...</option>
              {regularPlayers.map((player) => (
                <option key={player.sessionId} value={player.sessionId}>
                  {player.name}
                </option>
              ))}
            </select>
            <button
              style={{
                ...styles.button,
                ...(!selectedPlayerId || disabled ? styles.buttonDisabled : {}),
              }}
              onClick={handleAssignShip}
              disabled={!selectedPlayerId || disabled}
            >
              📤 分配给玩家
            </button>
          </>
        ) : (
          <div style={styles.emptyState}>
            {regularPlayers.length === 0 ? '无在线玩家' : '请先选择舰船'}
          </div>
        )}
      </div>

      {/* 强制推进阶段 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>⏭️ 阶段控制</div>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(disabled ? styles.buttonDisabled : {}),
          }}
          onClick={onNextPhase}
          disabled={disabled}
        >
          ⏭️ 强制进入下一阶段
        </button>
      </div>
    </div>
  );
};

export default DMControlPanel;