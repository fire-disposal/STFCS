/**
 * 增强版敌方单位控制组件
 *
 * 提供完整的敌方单位控制界面：
 * - 单位列表
 * - 快捷操作
 * - 批量控制
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EnemyUnit } from './DMManager';
import type { FactionId } from '@vt/shared/types';
import {
  Ship,
  Sword,
  Shield,
  Move,
  Target,
  Trash2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  CheckCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';

// 样式
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    cursor: 'pointer',
  },
  title: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'rgba(239, 68, 68, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  count: {
    fontSize: '11px',
    padding: '2px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: '10px',
    color: 'rgba(239, 68, 68, 1)',
  },
  unitList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
    padding: '4px',
  },
  unitCard: {
    padding: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  unitCardSelected: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  unitHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  unitName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  unitType: {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase' as const,
  },
  unitStats: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statBar: {
    flex: 1,
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  unitActions: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionButtonDanger: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'rgba(239, 68, 68, 1)',
  },
  empty: {
    padding: '20px',
    textAlign: 'center' as const,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '12px',
  },
  batchActions: {
    display: 'flex',
    gap: '6px',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '6px',
    marginTop: '8px',
  },
  batchButton: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
};

// 阵营颜色
const factionColors: Record<string, string> = {
  hegemony: '#4a90d9',
  sindrian: '#d4af37',
  persean: '#2ecc71',
  tri_tachyon: '#9b59b6',
  pirate: '#e74c3c',
  independent: '#95a5a6',
};

interface EnemyUnitControlProps {
  units: EnemyUnit[];
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string | null) => void;
  onMoveUnit: (unitId: string) => void;
  onAttackWithUnit: (unitId: string) => void;
  onDeleteUnit: (unitId: string) => void;
  onBatchAction?: (action: 'move' | 'attack' | 'delete', unitIds: string[]) => void;
  disabled?: boolean;
}

export const EnemyUnitControl: React.FC<EnemyUnitControlProps> = ({
  units,
  selectedUnitId,
  onSelectUnit,
  onMoveUnit,
  onAttackWithUnit,
  onDeleteUnit,
  onBatchAction,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());

  // 切换展开状态
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // 切换单位选择
  const toggleUnitSelection = useCallback((unitId: string, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      setSelectedUnits(prev => {
        const newSet = new Set(prev);
        if (newSet.has(unitId)) {
          newSet.delete(unitId);
        } else {
          newSet.add(unitId);
        }
        return newSet;
      });
    } else {
      onSelectUnit(selectedUnitId === unitId ? null : unitId);
      setSelectedUnits(new Set());
    }
  }, [selectedUnitId, onSelectUnit]);

  // 处理批量操作
  const handleBatchAction = useCallback((action: 'move' | 'attack' | 'delete') => {
    if (selectedUnits.size === 0) return;
    onBatchAction?.(action, [...selectedUnits]);
    setSelectedUnits(new Set());
  }, [selectedUnits, onBatchAction]);

  // 渲染单位卡片
  const renderUnitCard = (unit: EnemyUnit) => {
    const isSelected = unit.id === selectedUnitId || selectedUnits.has(unit.id);
    const hullPercent = (unit.hull.current / unit.hull.max) * 100;
    const fluxPercent = (unit.flux.current / unit.flux.capacity) * 100;
    const factionColor = factionColors[unit.factionId] || '#95a5a6';

    return (
      <motion.div
        key={unit.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        style={{
          ...styles.unitCard,
          ...(isSelected ? styles.unitCardSelected : {}),
        }}
        onClick={(e) => toggleUnitSelection(unit.id, e.ctrlKey || e.metaKey)}
      >
        {/* 单位头部 */}
        <div style={styles.unitHeader}>
          <span style={styles.unitName}>
            <Ship size={14} style={{ color: factionColor }} />
            {unit.name}
          </span>
          <span style={styles.unitType}>{unit.type}</span>
        </div>

        {/* 单位状态 */}
        <div style={styles.unitStats}>
          <div style={styles.statItem}>
            <Shield size={12} />
            <div style={styles.statBar}>
              <div
                style={{
                  ...styles.statBarFill,
                  width: `${hullPercent}%`,
                  backgroundColor: hullPercent > 50 ? '#22c55e' : hullPercent > 25 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
          <div style={styles.statItem}>
            <Zap size={12} />
            <div style={styles.statBar}>
              <div
                style={{
                  ...styles.statBarFill,
                  width: `${fluxPercent}%`,
                  backgroundColor: '#4a9eff',
                }}
              />
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={styles.unitActions}>
          <button
            style={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUnit(unit.id);
            }}
            disabled={disabled}
          >
            <Move size={12} />
            移动
          </button>
          <button
            style={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              onAttackWithUnit(unit.id);
            }}
            disabled={disabled}
          >
            <Sword size={12} />
            攻击
          </button>
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonDanger }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteUnit(unit.id);
            }}
            disabled={disabled}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </motion.div>
    );
  };

  // 渲染批量操作
  const renderBatchActions = () => {
    if (selectedUnits.size === 0) return null;

    return (
      <div style={styles.batchActions}>
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
          已选择 {selectedUnits.size} 个单位
        </span>
        <button
          style={styles.batchButton}
          onClick={() => handleBatchAction('move')}
          disabled={disabled}
        >
          <Move size={12} />
          批量移动
        </button>
        <button
          style={styles.batchButton}
          onClick={() => handleBatchAction('attack')}
          disabled={disabled}
        >
          <Sword size={12} />
          批量攻击
        </button>
        <button
          style={{ ...styles.batchButton, ...styles.actionButtonDanger }}
          onClick={() => handleBatchAction('delete')}
          disabled={disabled}
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* 标题栏 */}
      <div style={styles.header} onClick={toggleExpanded}>
        <span style={styles.title}>
          <Target size={14} />
          敌方单位
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={styles.count}>{units.length}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* 单位列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {units.length === 0 ? (
              <div style={styles.empty}>
                暂无敌方单位
              </div>
            ) : (
              <div style={styles.unitList}>
                {units.map(renderUnitCard)}
              </div>
            )}
            {renderBatchActions()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnemyUnitControl;