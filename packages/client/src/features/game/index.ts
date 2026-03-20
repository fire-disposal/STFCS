/**
 * 游戏模块导出
 *
 * 提供游戏核心功能：
 * - 视图管理
 * - 回合制管理
 * - 组件
 */

// 视图管理
export * from './view';

// 组件
export * from './components';

// 回合制管理
export { TurnPhaseManager } from './TurnPhaseManager';
export type {
  TurnResolutionResult,
  TurnEvent,
  TurnPhaseManagerConfig,
} from './TurnPhaseManager';

// 回合结算面板
export { TurnResolutionPanel } from './TurnResolutionPanel';

// 增强版回合指示器
export { EnhancedTurnIndicator } from './EnhancedTurnIndicator';