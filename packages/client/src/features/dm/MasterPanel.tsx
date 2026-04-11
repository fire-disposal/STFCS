/**
 * 全局修正面板 (Master Panel)
 * 
 * DM 专用：调整全局游戏参数修正值
 */

import React, { useState, useCallback } from 'react';

const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #7c3aed',
    minWidth: '240px',
  },
  header: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  section: {
    marginBottom: '10px',
    padding: '8px',
    backgroundColor: 'rgba(10, 30, 50, 0.5)',
    borderRadius: '4px',
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#8ba4c7',
    marginBottom: '6px',
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  label: {
    fontSize: '10px',
    color: '#cfe8ff',
  },
  input: {
    width: '70px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '10px',
  },
  slider: {
    width: '100%',
    marginTop: '4px',
  },
  valueDisplay: {
    fontSize: '9px',
    color: '#4a9eff',
    fontWeight: 'bold',
  },
  resetButton: {
    width: '100%',
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#8ba4c7',
    fontSize: '10px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  hint: {
    fontSize: '9px',
    color: '#6b7280',
    marginTop: '6px',
    fontStyle: 'italic',
  },
};

interface GlobalModifiers {
  rangeMultiplier: number;    // 射程修正 (默认 1.0)
  damageMultiplier: number;   // 伤害修正 (默认 1.0)
  fluxCapacityMultiplier: number; // 辐能容量修正 (默认 1.0)
  armorMultiplier: number;    // 装甲修正 (默认 1.0)
  speedMultiplier: number;    // 速度修正 (默认 1.0)
}

const DEFAULT_MODIFIERS: GlobalModifiers = {
  rangeMultiplier: 1.0,
  damageMultiplier: 1.0,
  fluxCapacityMultiplier: 1.0,
  armorMultiplier: 1.0,
  speedMultiplier: 1.0,
};

interface MasterPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  modifiers?: Partial<GlobalModifiers>;
  onModifiersChange?: (modifiers: GlobalModifiers) => void;
  isDM?: boolean;
}

export const MasterPanel: React.FC<MasterPanelProps> = ({
  isOpen = true,
  onClose,
  modifiers = {},
  onModifiersChange,
  isDM = false,
}) => {
  const [localModifiers, setLocalModifiers] = useState<GlobalModifiers>({
    ...DEFAULT_MODIFIERS,
    ...modifiers,
  });

  const updateModifier = useCallback((key: keyof GlobalModifiers, value: number) => {
    const updated = { ...localModifiers, [key]: value };
    setLocalModifiers(updated);
    onModifiersChange?.(updated);
  }, [localModifiers, onModifiersChange]);

  const resetModifiers = useCallback(() => {
    setLocalModifiers(DEFAULT_MODIFIERS);
    onModifiersChange?.(DEFAULT_MODIFIERS);
  }, [onModifiersChange]);

  if (!isOpen) return null;

  if (!isDM) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>🎛️ 全局修正面板</div>
        <div style={{ color: '#8ba4c7', fontSize: '10px', textAlign: 'center' }}>
          ⚠️ 仅 DM 可访问
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        🎛️ 全局修正面板
        {onClose && (
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8ba4c7',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '0 4px',
            }}
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      {/* 射程修正 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>射程修正</div>
        <div style={styles.controlRow}>
          <span style={styles.label}>倍率</span>
          <input
            type="number"
            style={styles.input}
            value={localModifiers.rangeMultiplier.toFixed(2)}
            onChange={(e) => updateModifier('rangeMultiplier', parseFloat(e.target.value) || 1)}
            step={0.1}
            min={0.1}
            max={3.0}
          />
        </div>
        <input
          type="range"
          style={styles.slider}
          min={0.1}
          max={3.0}
          step={0.1}
          value={localModifiers.rangeMultiplier}
          onChange={(e) => updateModifier('rangeMultiplier', parseFloat(e.target.value))}
        />
        <div style={styles.valueDisplay}>
          x{localModifiers.rangeMultiplier.toFixed(2)}
        </div>
      </div>

      {/* 伤害修正 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>伤害修正</div>
        <div style={styles.controlRow}>
          <span style={styles.label}>倍率</span>
          <input
            type="number"
            style={styles.input}
            value={localModifiers.damageMultiplier.toFixed(2)}
            onChange={(e) => updateModifier('damageMultiplier', parseFloat(e.target.value) || 1)}
            step={0.1}
            min={0.1}
            max={3.0}
          />
        </div>
        <input
          type="range"
          style={styles.slider}
          min={0.1}
          max={3.0}
          step={0.1}
          value={localModifiers.damageMultiplier}
          onChange={(e) => updateModifier('damageMultiplier', parseFloat(e.target.value))}
        />
        <div style={styles.valueDisplay}>
          x{localModifiers.damageMultiplier.toFixed(2)}
        </div>
      </div>

      {/* 辐能容量修正 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>辐能容量修正</div>
        <div style={styles.controlRow}>
          <span style={styles.label}>倍率</span>
          <input
            type="number"
            style={styles.input}
            value={localModifiers.fluxCapacityMultiplier.toFixed(2)}
            onChange={(e) => updateModifier('fluxCapacityMultiplier', parseFloat(e.target.value) || 1)}
            step={0.1}
            min={0.5}
            max={2.0}
          />
        </div>
        <input
          type="range"
          style={styles.slider}
          min={0.5}
          max={2.0}
          step={0.1}
          value={localModifiers.fluxCapacityMultiplier}
          onChange={(e) => updateModifier('fluxCapacityMultiplier', parseFloat(e.target.value))}
        />
        <div style={styles.valueDisplay}>
          x{localModifiers.fluxCapacityMultiplier.toFixed(2)}
        </div>
      </div>

      {/* 装甲修正 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>装甲修正</div>
        <div style={styles.controlRow}>
          <span style={styles.label}>倍率</span>
          <input
            type="number"
            style={styles.input}
            value={localModifiers.armorMultiplier.toFixed(2)}
            onChange={(e) => updateModifier('armorMultiplier', parseFloat(e.target.value) || 1)}
            step={0.1}
            min={0.5}
            max={2.0}
          />
        </div>
        <input
          type="range"
          style={styles.slider}
          min={0.5}
          max={2.0}
          step={0.1}
          value={localModifiers.armorMultiplier}
          onChange={(e) => updateModifier('armorMultiplier', parseFloat(e.target.value))}
        />
        <div style={styles.valueDisplay}>
          x{localModifiers.armorMultiplier.toFixed(2)}
        </div>
      </div>

      {/* 速度修正 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>速度修正</div>
        <div style={styles.controlRow}>
          <span style={styles.label}>倍率</span>
          <input
            type="number"
            style={styles.input}
            value={localModifiers.speedMultiplier.toFixed(2)}
            onChange={(e) => updateModifier('speedMultiplier', parseFloat(e.target.value) || 1)}
            step={0.1}
            min={0.5}
            max={2.0}
          />
        </div>
        <input
          type="range"
          style={styles.slider}
          min={0.5}
          max={2.0}
          step={0.1}
          value={localModifiers.speedMultiplier}
          onChange={(e) => updateModifier('speedMultiplier', parseFloat(e.target.value))}
        />
        <div style={styles.valueDisplay}>
          x{localModifiers.speedMultiplier.toFixed(2)}
        </div>
      </div>

      {/* 重置按钮 */}
      <button style={styles.resetButton} onClick={resetModifiers}>
        🔄 重置所有修正
      </button>

      {/* 提示信息 */}
      <div style={styles.hint}>
        💡 修改全局参数可调整游戏节奏和难度
      </div>
    </div>
  );
};

export default MasterPanel;
