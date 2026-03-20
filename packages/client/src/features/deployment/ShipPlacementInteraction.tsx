/**
 * 舰船放置交互组件
 *
 * 处理舰船部署的交互：
 * - 选择舰船
 * - 放置位置
 * - 调整朝向
 * - 确认放置
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Point } from '@vt/shared/core-types';
import type { FactionId } from '@vt/shared/types';
import type { ShipDefinition } from '@vt/shared/config';
import { DeploymentManager, DeployedShip, DeploymentZone } from './DeploymentManager';
import {
  Ship,
  RotateCw,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// 样式
const styles = {
  container: {
    position: 'fixed' as const,
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    zIndex: 100,
  },
  panel: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 20px',
    backgroundColor: 'rgba(15, 18, 25, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  shipInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  shipIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '2px solid rgba(74, 158, 255, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  shipName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'white',
  },
  shipCost: {
    fontSize: '12px',
    color: 'rgba(74, 158, 255, 1)',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
  },
  controlLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase' as const,
  },
  buttonRow: {
    display: 'flex',
    gap: '4px',
  },
  button: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  buttonActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: 'rgba(74, 158, 255, 0.6)',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    color: 'rgba(34, 197, 94, 1)',
  },
  buttonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    color: 'rgba(239, 68, 68, 1)',
  },
  headingDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
  },
  headingValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'rgba(74, 158, 255, 1)',
    minWidth: '50px',
    textAlign: 'center' as const,
  },
  positionDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  helpText: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center' as const,
    padding: '8px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
  },
  error: {
    padding: '8px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: 'rgba(239, 68, 68, 1)',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};

interface ShipPlacementInteractionProps {
  deploymentManager: DeploymentManager;
  selectedShip: ShipDefinition | null;
  factionId: FactionId | null;
  zone: DeploymentZone | null;
  onPlace: (ship: DeployedShip) => void;
  onCancel: () => void;
  onError?: (error: string) => void;
}

export const ShipPlacementInteraction: React.FC<ShipPlacementInteractionProps> = ({
  deploymentManager,
  selectedShip,
  factionId,
  zone,
  onPlace,
  onCancel,
  onError,
}) => {
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [heading, setHeading] = useState<number>(0);
  const [isValidPosition, setIsValidPosition] = useState<boolean>(true);
  const [isPlacing, setIsPlacing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 重置状态
  useEffect(() => {
    if (selectedShip) {
      setPosition({ x: 0, y: 0 });
      setHeading(0);
      setError(null);
    }
  }, [selectedShip]);

  // 验证位置
  const validatePosition = useCallback((pos: Point): boolean => {
    if (!zone) return true;
    return deploymentManager.isPositionInZone(pos, zone);
  }, [zone, deploymentManager]);

  // 更新位置
  const handlePositionChange = useCallback((newPosition: Point) => {
    setPosition(newPosition);
    setIsValidPosition(validatePosition(newPosition));
  }, [validatePosition]);

  // 调整朝向
  const handleHeadingChange = useCallback((delta: number) => {
    setHeading(prev => {
      const newHeading = (prev + delta + 360) % 360;
      return newHeading;
    });
  }, []);

  // 确认放置
  const handleConfirm = useCallback(async () => {
    if (!selectedShip || !factionId) {
      setError('未选择舰船或阵营');
      return;
    }

    if (!isValidPosition) {
      setError('位置无效，请将舰船放置在部署区域内');
      return;
    }

    setIsPlacing(true);
    setError(null);

    try {
      const deployedShip = await deploymentManager.deployShip({
        shipDefinitionId: selectedShip.id,
        position,
        heading,
      });

      onPlace(deployedShip);
    } catch (err: any) {
      setError(err.message || '部署失败');
      onError?.(err.message);
    } finally {
      setIsPlacing(false);
    }
  }, [selectedShip, factionId, isValidPosition, position, heading, deploymentManager, onPlace, onError]);

  // 取消放置
  const handleCancel = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setHeading(0);
    setError(null);
    onCancel();
  }, [onCancel]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedShip) return;

      switch (e.key.toLowerCase()) {
        case 'q':
          handleHeadingChange(-15);
          break;
        case 'e':
          handleHeadingChange(15);
          break;
        case 'enter':
          e.preventDefault();
          handleConfirm();
          break;
        case 'escape':
          e.preventDefault();
          handleCancel();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShip, handleHeadingChange, handleConfirm, handleCancel]);

  if (!selectedShip) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      style={styles.container}
    >
      <div style={styles.panel}>
        {/* 舰船信息 */}
        <div style={styles.shipInfo}>
          <div style={styles.shipIcon}>
            <Ship size={24} />
          </div>
          <div style={styles.shipDetails}>
            <span style={styles.shipName}>{selectedShip.nameLocalized?.zh || selectedShip.name}</span>
            <span style={styles.shipCost}>
              {selectedShip.cost || 0} DP
            </span>
          </div>
        </div>

        {/* 位置显示 */}
        <div style={styles.positionDisplay}>
          <span>X: {position.x.toFixed(0)}</span>
          <span>Y: {position.y.toFixed(0)}</span>
          {!isValidPosition && (
            <XCircle size={14} style={{ color: '#ef4444' }} />
          )}
        </div>

        {/* 朝向控制 */}
        <div style={styles.controlGroup}>
          <span style={styles.controlLabel}>朝向</span>
          <div style={styles.headingDisplay}>
            <button
              style={styles.button}
              onClick={() => handleHeadingChange(-15)}
              title="左转 15° (Q)"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={styles.headingValue}>{heading}°</span>
            <button
              style={styles.button}
              onClick={() => handleHeadingChange(15)}
              title="右转 15° (E)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={styles.controls}>
          <button
            style={{ ...styles.button, ...styles.buttonDanger }}
            onClick={handleCancel}
            title="取消 (Esc)"
          >
            <XCircle size={16} />
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(!isValidPosition || isPlacing ? { opacity: 0.5 } : {}),
            }}
            onClick={handleConfirm}
            disabled={!isValidPosition || isPlacing}
            title="确认放置 (Enter)"
          >
            <CheckCircle size={16} />
          </button>
        </div>
      </div>

      {/* 帮助文本 */}
      <div style={styles.helpText}>
        点击地图放置舰船 | Q/E 调整朝向 | Enter 确认 | Esc 取消
      </div>

      {/* 错误信息 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={styles.error}
          >
            <XCircle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ShipPlacementInteraction;