/**
 * 右侧面板 Tab 系统
 * 
 * 提供多个功能面板的切换：
 * - 聊天
 * - 玩家列表
 * - 战斗日志
 * - 设置
 */

import React, { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import type { Room } from '@colyseus/sdk';
import type { GameRoomState } from '@vt/contracts';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    border: '1px solid #2b4261',
    overflow: 'hidden',
  },
  tabs: {
    display: 'flex',
    backgroundColor: 'rgba(20, 30, 40, 0.9)',
    borderBottom: '1px solid #2b4261',
  },
  tab: {
    flex: 1,
    padding: '12px 8px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  tabActive: {
    borderBottomColor: '#4a9eff',
    color: '#4a9eff',
    backgroundColor: 'rgba(26, 45, 66, 0.5)',
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  tabPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  badge: {
    backgroundColor: '#4a9eff',
    color: 'white',
    fontSize: '9px',
    fontWeight: 'bold' as const,
    padding: '1px 5px',
    borderRadius: '8px',
    minWidth: '16px',
    textAlign: 'center' as const,
  },
};

type TabId = 'chat' | 'players' | 'log' | 'settings';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: string;
  badge?: number;
}

interface RightPanelTabsProps {
  room: Room<GameRoomState> | null;
  playerName: string;
  onShowPlayerRoster?: () => void;
  onShowSettings?: () => void;
  playerCount?: number;
  unreadChatCount?: number;
}

export const RightPanelTabs: React.FC<RightPanelTabsProps> = ({
  room,
  playerName,
  onShowPlayerRoster,
  onShowSettings,
  playerCount,
  unreadChatCount,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('chat');

  const tabs: TabDefinition[] = [
    { id: 'chat', label: '聊天', icon: '💬', badge: unreadChatCount },
    { id: 'players', label: '玩家', icon: '👥', badge: playerCount },
    { id: 'log', label: '日志', icon: '📋' },
    { id: 'settings', label: '设置', icon: '⚙️' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <div style={styles.tabPanel}>
            <ChatPanel room={room} playerName={playerName} />
          </div>
        );
      
      case 'players':
        return (
          <div style={{ ...styles.tabPanel, padding: '16px', textAlign: 'center' as const }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
            <div style={{ color: '#cfe8ff', marginBottom: '16px' }}>
              玩家列表
            </div>
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: '#1a4a7a',
                border: '1px solid #4a9eff',
                borderRadius: '4px',
                color: '#4a9eff',
                cursor: 'pointer',
              }}
              onClick={onShowPlayerRoster}
            >
              查看玩家列表
            </button>
          </div>
        );

      case 'log':
        return (
          <div style={{ ...styles.tabPanel, padding: '16px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', textAlign: 'center' as const }}>📋</div>
            <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center' as const }}>
              战斗日志功能开发中...
            </div>
          </div>
        );

      case 'settings':
        return (
          <div style={{ ...styles.tabPanel, padding: '16px', textAlign: 'center' as const }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙️</div>
            <div style={{ color: '#cfe8ff', marginBottom: '16px' }}>
              游戏设置
            </div>
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: '#1a4a7a',
                border: '1px solid #4a9eff',
                borderRadius: '4px',
                color: '#4a9eff',
                cursor: 'pointer',
              }}
              onClick={onShowSettings}
            >
              打开设置菜单
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span style={styles.badge}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default RightPanelTabs;
