/**
 * 回合状态指示器
 *
 * 显示当前游戏状态：
 * - 当前阶段（部署 / 玩家回合 / DM回合 / 结算）
 * - 回合数
 * - 活跃阵营
 * - 阶段进度指示
 *
 * 样式: game-panels.css (turn-indicator 类)
 */

import React, { useMemo } from 'react';
import { MapPin, User, Crown, Zap, FastForward } from 'lucide-react';
import type { PlayerRoleValue, FactionValue } from '@vt/contracts';
import { PlayerRole, Faction } from '@vt/contracts';

const phaseNames: Record<string, string> = {
  DEPLOYMENT: '部署阶段',
  PLAYER_TURN: '玩家回合',
  DM_TURN: 'DM回合',
  END_PHASE: '结算阶段',
};

interface PhaseConfig {
  id: string;
  name: string;
  color: string;
  cssClass: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const phases: PhaseConfig[] = [
  { id: 'DEPLOYMENT', name: '部署', color: '#9b59b6', cssClass: 'turn-phase--deployment', Icon: MapPin },
  { id: 'PLAYER_TURN', name: '玩家', color: '#4a9eff', cssClass: 'turn-phase--player', Icon: User },
  { id: 'DM_TURN', name: 'DM', color: '#ff6f8f', cssClass: 'turn-phase--dm', Icon: Crown },
  { id: 'END_PHASE', name: '结算', color: '#f1c40f', cssClass: 'turn-phase--end', Icon: Zap },
];

interface TurnIndicatorProps {
  currentPhase: string;
  turnCount: number;
  activeFaction: string;
  playerRole: PlayerRoleValue;
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
  const currentPhaseIndex = useMemo(() => {
    return phases.findIndex((p) => p.id === currentPhase);
  }, [currentPhase]);

  const currentConfig = phases[currentPhaseIndex] || phases[0];
  const progressPercent = ((currentPhaseIndex + 1) / phases.length) * 100;
  const isPlayerFaction = activeFaction === Faction.PLAYER;

  if (compact) {
    return (
      <div className="turn-indicator turn-indicator--compact">
        <div className="turn-phase">
          <div
            className="turn-phase__dot turn-phase__dot--active"
            style={{ backgroundColor: currentConfig.color }}
          />
          <span className="turn-phase__label">
            <currentConfig.Icon className="turn-phase__icon" style={{ color: currentConfig.color }} />
            {currentConfig.name}
          </span>
        </div>

        <div className="turn-counter">
          <span className="turn-counter__label">回合</span>
          <span className="turn-counter__number">{turnCount}</span>
        </div>

        <div className={`turn-faction ${isPlayerFaction ? 'turn-faction--player' : 'turn-faction--dm'}`}>
          {isPlayerFaction ? <><User className="turn-faction__icon" /> 玩家</> : <><Crown className="turn-faction__icon" /> DM</>}
        </div>

{playerRole === PlayerRole.DM && onNextPhase && (
          <button data-magnetic className="turn-advance-btn turn-advance-btn--compact" onClick={onNextPhase}>
            下一阶段
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="turn-indicator turn-indicator--full">
      <div className="turn-row">
        <div className="turn-phase">
          <div
            className="turn-phase__dot turn-phase__dot--active"
            style={{ backgroundColor: currentConfig.color }}
          />
          <span className="turn-phase__label">
            <currentConfig.Icon className="turn-phase__icon" style={{ color: currentConfig.color }} />
            {phaseNames[currentPhase] || currentPhase}
          </span>
        </div>

        <div className="turn-counter">
          <span className="turn-counter__label">回合</span>
          <span className="turn-counter__number">{turnCount}</span>
        </div>

        <div className={`turn-faction ${isPlayerFaction ? 'turn-faction--player' : 'turn-faction--dm'}`}>
          {isPlayerFaction ? <><User className="turn-faction__icon" /> 玩家行动</> : <><Crown className="turn-faction__icon" /> DM行动</>}
        </div>
      </div>

      <div className="turn-progress">
        <div
          className="turn-progress__fill"
          style={{ width: `${progressPercent}%`, backgroundColor: currentConfig.color }}
        />
      </div>

      <div className="turn-phase-list">
        {phases.map((phase, index) => {
          const isActive = phase.id === currentPhase;
          const isPast = index < currentPhaseIndex;
          const itemClass = isActive ? 'turn-phase-item--active' : 
            isPast ? 'turn-phase-item--past' : 'turn-phase-item--future';

          return (
            <div
              key={phase.id}
              className={`turn-phase-item ${itemClass} ${phase.cssClass}`}
              style={isActive ? { borderColor: phase.color } : {}}
            >
              <phase.Icon className="turn-phase-item__icon" style={{ color: isActive ? phase.color : undefined }} />
              {phase.name}
            </div>
          );
        })}
      </div>

      {playerRole === PlayerRole.DM && onNextPhase && (
        <button data-magnetic className="turn-advance-btn" onClick={onNextPhase}>
          <FastForward className="turn-advance-btn__icon" />
          强制进入下一阶段
        </button>
      )}
    </div>
  );
};

export default TurnIndicator;