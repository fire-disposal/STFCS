/**
 * 增强版回合指示器组件
 *
 * 显示完整的回合信息：
 * - 当前回合数
 * - 当前阶段
 * - 当前行动阵营
 * - 舰船行动状态
 * - 阶段进度
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '@/store';
import type { FactionId } from '@vt/contracts/types';
import type { TurnPhase, ShipActionState } from '@vt/contracts/protocol';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Sword,
  Shield,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  SkipForward,
} from 'lucide-react';

// 样式
const styles = {
  container: {
    position: 'fixed' as const,
    top: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    zIndex: 100,
    pointerEvents: 'none' as const,
  },
  mainPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: 'rgba(15, 18, 25, 0.9)',
    borderRadius: '24px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'auto' as const,
  },
  roundInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderRadius: '12px',
  },
  roundLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase' as const,
  },
  roundNumber: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'rgba(74, 158, 255, 1)',
  },
  phaseIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  phaseDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  phaseDotActive: {
    backgroundColor: 'rgba(74, 158, 255, 1)',
    boxShadow: '0 0 8px rgba(74, 158, 255, 0.5)',
  },
  phaseDotComplete: {
    backgroundColor: 'rgba(34, 197, 94, 1)',
  },
  phaseDotPending: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
  },
  phaseLabel: {
    fontSize: '12px',
    fontWeight: 'medium',
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    color: 'rgba(74, 158, 255, 1)',
  },
  factionIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'medium',
  },
  factionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  shipList: {
    display: 'flex',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
  },
  shipItem: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '2px solid transparent',
  },
  shipItemActive: {
    borderColor: 'rgba(74, 158, 255, 1)',
    boxShadow: '0 0 8px rgba(74, 158, 255, 0.3)',
  },
  shipItemComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
    color: 'rgba(34, 197, 94, 1)',
  },
  shipItemPending: {
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  shipItemOverloaded: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    color: 'rgba(239, 68, 68, 1)',
  },
  tooltip: {
    position: 'absolute' as const,
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(15, 18, 25, 0.95)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.9)',
    whiteSpace: 'nowrap' as const,
    zIndex: 101,
  },
  actionButtons: {
    display: 'flex',
    gap: '4px',
    marginLeft: '8px',
  },
  actionButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    color: 'rgba(74, 158, 255, 1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
};

// 阶段名称
const phaseNames: Record<TurnPhase, string> = {
  player_action: '玩家行动',
  dm_action: 'DM行动',
  resolution: '回合结算',
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

// 阵营名称
const factionNames: Record<string, string> = {
  hegemony: '霸主',
  sindrian: '辛德里亚',
  persean: '珀尔修斯',
  tri_tachyon: '三叠纪',
  pirate: '海盗',
  independent: '独立',
};

interface EnhancedTurnIndicatorProps {
  currentRound: number;
  currentPhase: TurnPhase;
  currentFaction: FactionId | null;
  shipActionStates: Record<string, ShipActionState>;
  isDM: boolean;
  isCurrentPlayerTurn: boolean;
  onEndTurn?: () => void;
  onAdvancePhase?: () => void;
  onSelectShip?: (shipId: string) => void;
  selectedShipId?: string | null;
}

export const EnhancedTurnIndicator: React.FC<EnhancedTurnIndicatorProps> = ({
  currentRound,
  currentPhase,
  currentFaction,
  shipActionStates,
  isDM,
  isCurrentPlayerTurn,
  onEndTurn,
  onAdvancePhase,
  onSelectShip,
  selectedShipId,
}) => {
  const [hoveredShip, setHoveredShip] = useState<string | null>(null);

  // 计算舰船状态
  const shipStates = useMemo(() => {
    return Object.entries(shipActionStates).map(([shipId, state]) => ({
      shipId,
      state,
      isComplete: state.hasMoved && state.hasFired,
      isOverloaded: state.isOverloaded,
      isVenting: state.hasVented,
    }));
  }, [shipActionStates]);

  // 计算阶段进度
  const phaseProgress = useMemo(() => {
    const phases: TurnPhase[] = ['player_action', 'dm_action', 'resolution'];
    const currentIndex = phases.indexOf(currentPhase);
    return {
      current: currentIndex + 1,
      total: phases.length,
      percent: ((currentIndex + 1) / phases.length) * 100,
    };
  }, [currentPhase]);

  // 渲染回合信息
  const renderRoundInfo = () => (
    <div style={styles.roundInfo}>
      <span style={styles.roundLabel}>回合</span>
      <span style={styles.roundNumber}>{currentRound}</span>
    </div>
  );

  // 渲染阶段指示器
  const renderPhaseIndicator = () => (
    <div style={styles.phaseIndicator}>
      {(['player_action', 'dm_action', 'resolution'] as TurnPhase[]).map((phase, index) => {
        const isActive = phase === currentPhase;
        const isComplete = index < phaseProgress.current - 1;

        return (
          <React.Fragment key={phase}>
            <div
              style={{
                ...styles.phaseDot,
                ...(isActive ? styles.phaseDotActive : {}),
                ...(isComplete ? styles.phaseDotComplete : {}),
                ...(!isActive && !isComplete ? styles.phaseDotPending : {}),
              }}
              title={phaseNames[phase]}
            />
            {index < 2 && (
              <div style={{
                width: '20px',
                height: '2px',
                backgroundColor: isComplete ? 'rgba(34, 197, 94, 1)' : 'rgba(100, 116, 139, 0.3)',
              }} />
            )}
          </React.Fragment>
        );
      })}
      <span style={styles.phaseLabel}>
        {phaseNames[currentPhase]}
      </span>
    </div>
  );

  // 渲染阵营指示器
  const renderFactionIndicator = () => {
    if (!currentFaction) return null;

    const color = factionColors[currentFaction] || '#95a5a6';
    const name = factionNames[currentFaction] || currentFaction;

    return (
      <div style={{
        ...styles.factionIndicator,
        backgroundColor: `${color}20`,
        color,
      }}>
        <div style={{ ...styles.factionDot, backgroundColor: color }} />
        {name}
      </div>
    );
  };

  // 渲染舰船列表
  const renderShipList = () => {
    if (shipStates.length === 0) return null;

    return (
      <div style={styles.shipList}>
        {shipStates.map(({ shipId, isComplete, isOverloaded, isVenting }) => (
          <div
            key={shipId}
            style={{
              ...styles.shipItem,
              ...(selectedShipId === shipId ? styles.shipItemActive : {}),
              ...(isOverloaded ? styles.shipItemOverloaded : {}),
              ...(isComplete && !isOverloaded ? styles.shipItemComplete : {}),
              ...(!isComplete && !isOverloaded ? styles.shipItemPending : {}),
            }}
            onClick={() => onSelectShip?.(shipId)}
            onMouseEnter={() => setHoveredShip(shipId)}
            onMouseLeave={() => setHoveredShip(null)}
          >
            {isOverloaded ? (
              <AlertTriangle size={12} />
            ) : isComplete ? (
              <CheckCircle size={12} />
            ) : (
              shipId.slice(0, 2).toUpperCase()
            )}

            {/* 悬浮提示 */}
            {hoveredShip === shipId && (
              <div style={styles.tooltip}>
                <div>{shipId}</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                  {isOverloaded ? '过载中' : isComplete ? '已完成' : '待行动'}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    if (!isCurrentPlayerTurn && !isDM) return null;

    return (
      <div style={styles.actionButtons}>
        {isCurrentPlayerTurn && (
          <button
            style={styles.actionButton}
            onClick={onEndTurn}
            title="结束回合"
          >
            <CheckCircle size={14} />
          </button>
        )}
        {isDM && (
          <button
            style={styles.actionButton}
            onClick={onAdvancePhase}
            title="推进阶段"
          >
            <SkipForward size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={styles.mainPanel}
      >
        {renderRoundInfo()}
        {renderPhaseIndicator()}
        {renderFactionIndicator()}
        {renderShipList()}
        {renderActionButtons()}
      </motion.div>
    </div>
  );
};

export default EnhancedTurnIndicator;