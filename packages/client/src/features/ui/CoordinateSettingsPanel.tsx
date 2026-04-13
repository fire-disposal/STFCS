/**
 * 坐标与导航设置面板
 * 提供坐标精度、网格吸附、角度模式等设置
 * 
 * 使用 game-panels.css 样式系统
 */

import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { MapPin, Grid3X3, Compass } from 'lucide-react';

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
    <>
      <div className="game-section">
        <div className="game-section__title">
          <MapPin className="game-section__icon" />
          坐标精度
        </div>
        <div className="game-btn-group game-btn-group--vertical">
          <button
            data-magnetic
            className={`game-btn game-btn--small ${coordinatePrecision === 'exact' ? 'game-btn--primary' : ''}`}
            onClick={() => setCoordinatePrecision('exact')}
          >
            精确 (1 单位)
          </button>
          <button
            data-magnetic
            className={`game-btn game-btn--small ${coordinatePrecision === 'rounded10' ? 'game-btn--primary' : ''}`}
            onClick={() => setCoordinatePrecision('rounded10')}
          >
            舍入 10 (推荐)
          </button>
          <button
            data-magnetic
            className={`game-btn game-btn--small ${coordinatePrecision === 'rounded100' ? 'game-btn--primary' : ''}`}
            onClick={() => setCoordinatePrecision('rounded100')}
          >
            舍入 100
          </button>
        </div>
        <div className="game-setting__hint">太空环境推荐使用舍入 10，减少不必要的精度</div>
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Grid3X3 className="game-section__icon" />
          网格吸附
        </div>
        <div className="game-setting-row">
          <span className="game-setting__label">启用网格吸附</span>
          <button
            data-magnetic
            className={`game-toggle ${gridSnap ? 'game-toggle--active' : ''}`}
            onClick={toggleGridSnap}
          >
            <div className="game-toggle__knob" />
          </button>
        </div>
        <div className="game-setting-row">
          <span className="game-setting__label">网格大小</span>
          <input
            type="number"
            className="game-input game-input--small game-input--narrow"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            min={10}
            max={1000}
            step={10}
          />
        </div>
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Compass className="game-section__icon" />
          角度模式
        </div>
        <div className="game-btn-group game-btn-group--vertical">
          <button
            data-magnetic
            className={`game-btn game-btn--small ${angleMode === 'degrees' ? 'game-btn--primary' : ''}`}
            onClick={() => setAngleMode('degrees')}
          >
            度数 (0-360°)
          </button>
          <button
            data-magnetic
            className={`game-btn game-btn--small ${angleMode === 'nav' ? 'game-btn--primary' : ''}`}
            onClick={() => setAngleMode('nav')}
          >
            航海角度 (北为 0°)
          </button>
          <button
            data-magnetic
            className={`game-btn game-btn--small ${angleMode === 'radians' ? 'game-btn--primary' : ''}`}
            onClick={() => setAngleMode('radians')}
          >
            弧度 (0-2π)
          </button>
        </div>
        <div className="game-setting__hint">航海角度：北=0°，东=90°，南=180°，西=270°</div>
      </div>

      <div className="game-section">
        <div className="game-section__title">🖱️ 指针设置</div>
        <div className="game-setting-row">
          <span className="game-setting__label">隐藏原生指针</span>
          <button
            data-magnetic
            className={`game-toggle ${hideNativeCursor ? 'game-toggle--active' : ''}`}
            onClick={() => setHideNativeCursor(!hideNativeCursor)}
          >
            <div className="game-toggle__knob" />
          </button>
        </div>
        <div className="game-setting__hint">开启后，磁性指针显示时会隐藏系统原生光标；默认关闭</div>
      </div>
    </>
  );
};

export default CoordinateSettingsPanel;