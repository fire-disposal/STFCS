/**
 * 回合状态指示器
 *
 * 显示当前游戏状态：
 * - 当前阶段（部署 / 玩家回合 / DM回合 / 结算）
 * - 回合数
 * - 活跃阵营
 * - 阶段进度指示
 */

import React, { useMemo } from 'react';

// 样式定义
const styles = {
  container: {
    backgroundColor: 'rgba(6, 16, 26, 0.84)',
    borderRadius: '0',
    padding: '8px 10px',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.26)',
    border: '1px solid rgba(74, 158, 255, 0.22)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(10px)',
  },
  phaseIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  phaseDot: {
    width: '12px',
    height: '12px',
    borderRadius: '0',
    transition: 'all 0.3s ease',
  },
  phaseDotActive: {
    boxShadow: '0 0 8px currentColor',
  },
  phaseLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    letterSpacing: '0.04em',
  },
  turnCounter: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 8px',
    backgroundColor: 'rgba(26, 45, 66, 0.8)',
    borderRadius: '0',
    border: '1px solid rgba(74, 158, 255, 0.16)',
  },
  turnNumber: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#43c1ff',
  },
  factionBadge: {
    padding: '4px 8px',
    borderRadius: '0',
    fontSize: '10px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#1a2d42',
    borderRadius: '0',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    borderRadius: '0',
    transition: 'width 0.3s ease',
  },
  phaseList: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
  },
  phaseItem: {
    padding: '3px 7px',
    borderRadius: '0',
    fontSize: '9px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  compactWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  compactProgress: {
    width: '100%',
    height: '2px',
    backgroundColor: 'rgba(26, 45, 66, 0.72)',
    borderRadius: '0',
    overflow: 'hidden',
  },
  compactAction: {
    padding: '4px 8px',
    borderRadius: '0',
    border: '1px solid rgba(255, 111, 143, 0.5)',
    backgroundColor: 'rgba(90, 42, 58, 0.82)',
    color: '#ffb3c0',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
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
        <div style={styles.compactWrap}>
          <div style={styles.phaseIndicator}>
            <div style={{
              ...styles.phaseDot,
              width: '10px',
              height: '10px',
              backgroundColor: currentPhaseConfig.color,
              ...styles.phaseDotActive,
            }} />
            <span style={styles.phaseLabel}>
              {currentPhaseConfig.icon} {currentPhaseConfig.name}
            </span>
          </div>
          <div style={styles.compactProgress}>
            <div style={{
              ...styles.progressFill,
              width: `${progressPercent}%`,
              backgroundColor: currentPhaseConfig.color,
            }} />
          </div>
        </div>

        <div style={styles.turnCounter}>
          <span style={{ color: '#8ba4c7', fontSize: '11px' }}>回合</span>
          <span style={styles.turnNumber}>{turnCount}</span>
        </div>

        <div style={{
          ...styles.factionBadge,
          backgroundColor: factionStyle.bg,
          color: factionStyle.text,
        }}>
          {factionStyle.icon} {activeFaction === 'player' ? '玩家' : 'DM'}
        </div>

        {playerRole === 'dm' && onNextPhase && (
          <button style={styles.compactAction} onClick={onNextPhase}>
            下一阶段
          </button>
        )}
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