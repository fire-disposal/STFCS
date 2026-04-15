/**
 * 资源进度条组件
 * 
 * 显示移动资源的消耗情况：
 * - 距离进度条
 * - 角度进度条
 * - 剩余资源显示
 */

import React from 'react';

const styles = {
  container: {
    marginBottom: '12px',
  },
  resourceBar: {
    marginBottom: '8px',
  },
  resourceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  resourceLabel: {
    fontSize: '10px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  resourceValue: {
    fontSize: '11px',
    color: '#cfe8ff',
    fontFamily: 'monospace',
  },
  bar: {
    height: '6px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '3px',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  tickMarks: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '2px',
  },
  tick: {
    width: '1px',
    height: '3px',
    backgroundColor: '#2b4261',
  },
};

interface ResourceBarProps {
  label: string;
  icon: string;
  current: number;
  max: number;
  unit: string;
  color: string;
  showTicks?: boolean;
}

export const ResourceBar: React.FC<ResourceBarProps> = ({
  label,
  icon,
  current,
  max,
  unit,
  color,
  showTicks = false,
}) => {
  const percent = Math.min(100, Math.max(0, (Math.abs(current) / max) * 100));
  const remaining = max - Math.abs(current);
  const remainingPercent = (remaining / max) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.resourceHeader}>
        <span style={styles.resourceLabel}>
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        <span style={styles.resourceValue}>
          {Math.abs(current).toFixed(0)} / {max}{unit} 
          <span style={{ color: '#6b7280' }}> (剩余：{remaining.toFixed(0)})</span>
        </span>
      </div>
      
      <div style={styles.bar}>
        <div
          style={{
            ...styles.barFill,
            width: `${percent}%`,
            backgroundColor: color,
          }}
        />
      </div>
      
      {showTicks && (
        <div style={styles.tickMarks}>
          {[0, 25, 50, 75, 100].map((tick) => (
            <div
              key={tick}
              style={{
                ...styles.tick,
                height: tick % 25 === 0 ? '4px' : '2px',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface MovementResources {
  phaseAForward: number;
  phaseAStrafe: number;
  turnAngle: number;
  phaseCForward: number;
  phaseCStrafe: number;
}

interface MovementResourceDisplayProps {
  resources: MovementResources;
  maxSpeed: number;
  maxTurnRate: number;
  currentPhase: 'PHASE_A' | 'PHASE_B' | 'PHASE_C';
}

export const MovementResourceDisplay: React.FC<MovementResourceDisplayProps> = ({
  resources,
  maxSpeed,
  maxTurnRate,
  currentPhase,
}) => {
  // 计算各阶段资源消耗
  const phaseAUsed = Math.sqrt(
    Math.pow(resources.phaseAForward, 2) + Math.pow(resources.phaseAStrafe, 2)
  );
  const phaseBUsed = Math.abs(resources.turnAngle);
  const phaseCUsed = Math.sqrt(
    Math.pow(resources.phaseCForward, 2) + Math.pow(resources.phaseCStrafe, 2)
  );

  // 阶段 A 最大移动距离（2 倍速度）
  const phaseAMax = maxSpeed * 2;
  // 阶段 B 最大转向角度
  const phaseBMax = maxTurnRate;
  // 阶段 C 最大移动距离（2 倍速度）
  const phaseCMax = maxSpeed * 2;

  return (
    <div style={{ 
      padding: '12px', 
      backgroundColor: 'rgba(20, 30, 40, 0.6)',
      borderRadius: '4px',
      marginBottom: '12px',
    }}>
      {/* 阶段 A 资源 */}
      <div style={{ 
        opacity: currentPhase === 'PHASE_A' ? 1 : 0.5,
        transition: 'opacity 0.3s',
      }}>
        <div style={{ fontSize: '10px', color: '#4a9eff', marginBottom: '8px', fontWeight: 'bold' }}>
          📍 阶段 A - 平移资源
        </div>
        <ResourceBar
          label="前进/后退"
          icon="⬆️"
          current={resources.phaseAForward}
          max={phaseAMax}
          unit=""
          color="#4a9eff"
          showTicks
        />
        <ResourceBar
          label="侧移"
          icon="➡️"
          current={resources.phaseAStrafe}
          max={maxSpeed}
          unit=""
          color="#2ecc71"
          showTicks
        />
        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
          合成移动距离：{phaseAUsed.toFixed(0)} / {phaseAMax} (剩余：{(phaseAMax - phaseAUsed).toFixed(0)})
        </div>
      </div>

      {/* 阶段 B 资源 */}
      <div style={{ 
        opacity: currentPhase === 'PHASE_B' ? 1 : 0.5,
        transition: 'opacity 0.3s',
        marginTop: '12px',
      }}>
        <div style={{ fontSize: '10px', color: '#f1c40f', marginBottom: '8px', fontWeight: 'bold' }}>
          🔄 阶段 B - 转向资源
        </div>
        <ResourceBar
          label="转向角度"
          icon="🔄"
          current={resources.turnAngle}
          max={phaseBMax}
          unit="°"
          color="#f1c40f"
          showTicks
        />
        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
          剩余转向：{(phaseBMax - phaseBUsed).toFixed(0)}°
        </div>
      </div>

      {/* 阶段 C 资源 */}
      <div style={{ 
        opacity: currentPhase === 'PHASE_C' ? 1 : 0.5,
        transition: 'opacity 0.3s',
        marginTop: '12px',
      }}>
        <div style={{ fontSize: '10px', color: '#4a9eff', marginBottom: '8px', fontWeight: 'bold' }}>
          📍 阶段 C - 平移资源
        </div>
        <ResourceBar
          label="前进/后退"
          icon="⬆️"
          current={resources.phaseCForward}
          max={phaseCMax}
          unit=""
          color="#4a9eff"
          showTicks
        />
        <ResourceBar
          label="侧移"
          icon="➡️"
          current={resources.phaseCStrafe}
          max={maxSpeed}
          unit=""
          color="#2ecc71"
          showTicks
        />
        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
          合成移动距离：{phaseCUsed.toFixed(0)} / {phaseCMax} (剩余：{(phaseCMax - phaseCUsed).toFixed(0)})
        </div>
      </div>
    </div>
  );
};

export default MovementResourceDisplay;
