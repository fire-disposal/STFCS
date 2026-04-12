/**
 * 坐标与导航设置面板
 * 提供坐标精度、网格吸附、角度模式等设置
 */

import React from 'react';
import { useUIStore } from '@/store/uiStore';
import type { CoordinatePrecision, AngleMode } from '@/store/uiStore';

const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '0',
    padding: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    minWidth: '240px',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#8ba4c7',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  optionGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  optionButton: {
    padding: '6px 10px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: 'rgba(10, 30, 50, 0.5)',
    color: '#cfe8ff',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
  },
  optionButtonActive: {
    backgroundColor: '#1a4a7a',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  toggleLabel: {
    fontSize: '10px',
    color: '#8ba4c7',
  },
  toggle: {
    width: '36px',
    height: '20px',
    borderRadius: '0',
    border: 'none',
    backgroundColor: '#2b4261',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'all 0.2s',
  },
  toggleActive: {
    backgroundColor: '#1a4a7a',
  },
  toggleKnob: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '16px',
    height: '16px',
    borderRadius: '0',
    backgroundColor: '#cfe8ff',
    transition: 'all 0.2s',
  },
  toggleKnobActive: {
    left: '18px',
    backgroundColor: '#4a9eff',
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '10px',
  },
  hint: {
    fontSize: '9px',
    color: '#6b7280',
    marginTop: '4px',
    fontStyle: 'italic',
  },
};

export const CoordinateSettingsPanel: React.FC = () => {
  const {
    coordinatePrecision,
    setCoordinatePrecision,
    gridSnap,
    toggleGridSnap,
    gridSize,
    setGridSize,
    angleMode,
    setAngleMode,
    hideNativeCursor,
    setHideNativeCursor,
  } = useUIStore();

  return (
    <div style={styles.panel}>
      {/* 坐标精度 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📍 坐标精度</div>
        <div style={styles.optionGroup}>
          <button
            style={{
              ...styles.optionButton,
              ...(coordinatePrecision === 'exact' ? styles.optionButtonActive : {}),
            }}
            onClick={() => setCoordinatePrecision('exact')}
          >
            精确 (1 单位)
          </button>
          <button
            style={{
              ...styles.optionButton,
              ...(coordinatePrecision === 'rounded10' ? styles.optionButtonActive : {}),
            }}
            onClick={() => setCoordinatePrecision('rounded10')}
          >
            舍入 10 (推荐)
          </button>
          <button
            style={{
              ...styles.optionButton,
              ...(coordinatePrecision === 'rounded100' ? styles.optionButtonActive : {}),
            }}
            onClick={() => setCoordinatePrecision('rounded100')}
          >
            舍入 100
          </button>
        </div>
        <div style={styles.hint}>
          太空环境推荐使用舍入 10，减少不必要的精度
        </div>
      </div>

      {/* 网格吸附 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔲 网格吸附</div>
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>启用网格吸附</span>
          <button
            style={{
              ...styles.toggle,
              ...(gridSnap ? styles.toggleActive : {}),
            }}
            onClick={toggleGridSnap}
          >
            <div
              style={{
                ...styles.toggleKnob,
                ...(gridSnap ? styles.toggleKnobActive : {}),
              }}
            />
          </button>
        </div>
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>网格大小</span>
          <input
            type="number"
            style={{ ...styles.input, width: '80px' }}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            min={10}
            max={1000}
            step={10}
          />
        </div>
      </div>

      {/* 角度模式 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🧭 角度模式</div>
        <div style={styles.optionGroup}>
          <button
            style={{
              ...styles.optionButton,
              ...(angleMode === 'degrees' ? styles.optionButtonActive : {}),
            }}
            onClick={() => setAngleMode('degrees')}
          >
            度数 (0-360°)
          </button>
          <button
            style={{
              ...styles.optionButton,
              ...(angleMode === 'nav' ? styles.optionButtonActive : {}),
            }}
            onClick={() => setAngleMode('nav')}
          >
            航海角度 (北为 0°)
          </button>
          <button
            style={{
              ...styles.optionButton,
              ...(angleMode === 'radians' ? styles.optionButtonActive : {}),
            }}
            onClick={() => setAngleMode('radians')}
          >
            弧度 (0-2π)
          </button>
        </div>
        <div style={styles.hint}>
          航海角度：北=0°，东=90°，南=180°，西=270°
        </div>
      </div>

      {/* 指针设置 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🖱️ 指针设置</div>
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>隐藏原生指针</span>
          <button
            style={{
              ...styles.toggle,
              ...(hideNativeCursor ? styles.toggleActive : {}),
            }}
            onClick={() => setHideNativeCursor(!hideNativeCursor)}
          >
            <div
              style={{
                ...styles.toggleKnob,
                ...(hideNativeCursor ? styles.toggleKnobActive : {}),
              }}
            />
          </button>
        </div>
        <div style={styles.hint}>
          开启后，磁性指针显示时会隐藏系统原生光标；默认关闭
        </div>
      </div>
    </div>
  );
};

export default CoordinateSettingsPanel;
