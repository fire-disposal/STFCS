/**
 * 设置菜单组件
 * 
 * 提供游戏设置选项
 * - 坐标精度设置
 * - 视角设置
 * - 游戏设置
 * - 音频设置
 */

import React, { useState } from 'react';
import { useUIStore, CoordinatePrecision, AngleMode } from '@/store/uiStore';
import { CoordinateSettingsPanel } from './CoordinateSettingsPanel';

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    backgroundColor: 'rgba(6, 16, 26, 0.98)',
    borderRadius: '0',
    border: '1px solid #2b4261',
    minWidth: '500px',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #2b4261',
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#8ba4c7',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
  },
  content: {
    padding: '20px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid #2b4261',
    paddingBottom: '12px',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: 'transparent',
    color: '#8ba4c7',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#1a4a7a',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid rgba(43, 66, 97, 0.3)',
  },
  settingLabel: {
    fontSize: '12px',
    color: '#cfe8ff',
  },
  settingHint: {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '4px',
  },
  select: {
    padding: '6px 12px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '12px',
    minWidth: '120px',
  },
  toggle: {
    width: '44px',
    height: '22px',
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
    top: '3px',
    left: '3px',
    width: '16px',
    height: '16px',
    borderRadius: '0',
    backgroundColor: '#cfe8ff',
    transition: 'all 0.2s',
  },
  toggleKnobActive: {
    left: '25px',
    backgroundColor: '#4a9eff',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
  },
  button: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    backgroundColor: '#1a4a7a',
    borderColor: '#4a9eff',
  },
  buttonDanger: {
    backgroundColor: '#5a2a3a',
    borderColor: '#ff6f8f',
    color: '#ff6f8f',
  },
};

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'view' | 'game' | 'audio'>('general');
  
  const {
    coordinatePrecision,
    setCoordinatePrecision,
    angleMode,
    setAngleMode,
    showGrid,
    toggleGrid,
    zoom,
    setZoom,
  } = useUIStore();

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div style={styles.header}>
          <div style={styles.title}>⚙️ 设置</div>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* 内容 */}
        <div style={styles.content}>
          {/* 选项卡 */}
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'general' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('general')}
            >
              通用
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'view' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('view')}
            >
              视图
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'game' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('game')}
            >
              游戏
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'audio' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('audio')}
              disabled
            >
              音频 (Coming Soon)
            </button>
          </div>

          {/* 通用设置 */}
          {activeTab === 'general' && (
            <>
              <div style={styles.section}>
                <div style={styles.sectionTitle}>📍 坐标精度</div>
                <div style={styles.settingRow}>
                  <div>
                    <div style={styles.settingLabel}>坐标显示精度</div>
                    <div style={styles.settingHint}>
                      太空环境推荐使用舍入 10
                    </div>
                  </div>
                  <select
                    style={styles.select}
                    value={coordinatePrecision}
                    onChange={(e) => setCoordinatePrecision(e.target.value as CoordinatePrecision)}
                  >
                    <option value="exact">精确 (1 单位)</option>
                    <option value="rounded10">舍入 10</option>
                    <option value="rounded100">舍入 100</option>
                  </select>
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>🧭 角度模式</div>
                <div style={styles.settingRow}>
                  <div>
                    <div style={styles.settingLabel}>角度显示格式</div>
                    <div style={styles.settingHint}>
                      航海角度：北=0°，顺时针
                    </div>
                  </div>
                  <select
                    style={styles.select}
                    value={angleMode}
                    onChange={(e) => setAngleMode(e.target.value as AngleMode)}
                  >
                    <option value="degrees">度数 (0-360°)</option>
                    <option value="nav">航海角度</option>
                    <option value="radians">弧度</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* 视图设置 */}
          {activeTab === 'view' && (
            <>
              <CoordinateSettingsPanel />
              
              <div style={styles.section}>
                <div style={styles.sectionTitle}>🔲 网格显示</div>
                <div style={styles.settingRow}>
                  <div>
                    <div style={styles.settingLabel}>显示网格</div>
                    <div style={styles.settingHint}>
                      辅助定位和测量
                    </div>
                  </div>
                  <button
                    style={{
                      ...styles.toggle,
                      ...(showGrid ? styles.toggleActive : {}),
                    }}
                    onClick={toggleGrid}
                  >
                    <div
                      style={{
                        ...styles.toggleKnob,
                        ...(showGrid ? styles.toggleKnobActive : {}),
                      }}
                    />
                  </button>
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>🔍 默认缩放</div>
                <div style={styles.settingRow}>
                  <div>
                    <div style={styles.settingLabel}>缩放级别</div>
                    <div style={styles.settingHint}>
                      当前：{(zoom * 100).toFixed(0)}%
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    style={{ width: '150px' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* 游戏设置 */}
          {activeTab === 'game' && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🎮 游戏选项</div>
              <div style={{
                padding: '20px',
                textAlign: 'center' as const,
                color: '#8ba4c7',
                fontSize: '12px',
              }}>
                游戏设置将在后续版本中添加
              </div>
            </div>
          )}

          {/* 音频设置 */}
          {activeTab === 'audio' && (
            <div style={styles.section}>
              <div style={{
                padding: '20px',
                textAlign: 'center' as const,
                color: '#8ba4c7',
                fontSize: '12px',
              }}>
                音频设置将在后续版本中添加
              </div>
            </div>
          )}

          {/* 底部按钮 */}
          <div style={styles.buttonGroup}>
            <button
              style={{
                ...styles.button,
                ...styles.buttonDanger,
              }}
              onClick={() => {
                // 重置所有设置
                setCoordinatePrecision('rounded10');
                setAngleMode('degrees');
              }}
            >
              🔄 重置设置
            </button>
            <button
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
              }}
              onClick={onClose}
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
