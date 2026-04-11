/**
 * 回合状态指示器
 *
 * 显示当前游戏状态：
 * - 当前阶段（部署/玩家回合/DM回合/结算）
 * - 回合数
 * - 活跃阵营
 * - 阶段进度指示
 */

import React, { useMemo } from 'react';

// 样式定义
const styles = {
  container: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '12px 16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  phaseIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  phaseDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  phaseDotActive: {
    boxShadow: '0 0 8px currentColor',
  },
  phaseLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
  },
  turnCounter: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#1a2d42',
    borderRadius: '4px',
  },
  turnNumber: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#43c1ff',
  },
  factionBadge: {
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#1a2d42',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  phaseList: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
  },
  phaseItem: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
};

// 阶段配置
const phases = [
  { id: 'DEPLOYMENT', name: '部署', color: '#9b59b6', icon: '📍' },
  { id: 'PLAYER_TURN', name: '玩家', color: '#43c1ff', icon: '👤' },
  { id: 'DM_TURN', name: 'DM', color: '#ff6f8f', icon: '👑' },
  { id: 'END_PHASE', name: '结算', color: '#f1c40f', icon: '⚡' },
];

// 阶段名称映射
const phaseNames: Record<string, string> = {
  DEPLOYMENT: '部署阶段',
  PLAYER_TURN: '玩家回合',
  DM_TURN: 'DM回合',
  END_PHASE: '结算阶段',
};

// 阵营颜色
const factionColors = {
  player: { bg: '#1a4a7a', text: '#43c1ff', icon: '👤' },
  dm: { bg: '#5a2a3a', text: '#ff6f8f', icon: '👑' },
};

interface TurnIndicatorProps {
  currentPhase: string;
  turnCount: number;
  activeFaction: string;
  playerRole: 'dm' | 'player';
  onNextPhase?: () => void;
  compact?: boolean;
}

export const TurnIndicator: React.FC<TurnIndicatorProps> = ({
  currentPhase,
  turnCount,
  activeFaction,
  playerRole,
  onNextPhase,
  compact = false,
}) => {
  // 当前阶段索引
  const currentPhaseIndex = useMemo(() => {
    return phases.findIndex((p) => p.id === currentPhase);
  }, [currentPhase]);

  // 当前阶段配置
  const currentPhaseConfig = phases[currentPhaseIndex] || phases[0];

  // 活跃阵营样式
  const factionStyle = factionColors[activeFaction as keyof typeof factionColors] || factionColors.player;

  // 计算进度百分比
  const progressPercent = useMemo(() => {
    return ((currentPhaseIndex + 1) / phases.length) * 100;
  }, [currentPhaseIndex]);

  if (compact) {
    return (
      <div style={styles.container}>
        <div style={styles.phaseIndicator}>
          <div style={{
            ...styles.phaseDot,
            backgroundColor: currentPhaseConfig.color,
            ...styles.phaseDotActive,
          }} />
          <span style={styles.phaseLabel}>
            {currentPhaseConfig.icon} {currentPhaseConfig.name}
          </span>
        </div>
        <div style={styles.turnCounter}>
          <span style={{ color: '#8ba4c7', fontSize: '12px' }}>回合</span>
          <span style={styles.turnNumber}>{turnCount}</span>
        </div>
        <div style={{
          ...styles.factionBadge,
          backgroundColor: factionStyle.bg,
          color: factionStyle.text,
        }}>
          {factionStyle.icon} {activeFaction === 'player' ? '玩家行动' : 'DM行动'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, flexDirection: 'column', alignItems: 'stretch' }}>
      {/* 主信息行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={styles.phaseIndicator}>
          <div style={{
            ...styles.phaseDot,
            backgroundColor: currentPhaseConfig.color,
            ...styles.phaseDotActive,
          }} />
          <span style={styles.phaseLabel}>
            {currentPhaseConfig.icon} {phaseNames[currentPhase] || currentPhase}
          </span>
        </div>

        <div style={styles.turnCounter}>
          <span style={{ color: '#8ba4c7', fontSize: '12px' }}>回合</span>
          <span style={styles.turnNumber}>{turnCount}</span>
        </div>

        <div style={{
          ...styles.factionBadge,
          backgroundColor: factionStyle.bg,
          color: factionStyle.text,
        }}>
          {factionStyle.icon} {activeFaction === 'player' ? '玩家行动' : 'DM行动'}
        </div>
      </div>

      {/* 进度条 */}
      <div style={styles.progressBar}>
        <div style={{
          ...styles.progressFill,
          width: `${progressPercent}%`,
          backgroundColor: currentPhaseConfig.color,
        }} />
      </div>

      {/* 阶段列表 */}
      <div style={styles.phaseList}>
        {phases.map((phase, index) => {
          const isActive = phase.id === currentPhase;
          const isPast = index < currentPhaseIndex;

          return (
            <div
              key={phase.id}
              style={{
                ...styles.phaseItem,
                backgroundColor: isActive ? phase.color :
                  isPast ? '#2b4261' : '#1a2d42',
                color: isActive || isPast ? 'white' : '#8ba4c7',
                border: isActive ? `1px solid ${phase.color}` : '1px solid transparent',
              }}
            >
              {phase.icon} {phase.name}
            </div>
          );
        })}
      </div>

      {/* DM 强制推进按钮 */}
      {playerRole === 'dm' && onNextPhase && (
        <div style={{ marginTop: '12px' }}>
          <button
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ff6f8f',
              backgroundColor: '#5a2a3a',
              color: '#ff6f8f',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={onNextPhase}
          >
            ⏭️ 强制进入下一阶段
          </button>
        </div>
      )}
    </div>
  );
};

export default TurnIndicator;