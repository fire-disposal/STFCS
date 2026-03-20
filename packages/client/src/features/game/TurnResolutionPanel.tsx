/**
 * 回合结算面板组件
 *
 * 显示回合结算信息：
 * - 辐能消散
 * - 过载解除
 * - 排散完成
 * - 其他事件
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  X,
} from 'lucide-react';
import type { TurnResolutionResult, TurnEvent } from './TurnPhaseManager';

// 样式
const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: 'rgba(15, 18, 25, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    padding: '24px',
    minWidth: '400px',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'rgba(74, 158, 255, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  roundNumber: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  shipName: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  value: {
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  fluxChange: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  fluxPrevious: {
    color: 'rgba(255, 255, 255, 0.5)',
    textDecoration: 'line-through',
  },
  fluxNew: {
    color: 'rgba(74, 158, 255, 1)',
    fontWeight: 'bold',
  },
  empty: {
    padding: '16px',
    textAlign: 'center' as const,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '13px',
  },
  summary: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.2)',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '12px',
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  summaryValue: {
    color: 'rgba(74, 158, 255, 1)',
    fontWeight: 'bold',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '20px',
    gap: '12px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '6px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    fontSize: '13px',
    fontWeight: 'medium',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
  },
};

interface TurnResolutionPanelProps {
  result: TurnResolutionResult | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export const TurnResolutionPanel: React.FC<TurnResolutionPanelProps> = ({
  result,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !result) return null;

  // 计算统计数据
  const stats = useMemo(() => {
    const totalFluxDissipated = result.fluxDissipation.reduce(
      (sum, f) => sum + (f.previousFlux - f.newFlux),
      0
    );

    return {
      totalFluxDissipated,
      shipsProcessed: result.fluxDissipation.length,
      overloadsCleared: result.overloadResets.length,
      ventsCompleted: result.ventCompletions.length,
      eventsCount: result.events?.length || 0,
    };
  }, [result]);

  // 渲染辐能消散列表
  const renderFluxDissipation = () => {
    if (result.fluxDissipation.length === 0) {
      return <div style={styles.empty}>没有辐能消散</div>;
    }

    return (
      <div style={styles.list}>
        {result.fluxDissipation.map((item, index) => (
          <motion.div
            key={item.shipId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={styles.listItem}
          >
            <span style={styles.shipName}>{item.shipId}</span>
            <div style={styles.fluxChange}>
              <span style={styles.fluxPrevious}>{item.previousFlux}</span>
              <ArrowRight size={12} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
              <span style={styles.fluxNew}>{item.newFlux}</span>
              <Zap size={12} style={{ color: 'rgba(74, 158, 255, 1)' }} />
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  // 渲染过载解除列表
  const renderOverloadResets = () => {
    if (result.overloadResets.length === 0) {
      return <div style={styles.empty}>没有过载解除</div>;
    }

    return (
      <div style={styles.list}>
        {result.overloadResets.map((shipId, index) => (
          <motion.div
            key={shipId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={styles.listItem}
          >
            <span style={styles.shipName}>{shipId}</span>
            <span style={{ ...styles.value, color: 'rgba(34, 197, 94, 1)' }}>
              <CheckCircle size={14} />
              过载解除
            </span>
          </motion.div>
        ))}
      </div>
    );
  };

  // 渲染排散完成列表
  const renderVentCompletions = () => {
    if (result.ventCompletions.length === 0) {
      return <div style={styles.empty}>没有排散完成</div>;
    }

    return (
      <div style={styles.list}>
        {result.ventCompletions.map((shipId, index) => (
          <motion.div
            key={shipId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={styles.listItem}
          >
            <span style={styles.shipName}>{shipId}</span>
            <span style={{ ...styles.value, color: 'rgba(234, 179, 8, 1)' }}>
              <Zap size={14} />
              排散完成
            </span>
          </motion.div>
        ))}
      </div>
    );
  };

  // 渲染事件列表
  const renderEvents = () => {
    if (!result.events || result.events.length === 0) {
      return null;
    }

    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <AlertTriangle size={14} />
          其他事件
        </div>
        <div style={styles.list}>
          {result.events.map((event, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              style={styles.listItem}
            >
              <span style={styles.shipName}>{event.shipId}</span>
              <span style={styles.value}>
                {event.type === 'shield_maintenance' && <Shield size={14} />}
                {event.type === 'cooldown' && <Zap size={14} />}
                {event.type}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染统计摘要
  const renderSummary = () => (
    <div style={styles.summary}>
      <div style={styles.summaryRow}>
        <span style={styles.summaryLabel}>处理舰船</span>
        <span style={styles.summaryValue}>{stats.shipsProcessed}</span>
      </div>
      <div style={styles.summaryRow}>
        <span style={styles.summaryLabel}>消散辐能</span>
        <span style={styles.summaryValue}>{stats.totalFluxDissipated}</span>
      </div>
      <div style={styles.summaryRow}>
        <span style={styles.summaryLabel}>过载解除</span>
        <span style={styles.summaryValue}>{stats.overloadsCleared}</span>
      </div>
      <div style={styles.summaryRow}>
        <span style={styles.summaryLabel}>排散完成</span>
        <span style={styles.summaryValue}>{stats.ventsCompleted}</span>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.overlay}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          style={styles.container}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题 */}
          <div style={styles.header}>
            <div>
              <div style={styles.title}>
                <Zap size={20} />
                回合结算
              </div>
              <div style={styles.roundNumber}>
                第 {result.roundNumber} 回合
              </div>
            </div>
            <button style={styles.closeButton} onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* 辐能消散 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Zap size={14} />
              辐能消散
            </div>
            {renderFluxDissipation()}
          </div>

          {/* 过载解除 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <AlertTriangle size={14} />
              过载解除
            </div>
            {renderOverloadResets()}
          </div>

          {/* 排散完成 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Zap size={14} />
              排散完成
            </div>
            {renderVentCompletions()}
          </div>

          {/* 其他事件 */}
          {renderEvents()}

          {/* 统计摘要 */}
          {renderSummary()}

          {/* 按钮 */}
          <div style={styles.buttons}>
            <button
              style={{ ...styles.button, ...styles.buttonPrimary }}
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
            >
              确认
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TurnResolutionPanel;