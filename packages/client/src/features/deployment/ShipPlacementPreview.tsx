/**
 * 舰船放置预览组件
 *
 * 在地图上显示舰船放置预览，支持：
 * - 位置选择
 * - 朝向调整
 * - 确认/取消操作
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { Point } from '@vt/shared/core-types';

// 样式
const styles = {
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
  },
  controls: {
    position: 'absolute' as const,
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '12px',
    pointerEvents: 'auto' as const,
    backgroundColor: 'var(--color-surface)',
    padding: '12px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  button: {
    padding: '8px 24px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  confirmButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  cancelButton: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text)',
  },
  info: {
    position: 'absolute' as const,
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--color-surface)',
    padding: '12px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    pointerEvents: 'auto' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headingControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headingInput: {
    width: '60px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
    textAlign: 'center' as const,
  },
  positionInfo: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
  },
};

interface ShipPlacementPreviewProps {
  shipDefinitionId: string;
  onConfirm: (position: Point, heading: number) => void;
  onCancel: () => void;
  initialPosition?: Point;
  initialHeading?: number;
}

export const ShipPlacementPreview: React.FC<ShipPlacementPreviewProps> = ({
  shipDefinitionId,
  onConfirm,
  onCancel,
  initialPosition,
  initialHeading = 0,
}) => {
  const [position, setPosition] = useState<Point>(
    initialPosition ?? { x: 0, y: 0 }
  );
  const [heading, setHeading] = useState(initialHeading);

  // 处理鼠标移动更新位置
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 这里应该转换为地图坐标
      // 暂时使用屏幕坐标
      setPosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 处理滚轮调整朝向
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setHeading(prev => ((prev + delta + 360) % 360));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // 处理确认
  const handleConfirm = useCallback(() => {
    onConfirm(position, heading);
  }, [position, heading, onConfirm]);

  // 处理取消
  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  // 处理朝向输入
  const handleHeadingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < 360) {
      setHeading(value);
    }
  }, []);

  return (
    <div style={styles.overlay}>
      {/* 信息栏 */}
      <div style={styles.info}>
        <div style={styles.headingControl}>
          <span>朝向:</span>
          <input
            type="number"
            min={0}
            max={359}
            value={heading}
            onChange={handleHeadingChange}
            style={styles.headingInput}
          />
          <span>°</span>
        </div>
        <div style={styles.positionInfo}>
          位置: ({Math.round(position.x)}, {Math.round(position.y)})
        </div>
      </div>

      {/* 舰船预览 - 这里应该渲染实际的舰船预览 */}
      {/* 暂时使用占位符 */}
      <div
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: `translate(-50%, -50%) rotate(${heading}deg)`,
          width: '60px',
          height: '80px',
          backgroundColor: 'rgba(100, 200, 255, 0.3)',
          border: '2px solid rgba(100, 200, 255, 0.8)',
          borderRadius: '4px',
          pointerEvents: 'none',
        }}
      />

      {/* 控制按钮 */}
      <div style={styles.controls}>
        <button
          style={{ ...styles.button, ...styles.cancelButton }}
          onClick={handleCancel}
        >
          取消
        </button>
        <button
          style={{ ...styles.button, ...styles.confirmButton }}
          onClick={handleConfirm}
        >
          确认部署
        </button>
      </div>
    </div>
  );
};

export default ShipPlacementPreview;