/**
 * DM 对象创建面板
 * 
 * 提供舰船、小行星、空间站等对象的创建和摆放功能
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { FactionValue } from '@vt/contracts';
import { Faction } from '@vt/contracts';
import { getAvailableShips } from '@vt/rules';

type TokenType = 'ship' | 'station' | 'asteroid';

// 样式定义
const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #7c3aed',
    minWidth: '300px',
    maxWidth: '360px',
    maxHeight: '500px',
    overflowY: 'auto' as const,
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: '12px',
    borderBottom: '1px solid #5a2a3a',
    paddingBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#8ba4c7',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  objectTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
    marginBottom: '8px',
  },
  objectTypeButton: {
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #5a2a3a',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center' as const,
  },
  objectTypeButtonActive: {
    backgroundColor: '#5a2a3a',
    borderColor: '#a78bfa',
    color: '#a78bfa',
  },
  shipGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    padding: '4px',
  },
  shipCard: {
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #2b4261',
    backgroundColor: 'rgba(10, 30, 50, 0.5)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '10px',
  },
  shipCardSelected: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  shipCardName: {
    color: '#cfe8ff',
    fontWeight: 'bold',
    marginBottom: '4px',
    fontSize: '11px',
  },
  shipCardStats: {
    color: '#8ba4c7',
    fontSize: '9px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
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
    minWidth: '50px',
  },
  select: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #5a2a3a',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '11px',
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #5a2a3a',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '11px',
  },
  button: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '6px',
    border: '1px solid #5a2a3a',
    backgroundColor: '#3a2a4a',
    color: '#a78bfa',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  buttonPrimary: {
    backgroundColor: '#5a2a3a',
    borderColor: '#a78bfa',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  modeHint: {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    color: '#a78bfa',
    fontSize: '11px',
    textAlign: 'center' as const,
    marginBottom: '8px',
    border: '1px dashed #7c3aed',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#8ba4c7',
    padding: '12px',
    fontSize: '11px',
  },
};

const objectTypes = [
  { id: 'ship' as TokenType, label: '🚀 舰船', icon: '🚀' },
  { id: 'station' as TokenType, label: '🛰️ 空间站', icon: '🛰️' },
  { id: 'asteroid' as TokenType, label: '☄️ 小行星', icon: '☄️' },
] as const;

interface DMObjectCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateObject: (params: {
    type: TokenType;
    hullId?: string;
    x: number;
    y: number;
    heading: number;
    faction: FactionValue;
    ownerId?: string;
  }) => void;
  players: Array<{ sessionId: string; name: string; role: string }>;
}

const ShipSizeIcons: Record<string, string> = {
  fighter: '🛩️',
  frigate: '🚀',
  destroyer: '🚢',
  cruiser: '🛳️',
  capital: '🏢',
};

export const DMObjectCreator: React.FC<DMObjectCreatorProps> = ({
  isOpen,
  onClose,
  onCreateObject,
  players,
}) => {
  // 对象类型
  const [objectType, setObjectType] = useState<TokenType>('ship');
  // 选中的舰船 ID
  const [selectedHullId, setSelectedHullId] = useState<string>('frigate_assault');
  // 摆放位置
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [heading, setHeading] = useState(0);
  // 阵营和归属
  const [faction, setFaction] = useState<FactionValue>(Faction.DM);
  const [ownerId, setOwnerId] = useState<string>('');
  // 摆放模式
  const [placementMode, setPlacementMode] = useState<'manual' | 'click'>('click');

  // 可用舰船列表
  const availableShips = useMemo(() => getAvailableShips(), []);

  // 重置状态
  const resetState = useCallback(() => {
    setPositionX(0);
    setPositionY(0);
    setHeading(0);
    setFaction(Faction.DM);
    setOwnerId('');
  }, []);

  // 处理创建对象
  const handleCreate = useCallback(() => {
    onCreateObject({
      type: objectType,
      hullId: objectType === 'ship' ? selectedHullId : undefined,
      x: positionX,
      y: positionY,
      heading,
      faction,
      ownerId: ownerId || undefined,
    });
    resetState();
  }, [objectType, selectedHullId, positionX, positionY, heading, faction, ownerId, onCreateObject, resetState]);

  // 启用点击摆放模式
  const enableClickPlacement = useCallback(() => {
    setPlacementMode('click');
  }, []);

  if (!isOpen) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>🎨 对象创建工具</span>
        <button style={styles.closeButton} onClick={onClose}>×</button>
      </div>

      {/* 对象类型选择 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📦 对象类型</div>
        <div style={styles.objectTypeGrid}>
          {objectTypes.map((type) => (
            <button
              key={type.id}
              style={{
                ...styles.objectTypeButton,
                ...(objectType === type.id ? styles.objectTypeButtonActive : {}),
              }}
              onClick={() => setObjectType(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 舰船选择（仅当类型为 ship 时） */}
      {objectType === 'ship' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>🚀 选择舰船型号</div>
          <div style={styles.shipGrid}>
            {availableShips.map((ship) => (
              <div
                key={ship.id}
                style={{
                  ...styles.shipCard,
                  ...(selectedHullId === ship.id ? styles.shipCardSelected : {}),
                }}
                onClick={() => setSelectedHullId(ship.id)}
              >
                <div style={styles.shipCardName}>
                  {ShipSizeIcons[ship.size]} {ship.name}
                </div>
                <div style={styles.shipCardStats}>
                  <span>船体：{ship.hullPoints}</span>
                  <span>装甲：{ship.armorValue}</span>
                  <span>武器：{ship.weaponMounts.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 摆放模式提示 */}
      {placementMode === 'click' && (
        <div style={styles.modeHint}>
          🎯 请点击地图选择摆放位置
        </div>
      )}

      {/* 位置设置 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📍 摆放位置</div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>X</span>
          <input
            type="number"
            style={styles.input}
            value={positionX}
            onChange={(e) => setPositionX(Number(e.target.value))}
          />
        </div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>Y</span>
          <input
            type="number"
            style={styles.input}
            value={positionY}
            onChange={(e) => setPositionY(Number(e.target.value))}
          />
        </div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>朝向</span>
          <input
            type="number"
            style={styles.input}
            value={heading}
            onChange={(e) => setHeading(Number(e.target.value))}
            min={0}
            max={359}
          />
        </div>
        <button
          style={styles.button}
          onClick={enableClickPlacement}
        >
          🎯 点击地图选择位置
        </button>
      </div>

      {/* 阵营和归属权 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>👥 阵营与归属</div>
        <div style={styles.inputRow}>
          <span style={styles.inputLabel}>阵营</span>
          <select
            style={styles.select}
            value={faction}
            onChange={(e) => setFaction(e.target.value as FactionValue)}
          >
            <option value={Faction.PLAYER}>玩家阵营</option>
            <option value={Faction.DM}>DM 阵营（敌方）</option>
          </select>
        </div>
        {faction === Faction.PLAYER && (
          <div style={styles.inputRow}>
            <span style={styles.inputLabel}>归属</span>
            <select
              style={styles.select}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">未分配（自由控制）</option>
              {players.filter(p => p.role !== 'dm').map((player) => (
                <option key={player.sessionId} value={player.sessionId}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 创建按钮 */}
      <button
        style={{
          ...styles.button,
          ...styles.buttonPrimary,
        }}
        onClick={handleCreate}
      >
        ✨ 创建对象
      </button>
    </div>
  );
};

export default DMObjectCreator;
