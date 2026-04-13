/**
 * 舰船详情面板
 *
 * 显示选中舰船的完整状态信息：
 * - 基本信息（ID、阵营、舰型）
 * - 船体状态
 * - 6象限护甲状态
 * - 辐能系统状态
 * - 护盾状态
 * - 武器列表
 * - 机动参数
 *
 * 样式: game-panels.css (ship-panel 类)
 */

import React, { useMemo } from 'react';
import type { ShipState, WeaponSlot } from '@vt/contracts';
import { Faction } from '@vt/contracts';
import { Rocket, Shield, Zap, Crosshair, Heart, Gauge, BarChart3, Sparkles, Bomb, Activity } from 'lucide-react';

const quadrantNames = ['前', '前右', '后右', '后', '后左', '前左'];

const damageTypeColors: Record<string, string> = {
  kinetic: '#4a90d9',
  high_explosive: '#d4af37',
  energy: '#9b59b6',
  fragmentation: '#95a5a6',
};

const damageTypeIconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  kinetic: Zap,
  high_explosive: Bomb,
  energy: Sparkles,
  fragmentation: Activity,
};

interface ShipDetailPanelProps {
  ship: ShipState | null;
  currentPhase?: string;
}

export const ShipDetailPanel: React.FC<ShipDetailPanelProps> = ({
  ship,
}) => {
  const armorPercentages = useMemo(() => {
    if (!ship) return [];
    return ship.armorCurrent.map((current: number, i: number) => {
      const max = ship.armorMax[i] || 1;
      return Math.round((current / max) * 100);
    });
  }, [ship]);

  const fluxPercentage = useMemo(() => {
    if (!ship || ship.fluxMax <= 0) return 0;
    return Math.round(((ship.fluxHard + ship.fluxSoft) / ship.fluxMax) * 100);
  }, [ship]);

  const hullPercentage = useMemo(() => {
    if (!ship || ship.hullMax <= 0) return 0;
    return Math.round((ship.hullCurrent / ship.hullMax) * 100);
  }, [ship]);

  const weapons = useMemo(() => {
    const result: WeaponSlot[] = [];
    if (ship) ship.weapons.forEach((w: WeaponSlot) => result.push(w));
    return result;
  }, [ship]);

  const getArmorColor = (percent: number): string => {
    if (percent > 75) return '#2ecc71';
    if (percent > 50) return '#f1c40f';
    if (percent > 25) return '#e67e22';
    return '#e74c3c';
  };

  const getFluxColor = (percent: number, isOverloaded: boolean): string => {
    if (isOverloaded) return '#e74c3c';
    if (percent > 80) return '#e67e22';
    if (percent > 50) return '#f1c40f';
    return '#3498db';
  };

  const getHullColor = (percent: number): string => {
    if (percent > 50) return '#2ecc71';
    if (percent > 25) return '#e67e22';
    return '#e74c3c';
  };

  if (!ship) {
    return (
      <div className="game-panel ship-panel">
        <div className="game-empty">
          <Rocket className="game-empty__icon" />
          选择一艘舰船查看详情
        </div>
      </div>
    );
  }

  const isPlayer = ship.faction === Faction.PLAYER;

  return (
    <div className="game-panel ship-panel">
      <div className="ship-header">
        <div className="ship-title">
          <Rocket className="ship-title__icon" />
          {ship.hullType || '舰船'}
        </div>
        <div className={`ship-faction-badge ${isPlayer ? 'ship-faction-badge--player' : 'ship-faction-badge--dm'}`}>
          {isPlayer ? '玩家' : '敌方'}
        </div>
      </div>

      <div className="game-section">
        <div className="ship-row">
          <span className="ship-label">ID</span>
          <span className="ship-value">{ship.id.slice(-8)}</span>
        </div>
        <div className="ship-row">
          <span className="ship-label">位置</span>
          <span className="ship-value">
            ({ship.transform.x.toFixed(1)}, {ship.transform.y.toFixed(1)})
          </span>
        </div>
        <div className="ship-row">
          <span className="ship-label">朝向</span>
          <span className="ship-value">{ship.transform.heading.toFixed(1)}°</span>
        </div>
        {ship.ownerId && (
          <div className="ship-row">
            <span className="ship-label">控制者</span>
            <span className="ship-value">{ship.ownerId.slice(-6)}</span>
          </div>
        )}
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Heart className="game-section__icon" />
          船体
          {ship.hullCurrent <= 0 && (
            <span className="ship-status-badge ship-status-badge--destroyed">摧毁</span>
          )}
        </div>
        <div className="ship-row">
          <span className="ship-label">当前 / 最大</span>
          <span className="ship-value">{Math.round(ship.hullCurrent)} / {ship.hullMax}</span>
        </div>
        <div className="game-bar">
          <div
            className="game-bar__fill"
            style={{ width: `${hullPercentage}%`, backgroundColor: getHullColor(hullPercentage) }}
          />
        </div>
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Shield className="game-section__icon" />
          护甲 (6象限)
        </div>
        <div className="ship-armor-grid">
          {armorPercentages.map((percent: number, i: number) => (
            <div
              key={i}
              className="ship-armor-cell"
              style={{ backgroundColor: getArmorColor(percent) }}
              title={`${quadrantNames[i]}: ${ship.armorCurrent[i]}/${ship.armorMax[i]}`}
            >
              {quadrantNames[i]}<br />{percent}%
            </div>
          ))}
        </div>
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Zap className="game-section__icon" />
          辐能
          {ship.isOverloaded && (
            <span className="ship-status-badge ship-status-badge--overloaded">过载</span>
          )}
        </div>
        <div className="ship-row">
          <span className="ship-label">软辐能</span>
          <span className="ship-value ship-value--blue">{Math.round(ship.fluxSoft)}</span>
        </div>
        <div className="ship-row">
          <span className="ship-label">硬辐能</span>
          <span className="ship-value ship-value--orange">{Math.round(ship.fluxHard)}</span>
        </div>
        <div className="ship-row">
          <span className="ship-label">容量</span>
          <span className="ship-value">{ship.fluxMax}</span>
        </div>
        <div className="game-bar">
          <div
            className="game-bar__fill"
            style={{ width: `${fluxPercentage}%`, backgroundColor: getFluxColor(fluxPercentage, ship.isOverloaded) }}
          />
        </div>
        {ship.isOverloaded && (
          <div className="ship-row">
            <span className="ship-label">过载剩余</span>
            <span className="ship-value ship-value--red">{Math.round(ship.overloadTime)}秒</span>
          </div>
        )}
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Sparkles className="game-section__icon" />
          护盾
          <span className={`ship-status-badge ${ship.isShieldUp ? 'ship-status-badge--shield-on' : 'ship-status-badge--shield-off'}`}>
            {ship.isShieldUp ? '开启' : '关闭'}
          </span>
        </div>
        <div className="ship-row">
          <span className="ship-label">朝向</span>
          <span className="ship-value">{ship.shieldOrientation.toFixed(1)}°</span>
        </div>
        <div className="ship-row">
          <span className="ship-label">弧宽</span>
          <span className="ship-value">{ship.shieldArc}°</span>
        </div>
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Crosshair className="game-section__icon" />
          武器 ({weapons.length})
        </div>
        {weapons.length > 0 ? (
          <div className="ship-weapon-list">
            {weapons.map((weapon) => {
              const w = weapon as unknown as { mountId: string; name: string; damageType: string; damage: number; range: number; arcMin: number; arcMax: number; cooldownRemaining: number; state: string };
              const arcWidth = w.arcMax - w.arcMin;
              const IconComponent = damageTypeIconComponents[w.damageType] || Crosshair;
              return (
              <div key={w.mountId} className="ship-weapon-item">
                <div
                  className="ship-weapon-icon"
                  style={{ backgroundColor: damageTypeColors[w.damageType] || '#4a90d9' }}
                >
                  <IconComponent className="ship-weapon-icon__svg" />
                </div>
                <div className="ship-weapon-info">
                  <div className="ship-weapon-name">{w.name || w.mountId.slice(-6)}</div>
                  <div className="ship-weapon-stats">
                    伤害: {w.damage} | 射程: {w.range} | 射界: {arcWidth}°
                  </div>
                </div>
                {w.cooldownRemaining > 0 && (
                  <span className="ship-status-badge ship-status-badge--cooldown">
                    CD {w.cooldownRemaining.toFixed(1)}s
                  </span>
                )}
              </div>
            )})}
          </div>
        ) : (
          <div className="game-empty">无武器</div>
        )}
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <Gauge className="game-section__icon" />
          机动参数
        </div>
        <div className="ship-row">
          <span className="ship-label">最大速度</span>
          <span className="ship-value">{ship.maxSpeed}</span>
        </div>
        <div className="ship-row">
          <span className="ship-label">最大转向</span>
          <span className="ship-value">{ship.maxTurnRate}°</span>
        </div>
        <div className="ship-row">
          <span className="ship-label">加速度</span>
          <span className="ship-value">{ship.acceleration}</span>
        </div>
      </div>

      <div className="game-section">
        <div className="game-section__title">
          <BarChart3 className="game-section__icon" />
          本回合状态
        </div>
        <div className="ship-row">
          <span className="ship-label">已移动</span>
          <span className={`ship-value ${ship.hasMoved ? 'ship-value--green' : ''}`}>
            {ship.hasMoved ? '是' : '否'}
          </span>
        </div>
        <div className="ship-row">
          <span className="ship-label">已开火</span>
          <span className={`ship-value ${ship.hasFired ? 'ship-value--green' : ''}`}>
            {ship.hasFired ? '是' : '否'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ShipDetailPanel;