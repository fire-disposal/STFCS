/**
 * 视图旋转控制面板
 * 
 * 提供地图视图旋转控制功能
 * - 手动旋转视图
 * - 对齐到选中舰船的朝向
 * - 重置视图旋转
 */

import React, { useState, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import type { ShipState } from '@vt/contracts';
import { calculateViewRotationForAlignment, formatAngle } from '@/utils/angleSystem';

const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '0',
    padding: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    minWidth: '200px',
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
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  button: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonActive: {
    backgroundColor: '#1a4a7a',
    borderColor: '#4a9eff',
    color: '#4a9eff',
  },
  input: {
    width: '60px',
    padding: '4px 8px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '10px',
  },
  valueDisplay: {
    fontSize: '10px',
    color: '#8ba4c7',
    padding: '4px 8px',
    backgroundColor: 'rgba(10, 30, 50, 0.5)',
    borderRadius: '0',
    minWidth: '80px',
    textAlign: 'center' as const,
  },
  shipInfo: {
    fontSize: '9px',
    color: '#6b7280',
    marginTop: '4px',
  },
};

interface ViewRotationControlProps {
  selectedShip?: ShipState | null;
}

export const ViewRotationControl: React.FC<ViewRotationControlProps> = ({
  selectedShip,
}) => {
  const { viewRotation, setViewRotation, resetViewRotation } = useUIStore();
  const [isAligning, setIsAligning] = useState(false);

  // 对齐到舰船朝向
  const alignToShip = useCallback(() => {
    if (!selectedShip) return;

    const shipAngle = selectedShip.transform.heading;
    const targetRotation = calculateViewRotationForAlignment(shipAngle);
    
    setViewRotation(targetRotation);
    setIsAligning(true);
  }, [selectedShip, setViewRotation]);

  // 重置视图
  const resetRotation = useCallback(() => {
    resetViewRotation();
    setIsAligning(false);
  }, [resetViewRotation]);

  // 旋转角度增减
  const rotateBy = useCallback((delta: number) => {
    setViewRotation(viewRotation + delta);
  }, [viewRotation, setViewRotation]);

  return (
    <div style={styles.panel}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🧭 视图旋转</div>
        
        {/* 当前旋转值显示 */}
        <div style={styles.controlRow}>
          <span style={styles.valueDisplay}>
            {Math.round(viewRotation)}°
          </span>
          <button
            style={styles.button}
            onClick={() => rotateBy(-15)}
          >
            -15°
          </button>
          <button
            style={styles.button}
            onClick={() => rotateBy(-5)}
          >
            -5°
          </button>
          <button
            style={styles.button}
            onClick={() => rotateBy(5)}
          >
            +5°
          </button>
          <button
            style={styles.button}
            onClick={() => rotateBy(15)}
          >
            +15°
          </button>
        </div>

        {/* 重置按钮 */}
        <button
          style={{
            ...styles.button,
            ...styles.buttonActive,
            width: '100%',
          }}
          onClick={resetRotation}
        >
          🔄 重置视图 (0°)
        </button>
      </div>

      {/* 对齐到舰船 */}
      {selectedShip && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>🎯 对齐到舰船</div>
          
          <button
            style={{
              ...styles.button,
              ...(isAligning ? styles.buttonActive : {}),
              width: '100%',
            }}
            onClick={alignToShip}
          >
            📍 对齐到当前舰船朝向
          </button>
          
          <div style={styles.shipInfo}>
            舰船朝向：{formatAngle(selectedShip.transform.heading, { mode: 'math', showDecimal: true })}
          </div>
          
          {isAligning && (
            <div style={{ ...styles.shipInfo, color: '#4a9eff' }}>
              视图已旋转 {Math.round(viewRotation)}° 以对齐舰船
            </div>
          )}
        </div>
      )}

      {!selectedShip && (
        <div style={styles.shipInfo}>
          选择一艘舰船以启用对齐功能
        </div>
      )}
    </div>
  );
};

export default ViewRotationControl;
