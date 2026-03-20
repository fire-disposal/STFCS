/**
 * 素材库组件
 *
 * 可拖拽的素材面板：
 * - DM：全程可用，显示所有素材
 * - 玩家：仅部署阶段可用，仅显示自己阵营的舰船
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useRoomState, useRoomOperations } from '@/room';
import type { RoomClient, OperationMap } from '@/room';
import type { FactionId, Point } from '@vt/shared/types';
import type { AssetTemplate, AssetCategory } from '@vt/shared/room';
import { ASSET_LIBRARY, getTemplate, getPlayerTemplates, getDMTemplates, isTemplateAvailable } from '@vt/shared/room';

// ==================== 样式 ====================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  search: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--color-border)',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: '13px',
  },
  categoryList: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  category: {
    borderBottom: '1px solid var(--color-border)',
  },
  categoryHeader: {
    padding: '10px 16px',
    backgroundColor: 'var(--color-background)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  categoryIcon: {
    marginRight: '8px',
  },
  categoryCount: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-surface-dark)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  templateList: {
    padding: '8px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  templateCard: {
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '6px',
    border: '2px solid var(--color-border)',
    cursor: 'grab',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: '6px',
  },
  templateCardHover: {
    borderColor: 'var(--color-primary)',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  templateCardDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  templateIcon: {
    fontSize: '24px',
  },
  templateName: {
    fontSize: '12px',
    fontWeight: 'bold',
  },
  templateStats: {
    fontSize: '10px',
    color: 'var(--color-text-secondary)',
  },
  templateDescription: {
    fontSize: '10px',
    color: 'var(--color-text-secondary)',
    marginTop: '4px',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
  },
};

// ==================== Props ====================

interface AssetLibraryPanelProps {
  client: RoomClient<OperationMap> | null;
  currentPlayerId: string;
  onDragStart?: (template: AssetTemplate) => void;
  onDragEnd?: () => void;
}

// ==================== Component ====================

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({
  client,
  currentPlayerId,
  onDragStart,
  onDragEnd,
}) => {
  const state = useRoomState(client);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['player_ships', 'enemy_ships']));
  const [draggingTemplate, setDraggingTemplate] = useState<AssetTemplate | null>(null);

  // 从状态中提取数据
  const meta = state?.meta;
  const players = state?.players || {};
  const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
  const isDM = currentPlayer?.isDM || false;
  const faction = currentPlayer?.faction;
  const phase = meta?.phase || 'lobby';

  // 获取可用的分类和模板
  const availableCategories = useMemo(() => {
    if (isDM) {
      // DM 可以看到所有分类
      return ASSET_LIBRARY.categories;
    }

    // 玩家只能看到自己阵营的舰船
    if (phase !== 'deployment') {
      return [];
    }

    const playerTemplates = faction ? getPlayerTemplates(faction) : [];
    if (playerTemplates.length === 0) {
      return [];
    }

    return [{
      id: 'my_ships',
      name: '我的舰船',
      icon: '🚀',
      templates: playerTemplates,
    }];
  }, [isDM, phase, faction]);

  // 过滤模板
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableCategories;
    }

    const query = searchQuery.toLowerCase();
    return availableCategories.map(category => ({
      ...category,
      templates: category.templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      ),
    })).filter(category => category.templates.length > 0);
  }, [availableCategories, searchQuery]);

  // 切换分类展开
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // 处理拖拽开始
  const handleDragStart = useCallback((template: AssetTemplate) => {
    setDraggingTemplate(template);
    onDragStart?.(template);
  }, [onDragStart]);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggingTemplate(null);
    onDragEnd?.();
  }, [onDragEnd]);

  // 检查模板是否可用
  const checkTemplateAvailable = useCallback((template: AssetTemplate) => {
    return isTemplateAvailable(template, phase, isDM, faction || undefined);
  }, [phase, isDM, faction]);

  // 加载状态
  if (!state) {
    return <div style={styles.container}>加载中...</div>;
  }

  // 非部署阶段且非 DM
  if (!isDM && phase !== 'deployment') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>📦 素材库</div>
        <div style={styles.emptyState}>
          仅部署阶段可用
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        📦 素材库
        {isDM && <span style={{ fontSize: '11px', color: 'var(--color-warning)' }}>DM</span>}
      </div>

      {/* 搜索 */}
      <div style={styles.search}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="搜索素材..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 分类列表 */}
      <div style={styles.categoryList}>
        {filteredCategories.length === 0 ? (
          <div style={styles.emptyState}>
            {isDM ? '没有找到素材' : '请先选择阵营'}
          </div>
        ) : (
          filteredCategories.map(category => (
            <div key={category.id} style={styles.category}>
              <div
                style={styles.categoryHeader}
                onClick={() => toggleCategory(category.id)}
              >
                <span>
                  <span style={styles.categoryIcon}>{category.icon}</span>
                  {category.name}
                </span>
                <span style={styles.categoryCount}>{category.templates.length}</span>
              </div>

              {expandedCategories.has(category.id) && (
                <div style={styles.templateList}>
                  {category.templates.map(template => {
                    const available = checkTemplateAvailable(template);
                    const isDragging = draggingTemplate?.id === template.id;

                    return (
                      <div
                        key={template.id}
                        style={{
                          ...styles.templateCard,
                          ...(isDragging ? styles.templateCardHover : {}),
                          ...(!available ? styles.templateCardDisabled : {}),
                        }}
                        draggable={available}
                        onDragStart={() => handleDragStart(template)}
                        onDragEnd={handleDragEnd}
                        title={template.description}
                      >
                        <span style={styles.templateIcon}>{template.icon}</span>
                        <span style={styles.templateName}>{template.name}</span>
                        <span style={styles.templateStats}>
                          船体: {template.config.hull} | 装甲: {template.config.armor}
                        </span>
                        {template.description && (
                          <span style={styles.templateDescription}>
                            {template.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AssetLibraryPanel;