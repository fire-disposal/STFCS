/**
 * 战斗日志面板组件
 * 
 * 显示实时的战斗日志和事件记录
 */

import React, { useEffect, useRef, useState } from 'react';
import type { CombatLogEntry, LogLevel, LogType } from '@vt/contracts';
import { combatLog, type LogFilter } from '@vt/contracts';
import { FileText, Trash2, Download, Info, AlertTriangle, XCircle, CheckCircle, X } from 'lucide-react';

interface CombatLogPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  maxDisplayLogs?: number;
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#4a9eff',
  warning: '#ffa500',
  error: '#ff4a4a',
  success: '#3ddb6f',
};

const LOG_LEVEL_ICONS: Record<LogLevel, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
};

const LOG_TYPE_LABELS: Record<LogType, string> = {
  move: '移动',
  shield: '护盾',
  fire: '开火',
  damage: '伤害',
  flux: '辐能',
  overload: '过载',
  phase: '阶段',
  system: '系统',
  dm: 'DM',
};

const LOG_TYPE_COLORS: Record<LogType, string> = {
  move: '#6b7280',
  shield: '#3b82f6',
  fire: '#ef4444',
  damage: '#f97316',
  flux: '#8b5cf6',
  overload: '#dc2626',
  phase: '#059669',
  system: '#6b7280',
  dm: '#7c3aed',
};

export const CombatLogPanel: React.FC<CombatLogPanelProps> = ({
  isOpen = true,
  onClose,
  maxDisplayLogs = 100,
}) => {
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({
    types: ['move', 'shield', 'fire', 'damage', 'flux', 'overload', 'phase', 'system', 'dm'],
    levels: ['info', 'warning', 'error', 'success'],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 订阅日志更新
  useEffect(() => {
    const unsubscribe = combatLog.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });

    // 初始获取日志
    setLogs(combatLog.getLogs());

    return unsubscribe;
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // 检查用户是否手动滚动（禁用自动滚动）
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (!isNearBottom && autoScroll) {
        setAutoScroll(false);
      } else if (isNearBottom && !autoScroll) {
        setAutoScroll(true);
      }
    }
  };

  // 过滤后的日志
  const filteredLogs = logs.filter(log => {
    if (!filter.types.includes(log.type)) return false;
    if (!filter.levels.includes(log.level)) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).slice(-maxDisplayLogs);

  // 清空日志
  const handleClear = () => {
    combatLog.clear();
  };

  // 导出日志
  const handleExport = () => {
    const json = combatLog.exportToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combat-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 切换日志类型过滤
  const toggleLogType = (type: LogType) => {
    setFilter(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div style={styles.panel}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.title}>
          <FileText className="game-icon game-icon--sm game-icon--primary" />
          战斗日志
          <span style={styles.logCount}>({filteredLogs.length} 条)</span>
        </div>
        <div style={styles.headerActions}>
          <label style={styles.autoScrollLabel}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            自动滚动
          </label>
          <button data-magnetic className="game-btn game-btn--small game-btn--ghost" onClick={handleClear} title="清空日志">
            <Trash2 className="game-icon game-icon--xs" />
          </button>
          <button data-magnetic className="game-btn game-btn--small game-btn--ghost" onClick={handleExport} title="导出日志">
            <Download className="game-icon game-icon--xs" />
          </button>
          <button style={styles.closeButton} onClick={onClose}>
            <X className="game-icon game-icon--sm" />
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="搜索日志..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* 过滤器 */}
      <div style={styles.filterBar}>
        {Object.entries(LOG_TYPE_LABELS).map(([type, label]) => (
          <button
            key={type}
            style={{
              ...styles.filterButton,
              backgroundColor: filter.types.includes(type as LogType)
                ? LOG_TYPE_COLORS[type as LogType]
                : 'transparent',
              borderColor: LOG_TYPE_COLORS[type as LogType],
              color: filter.types.includes(type as LogType) ? '#fff' : LOG_TYPE_COLORS[type as LogType],
            }}
            onClick={() => toggleLogType(type as LogType)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 日志列表 */}
      <div
        ref={scrollContainerRef}
        style={styles.logList}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div style={styles.emptyLogs}>暂无日志记录</div>
        ) : (
          filteredLogs.map((log) => {
            const LevelIcon = LOG_LEVEL_ICONS[log.level];
            return (
            <div
              key={log.id}
              style={{
                ...styles.logEntry,
                borderLeftColor: LOG_LEVEL_COLORS[log.level],
                backgroundColor: `rgba(${hexToRgb(LOG_TYPE_COLORS[log.type])}, 0.05)`,
              }}
            >
              <div style={styles.logHeader}>
                <span style={styles.logLevelIcon}>
                  <>{React.createElement(LOG_LEVEL_ICONS[log.level], { className: "game-icon game-icon--xs", style: { color: LOG_LEVEL_COLORS[log.level] } })}</>
                </span>
                <span style={styles.logType}>
                  {LOG_TYPE_LABELS[log.type]}
                </span>
                <span style={styles.logTime}>
                  {formatTime(log.timestamp)}
                </span>
                <span style={styles.logRound}>
                  R{log.round}
                </span>
              </div>
              <div style={styles.logMessage}>
                {log.message}
              </div>
              {log.data && Object.keys(log.data).length > 0 && (
                <details style={styles.logDetails}>
                  <summary style={styles.logDetailsSummary}>查看详情</summary>
                  <pre style={styles.logData}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

// 辅助函数：hex 转 rgb
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '100, 100, 100';
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(6, 16, 26, 0.98)',
    borderRadius: '8px',
    border: '1px solid #2b4261',
    overflow: 'hidden',
    height: '500px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #2b4261',
    backgroundColor: 'rgba(10, 30, 50, 0.9)',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logCount: {
    fontSize: '11px',
    color: '#8ba4c7',
    fontWeight: 'normal',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  autoScrollLabel: {
    fontSize: '11px',
    color: '#8ba4c7',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  iconButton: {
    background: 'transparent',
    border: 'none',
    color: '#8ba4c7',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#8ba4c7',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  searchBar: {
    padding: '8px 16px',
    borderBottom: '1px solid #2b4261',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #2b4261',
    backgroundColor: 'rgba(10, 30, 50, 0.8)',
    color: '#cfe8ff',
    fontSize: '12px',
    outline: 'none',
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '8px 16px',
    borderBottom: '1px solid #2b4261',
    backgroundColor: 'rgba(10, 30, 50, 0.5)',
  },
  filterButton: {
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: '500',
  },
  logList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  emptyLogs: {
    textAlign: 'center',
    color: '#8ba4c7',
    fontSize: '13px',
    padding: '32px',
  },
  logEntry: {
    marginBottom: '8px',
    padding: '10px 12px',
    borderRadius: '6px',
    borderLeft: '3px solid',
    fontSize: '12px',
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  logLevelIcon: {
    fontSize: '12px',
  },
  logType: {
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
    fontSize: '10px',
    color: '#8ba4c7',
  },
  logTime: {
    color: '#8ba4c7',
    fontSize: '10px',
    marginLeft: 'auto',
  },
  logRound: {
    color: '#8ba4c7',
    fontSize: '10px',
  },
  logMessage: {
    color: '#cfe8ff',
    lineHeight: '1.5',
  },
  logDetails: {
    marginTop: '6px',
    fontSize: '11px',
  },
  logDetailsSummary: {
    color: '#8ba4c7',
    cursor: 'pointer',
    fontWeight: '500',
  },
  logData: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: '8px',
    borderRadius: '4px',
    color: '#8ba4c7',
    fontSize: '10px',
    overflowX: 'auto',
    margin: '6px 0',
  },
};

export default CombatLogPanel;
