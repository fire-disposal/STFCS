/**
 * 战斗日志系统
 * 
 * 记录和展示战斗过程中的所有事件
 */

/**
 * 日志类型
 */
export type LogType = 
  | 'move'
  | 'shield'
  | 'fire'
  | 'damage'
  | 'flux'
  | 'overload'
  | 'phase'
  | 'system'
  | 'dm';

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'warning' | 'error' | 'success';

/**
 * 战斗日志条目
 */
export interface CombatLogEntry {
  id: string;
  type: LogType;
  level: LogLevel;
  message: string;
  timestamp: number;
  round: number;
  phase: string;
  data?: Record<string, unknown>;
}

/**
 * 日志过滤器
 */
export interface LogFilter {
  types: LogType[];
  levels: LogLevel[];
  searchQuery?: string;
}

/**
 * 战斗日志管理器
 */
export class CombatLogManager {
  private logs: CombatLogEntry[] = [];
  private maxLogs = 500;
  private subscribers = new Set<(logs: CombatLogEntry[]) => void>();

  /**
   * 添加日志条目
   */
  addLog(
    type: LogType,
    message: string,
    level: LogLevel = 'info',
    data?: Record<string, unknown>,
    round?: number,
    phase?: string
  ): CombatLogEntry {
    const entry: CombatLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      level,
      message,
      timestamp: Date.now(),
      round: round ?? 1,
      phase: phase ?? 'unknown',
      data,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.notifySubscribers();
    return entry;
  }

  /**
   * 添加移动日志
   */
  logMove(
    shipId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    heading: number,
    round: number,
    phase: string
  ): CombatLogEntry {
    return this.addLog(
      'move',
      `${shipId} 从 (${fromX.toFixed(0)}, ${fromY.toFixed(0)}) 移动到 (${toX.toFixed(0)}, ${toY.toFixed(0)}), 朝向 ${heading}°`,
      'info',
      { shipId, fromX, fromY, toX, toY, heading },
      round,
      phase
    );
  }

  /**
   * 添加护盾日志
   */
  logShield(
    shipId: string,
    isRaised: boolean,
    orientation?: number,
    round?: number,
    phase?: string
  ): CombatLogEntry {
    return this.addLog(
      'shield',
      `${shipId} ${isRaised ? '开启' : '关闭'}护盾${orientation !== undefined ? ` (朝向 ${orientation}°)` : ''}`,
      isRaised ? 'success' : 'info',
      { shipId, isRaised, orientation },
      round,
      phase
    );
  }

  /**
   * 添加开火日志
   */
  logFire(
    sourceShipId: string,
    weaponId: string,
    targetShipId: string,
    hit: boolean,
    round: number,
    phase: string
  ): CombatLogEntry {
    return this.addLog(
      'fire',
      `${sourceShipId} 使用 ${weaponId} 攻击 ${targetShipId}, ${hit ? '命中' : '未命中'}`,
      hit ? 'success' : 'warning',
      { sourceShipId, weaponId, targetShipId, hit },
      round,
      phase
    );
  }

  /**
   * 添加伤害日志
   */
  logDamage(
    targetShipId: string,
    damage: number,
    hullDamage: number,
    armorReduced: number,
    shieldAbsorbed: number,
    hitQuadrant: number,
    softFlux: number,
    hardFlux: number,
    round: number,
    phase: string
  ): CombatLogEntry {
    const quadrantNames = ['前', '前右', '后右', '后', '后左', '前左'];
    return this.addLog(
      'damage',
      `${targetShipId} 受到 ${damage.toFixed(0)} 点伤害 (船体：${hullDamage.toFixed(0)}, 装甲：${armorReduced.toFixed(0)}, 护盾吸收：${shieldAbsorbed.toFixed(0)}), 命中象限：${quadrantNames[hitQuadrant]}`,
      hullDamage > 0 ? 'warning' : 'info',
      {
        targetShipId,
        damage,
        hullDamage,
        armorReduced,
        shieldAbsorbed,
        hitQuadrant,
        softFlux,
        hardFlux,
      },
      round,
      phase
    );
  }

  /**
   * 添加辐能日志
   */
  logFlux(
    shipId: string,
    softFlux: number,
    hardFlux: number,
    totalFlux: number,
    capacity: number,
    isVenting: boolean,
    round: number,
    phase: string
  ): CombatLogEntry {
    const percent = ((totalFlux / capacity) * 100).toFixed(0);
    return this.addLog(
      'flux',
      `${shipId} 辐能状态：${totalFlux.toFixed(0)}/${capacity} (${percent}%) - 软辐能：${softFlux.toFixed(0)}, 硬辐能：${hardFlux.toFixed(0)}${isVenting ? ' (正在排散)' : ''}`,
      totalFlux / capacity > 0.8 ? 'warning' : 'info',
      { shipId, softFlux, hardFlux, totalFlux, capacity, isVenting },
      round,
      phase
    );
  }

  /**
   * 添加过载日志
   */
  logOverload(
    shipId: string,
    duration: number,
    round: number,
    phase: string
  ): CombatLogEntry {
    return this.addLog(
      'overload',
      `${shipId} 过载！无法行动 ${duration} 秒`,
      'error',
      { shipId, duration },
      round,
      phase
    );
  }

  /**
   * 添加阶段变更日志
   */
  logPhaseChange(
    oldPhase: string,
    newPhase: string,
    round: number
  ): CombatLogEntry {
    const phaseNames: Record<string, string> = {
      'DEPLOYMENT': '部署阶段',
      'PLAYER_TURN': '玩家回合',
      'DM_TURN': 'DM 回合',
      'END_PHASE': '结束阶段',
    };
    return this.addLog(
      'phase',
      `进入 ${phaseNames[newPhase] || newPhase} (第 ${round} 回合)`,
      'info',
      { oldPhase, newPhase, round },
      round,
      newPhase
    );
  }

  /**
   * 添加系统日志
   */
  logSystem(
    message: string,
    level: LogLevel = 'info',
    data?: Record<string, unknown>
  ): CombatLogEntry {
    return this.addLog('system', message, level, data);
  }

  /**
   * 添加 DM 操作日志
   */
  logDmAction(
    action: string,
    targetShipId?: string,
    data?: Record<string, unknown>
  ): CombatLogEntry {
    return this.addLog(
      'dm',
      `DM 操作：${action}${targetShipId ? ` - 目标：${targetShipId}` : ''}`,
      'warning',
      { action, targetShipId, ...data }
    );
  }

  /**
   * 获取所有日志
   */
  getLogs(filter?: LogFilter): CombatLogEntry[] {
    if (!filter) {
      return [...this.logs];
    }

    return this.logs.filter(log => {
      if (!filter.types.includes(log.type)) return false;
      if (!filter.levels.includes(log.level)) return false;
      if (filter.searchQuery && !log.message.toLowerCase().includes(filter.searchQuery.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * 获取最近 N 条日志
   */
  getRecentLogs(count: number, filter?: LogFilter): CombatLogEntry[] {
    const filtered = this.getLogs(filter);
    return filtered.slice(-count);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
    this.notifySubscribers();
  }

  /**
   * 订阅日志变更
   */
  subscribe(callback: (logs: CombatLogEntry[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * 导出日志为 JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 从 JSON 导入日志
   */
  importFromJson(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data)) {
        this.logs = data;
        this.notifySubscribers();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      callback(this.logs);
    }
  }
}

/**
 * 全局战斗日志实例
 */
export const combatLog = new CombatLogManager();
