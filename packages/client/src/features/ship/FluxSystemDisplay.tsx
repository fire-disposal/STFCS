/**
 * 辐能系统显示组件
 *
 * 显示舰船的辐能状态：
 * - 软辐能/硬辐能
 * - 容量和消散
 * - 过载/散热状态
 */

import React from 'react';
import type { FluxInstanceState, FluxState } from '@vt/shared/types';

// 样式
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fluxBar: {
    position: 'relative' as const,
    height: '24px',
    backgroundColor: 'var(--color-surface-dark)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  softFlux: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#3498db',
    transition: 'width 0.3s ease',
  },
  hardFlux: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#e74c3c',
    transition: 'width 0.3s ease',
  },
  fluxText: {
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    zIndex: 1,
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '8px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '4px',
  },
  statLabel: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginBottom: '2px',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 'bold',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  statusNormal: {
    backgroundColor: 'var(--color-success-light)',
    color: 'var(--color-success)',
  },
  statusVenting: {
    backgroundColor: 'var(--color-info-light)',
    color: 'var(--color-info)',
  },
  statusOverloaded: {
    backgroundColor: 'var(--color-error-light)',
    color: 'var(--color-error)',
  },
  progressBar: {
    height: '4px',
    backgroundColor: 'var(--color-surface-dark)',
    borderRadius: '2px',
    marginTop: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
};

// 状态名称
const stateNames: Record<string, string> = {
  normal: '正常',
  venting: '散热中',
  overloaded: '过载',
};

// 状态图标
const stateIcons: Record<string, string> = {
  normal: '✓',
  venting: '💨',
  overloaded: '⚡',
};

interface FluxSystemDisplayProps {
  flux: FluxInstanceState;
  showDetails?: boolean;
  compact?: boolean;
}

export const FluxSystemDisplay: React.FC<FluxSystemDisplayProps> = ({
  flux,
  showDetails = true,
  compact = false,
}) => {
  // 计算百分比
  const totalFlux = flux.softFlux + flux.hardFlux;
  const fluxPercent = (totalFlux / flux.capacity) * 100;
  const softFluxPercent = (flux.softFlux / flux.capacity) * 100;
  const hardFluxPercent = (flux.hardFlux / flux.capacity) * 100;

  // 获取状态样式
  const getStatusStyle = (): React.CSSProperties => {
    switch (flux.state) {
      case 'venting':
        return styles.statusVenting;
      case 'overloaded':
        return styles.statusOverloaded;
      default:
        return styles.statusNormal;
    }
  };

  if (compact) {
    return (
      <div style={{ ...styles.container, flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ fontSize: '24px', marginRight: '8px' }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>辐能</div>
          <div style={{ ...styles.fluxBar, height: '12px' }}>
            <div style={{ ...styles.hardFlux, width: `${hardFluxPercent}%` }} />
            <div style={{ ...styles.softFlux, width: `${softFluxPercent + hardFluxPercent}%` }} />
          </div>
        </div>
        <div style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 'bold' }}>
          {Math.round(fluxPercent)}%
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>⚡ 辐能系统</span>
        <div style={{ ...styles.statusBadge, ...getStatusStyle() }}>
          <span>{stateIcons[flux.state]}</span>
          <span>{stateNames[flux.state]}</span>
        </div>
      </div>

      {/* 辐能条 */}
      <div style={styles.fluxBar}>
        <div style={{ ...styles.hardFlux, width: `${hardFluxPercent}%` }} />
        <div style={{ ...styles.softFlux, width: `${softFluxPercent}%`, left: `${hardFluxPercent}%` }} />
        <div style={styles.fluxText}>
          {totalFlux} / {flux.capacity}
        </div>
      </div>

      {/* 详细统计 */}
      {showDetails && (
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>软辐能</span>
            <span style={{ ...styles.statValue, color: '#3498db' }}>
              {flux.softFlux}
            </span>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${softFluxPercent}%`,
                  backgroundColor: '#3498db',
                }}
              />
            </div>
          </div>

          <div style={styles.statItem}>
            <span style={styles.statLabel}>硬辐能</span>
            <span style={{ ...styles.statValue, color: '#e74c3c' }}>
              {flux.hardFlux}
            </span>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${hardFluxPercent}%`,
                  backgroundColor: '#e74c3c',
                }}
              />
            </div>
          </div>

          <div style={styles.statItem}>
            <span style={styles.statLabel}>消散率</span>
            <span style={styles.statValue}>
              {flux.dissipation}/秒
            </span>
          </div>

          <div style={styles.statItem}>
            <span style={styles.statLabel}>散热速度</span>
            <span style={styles.statValue}>
              {flux.ventRate}/秒
            </span>
          </div>
        </div>
      )}

      {/* 过载/散热计时 */}
      {(flux.state === 'overloaded' || flux.state === 'venting') && (
        <div style={{
          padding: '8px',
          backgroundColor: flux.state === 'overloaded'
            ? 'var(--color-error-light)'
            : 'var(--color-info-light)',
          borderRadius: '4px',
          fontSize: '12px',
          textAlign: 'center',
        }}>
          {flux.state === 'overloaded' && (
            <span>过载剩余: {flux.overloadTimeRemaining.toFixed(1)}秒</span>
          )}
          {flux.state === 'venting' && (
            <span>散热剩余: {flux.ventTimeRemaining.toFixed(1)}秒</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FluxSystemDisplay;