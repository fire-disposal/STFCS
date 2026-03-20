/**
 * 部署阶段主视图
 *
 * 显示部署阶段的完整 UI：
 * - 舰船选择器
 * - 地图预览
 * - 放置预览
 * - 阵营部署面板
 */

import React, { useCallback, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectGamePhase, selectDeploymentReady } from '@/store/slices/gameFlowSlice';
import { selectSelectedFaction } from '@/store/slices/factionSlice';
import { selectCurrentPlayerId } from '@/store/slices/playerSlice';
import { ShipSelector } from './ShipSelector';
import { ShipPlacementPreview } from './ShipPlacementPreview';
import { FactionDeploymentPanel } from './FactionDeploymentPanel';
import type { ShipDefinition } from '@vt/shared/config';
import type { FactionId } from '@vt/shared/types';
import type { Point } from '@vt/shared/core-types';

// 样式
const styles = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  sidebar: {
    width: '300px',
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  statusPanel: {
    width: '250px',
    backgroundColor: 'var(--color-surface)',
    borderLeft: '1px solid var(--color-border)',
    padding: '16px',
    overflow: 'auto',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    padding: '16px',
    borderBottom: '1px solid var(--color-border)',
  },
};

interface PlacementPreviewData {
  shipDefinitionId: string;
  shipName: string;
  hullId: string;
}

interface DeploymentPhaseViewProps {
  onDeployShip?: (params: {
    shipDefinitionId: string;
    position: Point;
    heading: number;
    faction: FactionId;
    ownerId: string;
  }) => void;
  onReadyToggle?: (faction: FactionId, ready: boolean) => void;
}

export const DeploymentPhaseView: React.FC<DeploymentPhaseViewProps> = ({
  onDeployShip,
  onReadyToggle,
}) => {
  const dispatch = useAppDispatch();
  const phase = useAppSelector(selectGamePhase);
  const deploymentReady = useAppSelector(selectDeploymentReady);
  const selectedFaction = useAppSelector(selectSelectedFaction);
  const currentPlayerId = useAppSelector(selectCurrentPlayerId);

  // 本地状态管理
  const [placementMode, setPlacementMode] = useState(false);
  const [placementPreview, setPlacementPreview] = useState<PlacementPreviewData | null>(null);

  // 只在部署阶段显示
  if (phase !== 'deployment') {
    return null;
  }

  // 处理舰船选择
  const handleShipSelect = useCallback((ship: ShipDefinition) => {
    setPlacementMode(true);
    setPlacementPreview({
      shipDefinitionId: ship.id,
      shipName: ship.name,
      hullId: ship.hullId,
    });
  }, []);

  // 处理放置确认
  const handlePlacementConfirm = useCallback((position: Point, heading: number) => {
    if (!placementPreview || !selectedFaction || !currentPlayerId) return;

    const params = {
      shipDefinitionId: placementPreview.shipDefinitionId,
      position,
      heading,
      faction: selectedFaction,
      ownerId: currentPlayerId,
    };

    if (onDeployShip) {
      onDeployShip(params);
    }

    // 清除放置预览
    setPlacementPreview(null);
    setPlacementMode(false);
  }, [placementPreview, selectedFaction, currentPlayerId, onDeployShip]);

  // 处理放置取消
  const handlePlacementCancel = useCallback(() => {
    setPlacementPreview(null);
    setPlacementMode(false);
  }, []);

  // 处理就绪切换
  const handleReadyToggle = useCallback(() => {
    if (!selectedFaction) return;

    const newReady = !deploymentReady[selectedFaction];
    if (onReadyToggle) {
      onReadyToggle(selectedFaction, newReady);
    }
  }, [selectedFaction, deploymentReady, onReadyToggle]);

  return (
    <div style={styles.container}>
      {/* 左侧边栏 - 舰船选择 */}
      <aside style={styles.sidebar}>
        <div style={styles.title}>部署舰船</div>
        <ShipSelector
          faction={selectedFaction}
          onSelect={handleShipSelect}
        />
        <FactionDeploymentPanel
          faction={selectedFaction}
          isReady={selectedFaction ? deploymentReady[selectedFaction] ?? false : false}
          onReadyToggle={handleReadyToggle}
        />
      </aside>

      {/* 主区域 - 地图 */}
      <main style={styles.main}>
        {/* 地图渲染区域 - 这里应该包含 GameCanvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* GameCanvas 组件应该在这里渲染 */}
          {/* 这里是一个占位符 */}
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
          }}>
            地图渲染区域
          </div>

          {/* 放置预览 */}
          {placementMode && placementPreview && (
            <ShipPlacementPreview
              shipDefinitionId={placementPreview.shipDefinitionId}
              onConfirm={handlePlacementConfirm}
              onCancel={handlePlacementCancel}
            />
          )}
        </div>
      </main>

      {/* 右侧状态面板 */}
      <aside style={styles.statusPanel}>
        <DeploymentStatusPanel
          deploymentReady={deploymentReady}
          selectedFaction={selectedFaction}
        />
      </aside>
    </div>
  );
};

// ==================== 部署状态面板 ====================

interface DeploymentStatusPanelProps {
  deploymentReady: Record<string, boolean>;
  selectedFaction: FactionId | null;
}

const DeploymentStatusPanel: React.FC<DeploymentStatusPanelProps> = ({
  deploymentReady,
  selectedFaction,
}) => {
  const factions = Object.keys(deploymentReady);

  return (
    <div>
      <h3 style={{ marginBottom: '16px' }}>部署状态</h3>

      {/* 阵营就绪状态 */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>阵营就绪状态</h4>
        {factions.map(faction => (
          <div
            key={faction}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px',
              marginBottom: '4px',
              backgroundColor: faction === selectedFaction
                ? 'var(--color-primary-light)'
                : 'var(--color-background)',
              borderRadius: '4px',
            }}
          >
            <span>{faction}</span>
            <span style={{
              color: deploymentReady[faction]
                ? 'var(--color-success)'
                : 'var(--color-warning)',
            }}>
              {deploymentReady[faction] ? '✓ 就绪' : '○ 未就绪'}
            </span>
          </div>
        ))}
      </div>

      {/* 操作提示 */}
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-info-light)',
        borderRadius: '4px',
        fontSize: '13px',
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>操作说明</p>
        <ul style={{ margin: 0, paddingLeft: '16px' }}>
          <li>从左侧选择要部署的舰船</li>
          <li>在地图上点击放置位置</li>
          <li>使用滚轮调整朝向</li>
          <li>点击确认完成部署</li>
        </ul>
      </div>
    </div>
  );
};

export default DeploymentPhaseView;