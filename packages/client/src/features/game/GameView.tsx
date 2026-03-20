/**
 * 游戏主视图
 *
 * 使用新的房间框架：
 * - useRoomState 订阅状态
 * - useRoomOperations 调用操作
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Crown, UserX } from 'lucide-react';

import { TopBarMenu } from '@/components/ui/TopBarMenu';
import GameCanvas from '@/components/map/GameCanvas';
import { LayerControlPanel } from '@/components/map/LayerControlPanel';
import DMControlPanel from '@/features/ui/DMControlPanel';
import { TacticalCommandPanel } from '@/features/ui/TacticalCommandPanel';
import { RightInfoPanel } from '@/features/ui/RightInfoPanel';

import { useAppDispatch, useAppSelector } from '@/store';
import { setSelectedTool } from '@/store/slices/uiSlice';
import { useRoomState, useRoomOperations } from '@/room';
import type { RoomClient } from '@/room';
import type { OperationMap } from '@vt/shared/room';

// ==================== Props ====================

interface GameViewProps {
  client: RoomClient<OperationMap> | null;
  currentPlayerId: string;
  onDisconnect: () => void;
}

// ==================== Component ====================

const GameView: React.FC<GameViewProps> = ({
  client,
  currentPlayerId,
  onDisconnect,
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // UI 状态
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // 房间状态
  const roomState = useRoomState(client);
  const ops = useRoomOperations(client);

  // Redux 状态
  const { selectedTokenId } = useAppSelector((state) => state.selection);
  const { tokens } = useAppSelector((state) => state.map);
  const { selectedTool } = useAppSelector((state) => state.ui);

  // 从房间状态提取数据
  const meta = roomState?.meta;
  const players = roomState?.players || {};
  const game = roomState?.game;
  const ownerId = meta?.ownerId || null;
  const phase = meta?.phase || 'lobby';
  const round = meta?.round || 1;
  const turnPhase = meta?.turnPhase || 'player_action';

  // 当前玩家信息
  const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
  const isOwner = currentPlayerId === ownerId;
  const isDM = currentPlayer?.isDM || false;

  // 缩放控制
  const handleZoomIn = useCallback(() => {
    window.dispatchEvent(new CustomEvent('game-zoom', { detail: { action: 'in' } }));
  }, []);

  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('game-zoom', { detail: { action: 'out' } }));
  }, []);

  const handleResetZoom = useCallback(() => {
    window.dispatchEvent(new CustomEvent('game-zoom', { detail: { action: 'reset' } }));
  }, []);

  // 工具选择
  const handleToolSelect = useCallback((tool: string) => {
    dispatch(setSelectedTool(tool as any));
  }, [dispatch]);

  // 踢出玩家
  const handleKickPlayer = useCallback(async (playerId: string) => {
    if (!isOwner || !ops) return;

    try {
      await ops.kick(playerId);
    } catch (error) {
      console.error('Failed to kick player:', error);
      alert(error instanceof Error ? error.message : '踢出玩家失败');
    }
  }, [isOwner, ops]);

  // 转移房主
  const handleTransferOwner = useCallback(async (newOwnerId: string) => {
    if (!isOwner || !ops) return;

    try {
      await ops.setOwner(newOwnerId);
    } catch (error) {
      console.error('Failed to transfer owner:', error);
      alert(error instanceof Error ? error.message : '转移房主失败');
    }
  }, [isOwner, ops]);

  // 推进回合（DM）
  const handleAdvancePhase = useCallback(async () => {
    if (!isDM || !ops) return;

    try {
      await ops.advancePhase();
    } catch (error) {
      console.error('Failed to advance phase:', error);
      alert(error instanceof Error ? error.message : '推进回合失败');
    }
  }, [isDM, ops]);

  // 离开房间
  const handleLeaveRoom = useCallback(async () => {
    if (!ops) return;

    try {
      await ops.leave();
      onDisconnect();
    } catch (error) {
      console.error('Failed to leave room:', error);
      onDisconnect();
    }
  }, [ops, onDisconnect]);

  // 加载状态
  if (!roomState) {
    return (
      <div className="game-view loading">
        <div className="loading-content">
          <div className="spinner" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-view">
      {/* 顶部菜单栏 */}
      <TopBarMenu
        roomName={meta?.name || `房间 ${meta?.id?.slice(0, 6)}`}
        phase={phase}
        round={round}
        turnPhase={turnPhase}
        isDM={isDM}
        onLeaveRoom={handleLeaveRoom}
        client={client}
      />

      {/* 主内容区 */}
      <div className="game-content">
        {/* 左侧面板 */}
        <div className={`left-panel ${leftPanelCollapsed ? 'collapsed' : ''}`}>
          {!leftPanelCollapsed && (
            <>
              {/* DM 控制面板 */}
              {isDM && (
                <DMControlPanel
                  client={client}
                  currentPlayerId={currentPlayerId}
                  phase={phase}
                  round={round}
                  turnPhase={turnPhase}
                  onAdvancePhase={handleAdvancePhase}
                />
              )}

              {/* 战术指挥面板 */}
              {!isDM && (
                <TacticalCommandPanel
                  client={client}
                  phase={phase}
                  round={round}
                  turnPhase={turnPhase}
                  tokens={game?.tokens || {}}
                  selectedTokenId={selectedTokenId}
                />
              )}

              {/* 图层控制 */}
              <LayerControlPanel
                collapsed={leftPanelCollapsed}
                onToggle={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              />
            </>
          )}

          {/* 折叠按钮 */}
          <button
            className="panel-toggle"
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          >
            {leftPanelCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* 中央画布 */}
        <div className="canvas-container">
          <GameCanvas
            client={client}
            tokens={Object.values(game?.tokens || {})}
            selectedTokenId={selectedTokenId}
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
          />
        </div>

        {/* 右侧面板 */}
        <div className={`right-panel ${rightPanelCollapsed ? 'collapsed' : ''}`}>
          {!rightPanelCollapsed && (
            <RightInfoPanel
              client={client}
              players={Object.values(players)}
              ownerId={ownerId}
              currentPlayerId={currentPlayerId}
              isOwner={isOwner}
              onKickPlayer={handleKickPlayer}
              onTransferOwner={handleTransferOwner}
            />
          )}

          {/* 折叠按钮 */}
          <button
            className="panel-toggle"
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
          >
            {rightPanelCollapsed ? '←' : '→'}
          </button>
        </div>
      </div>

      {/* 样式 */}
      <style>{`
        .game-view {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background-color: var(--color-background);
          color: var(--color-text);
        }

        .game-view.loading {
          align-items: center;
          justify-content: center;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .game-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .left-panel,
        .right-panel {
          display: flex;
          flex-direction: column;
          background-color: var(--color-surface);
          border-right: 1px solid var(--color-border);
          position: relative;
          transition: width 0.3s ease;
        }

        .left-panel {
          width: ${leftPanelCollapsed ? '40px' : '320px'};
        }

        .right-panel {
          width: ${rightPanelCollapsed ? '40px' : '280px'};
          border-right: none;
          border-left: 1px solid var(--color-border);
        }

        .left-panel.collapsed,
        .right-panel.collapsed {
          width: 40px;
        }

        .panel-toggle {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 48px;
          background-color: var(--color-surface-dark);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text);
          z-index: 10;
        }

        .left-panel .panel-toggle {
          right: -12px;
        }

        .right-panel .panel-toggle {
          left: -12px;
        }

        .canvas-container {
          flex: 1;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default GameView;