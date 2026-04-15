/**
 * 设置菜单组件
 * 
 * 提供游戏设置选项
 * - 坐标精度设置
 * - 视角设置
 * - 游戏设置
 * - 音频设置
 * 
 * 使用 game-panels.css 样式系统
 */

import React, { useState } from 'react';
import { useUIStore, CoordinatePrecision, AngleMode } from '@/state/stores/uiStore';
import { CoordinateSettingsPanel } from '../panels/CoordinateSettingsPanel';
import { Settings, MapPin, Compass } from 'lucide-react';

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
    <div className="game-modal-overlay" onClick={onClose}>
      <div className="game-modal" onClick={(e) => e.stopPropagation()}>
        <div className="game-panel__header">
          <div className="game-panel__title">
            <Settings className="game-panel__title-icon" />
            设置
          </div>
          <button className="game-panel__close" onClick={onClose}>×</button>
        </div>

        <div className="game-panel__content">
          <div className="game-tabs">
            <button
              className={`game-tab ${activeTab === 'general' ? 'game-tab--active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              通用
            </button>
            <button
              className={`game-tab ${activeTab === 'view' ? 'game-tab--active' : ''}`}
              onClick={() => setActiveTab('view')}
            >
              视图
            </button>
            <button
              className={`game-tab ${activeTab === 'game' ? 'game-tab--active' : ''}`}
              onClick={() => setActiveTab('game')}
            >
              游戏
            </button>
            <button
              className={`game-tab ${activeTab === 'audio' ? 'game-tab--active' : ''}`}
              onClick={() => setActiveTab('audio')}
              disabled
            >
              音频 (Coming Soon)
            </button>
          </div>

          {activeTab === 'general' && (
            <>
              <div className="game-section">
                <div className="game-section__title">
                  <MapPin className="game-section__icon" />
                  坐标精度
                </div>
                <div className="game-setting-row">
                  <div>
                    <div className="game-setting__label">坐标显示精度</div>
                    <div className="game-setting__hint">太空环境推荐使用舍入 10</div>
                  </div>
                  <select
                    className="game-select"
                    value={coordinatePrecision}
                    onChange={(e) => setCoordinatePrecision(e.target.value as CoordinatePrecision)}
                  >
                    <option value="exact">精确 (1 单位)</option>
                    <option value="rounded10">舍入 10</option>
                    <option value="rounded100">舍入 100</option>
                  </select>
                </div>
              </div>

              <div className="game-section">
                <div className="game-section__title">
                  <Compass className="game-section__icon" />
                  角度模式
                </div>
                <div className="game-setting-row">
                  <div>
                    <div className="game-setting__label">角度显示格式</div>
                    <div className="game-setting__hint">航海角度：北=0°，顺时针</div>
                  </div>
                  <select
                    className="game-select"
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

          {activeTab === 'view' && (
            <>
              <CoordinateSettingsPanel />
              
              <div className="game-section">
                <div className="game-section__title">🔲 网格显示</div>
                <div className="game-setting-row">
                  <div>
                    <div className="game-setting__label">显示网格</div>
                    <div className="game-setting__hint">辅助定位和测量</div>
                  </div>
                  <button
                    className={`game-toggle ${showGrid ? 'game-toggle--active' : ''}`}
                    onClick={toggleGrid}
                  >
                    <div className={`game-toggle__knob ${showGrid ? '' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="game-section">
                <div className="game-section__title">🔍 默认缩放</div>
                <div className="game-setting-row">
                  <div>
                    <div className="game-setting__label">缩放级别</div>
                    <div className="game-setting__hint">当前：{(zoom * 100).toFixed(0)}%</div>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="game-slider"
                    style={{ width: '150px' }}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'game' && (
            <div className="game-section">
              <div className="game-section__title">🎮 游戏选项</div>
              <div className="game-empty">游戏设置将在后续版本中添加</div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="game-section">
              <div className="game-empty">音频设置将在后续版本中添加</div>
            </div>
          )}

          <div className="game-btn-group game-btn-group--full">
            <button
              data-magnetic
              className="game-btn game-btn--danger game-btn--full"
              onClick={() => {
                setCoordinatePrecision('rounded10');
                setAngleMode('degrees');
              }}
            >
              🔄 重置设置
            </button>
            <button
              data-magnetic
              className="game-btn game-btn--primary game-btn--full"
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