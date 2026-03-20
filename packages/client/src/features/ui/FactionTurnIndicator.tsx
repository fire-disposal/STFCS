/**
 * 阵营回合指示器组件
 *
 * 在顶栏显示当前阵营回合信息：
 * - 当前回合数
 * - 当前行动阵营（带颜色图标）
 * - 当前阵营已结束玩家数/总玩家数
 * - 结束回合按钮（仅当前阵营玩家可见）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Swords, Flag } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectCurrentFaction,
  selectRoundNumber,
  selectPlayerEndStatus,
  selectDebounceStartTime,
  selectFactionTurnPhase,
  selectEndedPlayersCount,
  selectTotalPlayersCount,
  updatePlayerEndStatus,
} from '@/store/slices/factionTurnSlice';
import { useRoomOperations } from '@/room';
import type { RoomClient, OperationMap } from '@/room';
import { FACTIONS, getFactionColor } from '@vt/shared';
import type { FactionId } from '@vt/shared';

interface FactionTurnIndicatorProps {
  className?: string;
  client: RoomClient<OperationMap> | null;
}

export const FactionTurnIndicator: React.FC<FactionTurnIndicatorProps> = ({
  className = '',
  client,
}) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();

  // 获取操作调用器
  const ops = useRoomOperations(client);

  // 选择器
  const currentFaction = useAppSelector(selectCurrentFaction);
  const roundNumber = useAppSelector(selectRoundNumber);
  const playerEndStatus = useAppSelector(selectPlayerEndStatus);
  const debounceStartTime = useAppSelector(selectDebounceStartTime);
  const phase = useAppSelector(selectFactionTurnPhase);
  const selectedFaction = useAppSelector((state) => state.faction.selectedFaction);
  const currentPlayerId = useAppSelector((state) => state.ui.connection.playerId);
  const endedCount = useAppSelector(selectEndedPlayersCount);
  const totalCount = useAppSelector(selectTotalPlayersCount);

  // 当前玩家是否属于当前行动阵营
  const isCurrentPlayerTurn = selectedFaction === currentFaction;

  // 获取当前阵营的玩家列表
  const currentFactionPlayers = playerEndStatus[currentFaction] || [];

  // 当前玩家是否已结束回合
  const currentPlayer = currentFactionPlayers.find((p) => p.playerId === currentPlayerId);
  const hasEndedTurn = currentPlayer?.hasEndedTurn ?? false;

  // 是否在防抖中
  const isDebouncing = debounceStartTime !== undefined || phase === 'transition';

  // 处理结束回合
  const handleEndTurn = async () => {
    if (!isCurrentPlayerTurn || hasEndedTurn || !currentPlayerId || !selectedFaction) return;

    // 乐观更新本地状态
    dispatch(
      updatePlayerEndStatus({
        playerId: currentPlayerId,
        faction: selectedFaction,
        hasEndedTurn: true,
        endedAt: Date.now(),
      })
    );

    // 调用服务器操作
    try {
      await ops?.endTurn();
    } catch (error) {
      console.error('Failed to end turn:', error);
      // 回滚乐观更新
      dispatch(
        updatePlayerEndStatus({
          playerId: currentPlayerId,
          faction: selectedFaction,
          hasEndedTurn: false,
          endedAt: undefined,
        })
      );
    }
  };

  // 处理取消结束
  const handleCancelEndTurn = async () => {
    if (!hasEndedTurn || !currentPlayerId || !selectedFaction) return;

    // 乐观更新本地状态
    dispatch(
      updatePlayerEndStatus({
        playerId: currentPlayerId,
        faction: selectedFaction,
        hasEndedTurn: false,
        endedAt: undefined,
      })
    );

    // 调用服务器操作
    try {
      await ops?.cancelEndTurn();
    } catch (error) {
      console.error('Failed to cancel end turn:', error);
      // 回滚乐观更新
      dispatch(
        updatePlayerEndStatus({
          playerId: currentPlayerId,
          faction: selectedFaction,
          hasEndedTurn: true,
          endedAt: Date.now(),
        })
      );
    }
  };

  // 获取阵营显示名称
  const getFactionDisplayName = (factionId: FactionId): string => {
    const faction = FACTIONS[factionId];
    if (!faction) return factionId;
    return faction.nameLocalized[(i18n.language as 'zh' | 'en') || 'zh'] || faction.name;
  };

  const factionColor = getFactionColor(currentFaction);

  // 获取阵营图标
  const getFactionIcon = (factionId: FactionId): React.ReactNode => {
    switch (factionId) {
      case 'federation':
        return <Shield size={16} />;
      case 'empire':
        return <Swords size={16} />;
      default:
        return <Flag size={16} />;
    }
  };

  return (
    <div className={`faction-turn-indicator ${className}`}>
      {/* 回合数 */}
      <div className="faction-turn__round">
        <span className="faction-turn__round-label">{t('turn.round')}</span>
        <span className="faction-turn__round-number">{roundNumber}</span>
      </div>

      {/* 分隔符 */}
      <div className="faction-turn__divider" />

      {/* 当前阵营 */}
      <div className="faction-turn__faction" style={{ color: factionColor }}>
        <span className="faction-turn__faction-icon">{getFactionIcon(currentFaction)}</span>
        <span className="faction-turn__faction-name">{getFactionDisplayName(currentFaction)}</span>
      </div>

      {/* 分隔符 */}
      <div className="faction-turn__divider" />

      {/* 结束状态 */}
      <div className="faction-turn__status">
        <span className="faction-turn__status-count">
          {endedCount}/{totalCount}
        </span>
        <span className="faction-turn__status-label">{t('factionTurn.playersEnded')}</span>
      </div>

      {/* 防抖提示 */}
      {isDebouncing && (
        <div className="faction-turn__debouncing">
          <span className="faction-turn__debouncing-text">
            {t('factionTurn.transitioning')}
          </span>
        </div>
      )}

      {/* 结束回合按钮 */}
      {isCurrentPlayerTurn && !isDebouncing && (
        <div className="faction-turn__actions">
          {!hasEndedTurn ? (
            <button
              type="button"
              className="faction-turn__end-btn"
              onClick={handleEndTurn}
              disabled={!isCurrentPlayerTurn || hasEndedTurn}
            >
              {t('factionTurn.endTurn')}
            </button>
          ) : (
            <button
              type="button"
              className="faction-turn__cancel-btn"
              onClick={handleCancelEndTurn}
            >
              {t('factionTurn.cancelEnd')}
            </button>
          )}
        </div>
      )}

      {/* 非当前阵营提示 */}
      {!isCurrentPlayerTurn && selectedFaction && (
        <div className="faction-turn__waiting">
          <span className="faction-turn__waiting-text">
            {t('factionTurn.waitingFor', {
              faction: getFactionDisplayName(currentFaction),
            })}
          </span>
        </div>
      )}

      <style>{`
        .faction-turn-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          background: rgba(20, 20, 40, 0.8);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
        }

        .faction-turn__round {
          display: flex;
          align-items: baseline;
          gap: var(--space-1);
        }

        .faction-turn__round-label {
          color: var(--text-tertiary);
          font-size: var(--text-xs);
        }

        .faction-turn__round-number {
          color: var(--text-primary);
          font-weight: var(--font-bold);
          font-size: var(--text-base);
        }

        .faction-turn__divider {
          width: 1px;
          height: 20px;
          background: var(--border-color);
        }

        .faction-turn__faction {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: var(--font-semibold);
        }

        .faction-turn__faction-icon {
          font-size: var(--text-base);
        }

        .faction-turn__faction-name {
          font-size: var(--text-sm);
        }

        .faction-turn__status {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .faction-turn__status-count {
          color: var(--text-primary);
          font-weight: var(--font-medium);
          font-family: var(--font-mono);
        }

        .faction-turn__status-label {
          color: var(--text-tertiary);
          font-size: var(--text-xs);
        }

        .faction-turn__debouncing {
          padding: var(--space-1) var(--space-2);
          background: rgba(251, 191, 36, 0.2);
          border-radius: var(--radius-sm);
        }

        .faction-turn__debouncing-text {
          color: #fbbf24;
          font-size: var(--text-xs);
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .faction-turn__actions {
          display: flex;
          align-items: center;
        }

        .faction-turn__end-btn {
          padding: var(--space-2) var(--space-3);
          background: rgba(74, 158, 255, 0.2);
          border: 1px solid rgba(74, 158, 255, 0.5);
          border-radius: var(--radius-sm);
          color: #4a9eff;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .faction-turn__end-btn:hover:not(:disabled) {
          background: rgba(74, 158, 255, 0.3);
          border-color: rgba(74, 158, 255, 0.7);
        }

        .faction-turn__end-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .faction-turn__cancel-btn {
          padding: var(--space-2) var(--space-3);
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.5);
          border-radius: var(--radius-sm);
          color: #ef4444;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .faction-turn__cancel-btn:hover {
          background: rgba(239, 68, 68, 0.3);
          border-color: rgba(239, 68, 68, 0.7);
        }

        .faction-turn__waiting {
          padding: var(--space-1) var(--space-2);
          background: rgba(100, 100, 150, 0.2);
          border-radius: var(--radius-sm);
        }

        .faction-turn__waiting-text {
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }

        /* 响应式 */
        @media (max-width: 768px) {
          .faction-turn-indicator {
            padding: var(--space-1) var(--space-2);
            gap: var(--space-2);
          }

          .faction-turn__status-label,
          .faction-turn__waiting-text {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default FactionTurnIndicator;