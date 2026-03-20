/**
 * 操作定义工具
 *
 * 提供类型安全的操作定义和声明式权限
 */

import type { 
  RoomState, 
  OperationFn, 
  OperationDef, 
  OperationMap 
} from './types.js';

// ==================== 操作定义辅助函数 ====================

/**
 * 定义普通操作
 * 
 * @example
 * ```ts
 * join: op((state, clientId, name: string) => {
 *   state.players[clientId] = { id: clientId, name, ... };
 * }),
 * ```
 */
export function op<TArgs extends any[], TReturn = void>(
  handler: OperationFn<TArgs, TReturn>
): OperationDef<TArgs, TReturn> {
  return { handler };
}

/**
 * 定义仅房主可执行的操作
 * 
 * @example
 * ```ts
 * kick: onlyOwner((state, clientId, targetId: string) => {
 *   delete state.players[targetId];
 * }),
 * ```
 */
export function onlyOwner<TArgs extends any[], TReturn = void>(
  handler: OperationFn<TArgs, TReturn>
): OperationDef<TArgs, TReturn> {
  return { handler, requireOwner: true };
}

/**
 * 定义仅 DM 可执行的操作
 * 
 * @example
 * ```ts
 * advancePhase: onlyDM((state, clientId) => {
 *   state.meta.turnPhase = 'dm_action';
 * }),
 * ```
 */
export function onlyDM<TArgs extends any[], TReturn = void>(
  handler: OperationFn<TArgs, TReturn>
): OperationDef<TArgs, TReturn> {
  return { handler, requireDM: true };
}

/**
 * 定义带描述的操作
 */
export function describe<TArgs extends any[], TReturn = void>(
  description: string,
  handler: OperationFn<TArgs, TReturn>
): OperationDef<TArgs, TReturn> {
  return { handler, description };
}

// ==================== 操作映射构建器 ====================

/**
 * 操作映射构建器
 * 提供链式 API 定义操作
 */
export class OperationsBuilder<T extends OperationMap = {}> {
  private _operations: T = {} as T;

  /**
   * 添加普通操作
   */
  add<K extends string, TArgs extends any[], TReturn = void>(
    name: K,
    handler: OperationFn<TArgs, TReturn>
  ): OperationsBuilder<T & Record<K, OperationDef<TArgs, TReturn>>> {
    (this._operations as any)[name] = { handler };
    return this as any;
  }

  /**
   * 添加仅房主操作
   */
  addOwnerOnly<K extends string, TArgs extends any[], TReturn = void>(
    name: K,
    handler: OperationFn<TArgs, TReturn>
  ): OperationsBuilder<T & Record<K, OperationDef<TArgs, TReturn>>> {
    (this._operations as any)[name] = { handler, requireOwner: true };
    return this as any;
  }

  /**
   * 添加仅 DM 操作
   */
  addDMOnly<K extends string, TArgs extends any[], TReturn = void>(
    name: K,
    handler: OperationFn<TArgs, TReturn>
  ): OperationsBuilder<T & Record<K, OperationDef<TArgs, TReturn>>> {
    (this._operations as any)[name] = { handler, requireDM: true };
    return this as any;
  }

  /**
   * 构建操作映射
   */
  build(): T {
    return this._operations;
  }
}

/**
 * 创建操作构建器
 */
export function defineOperations(): OperationsBuilder<{}> {
  return new OperationsBuilder();
}

// ==================== 权限检查 ====================

/**
 * 检查操作权限
 */
export function checkPermission(
  state: RoomState,
  clientId: string,
  operation: OperationDef
): { allowed: boolean; reason?: string } {
  // 检查房主权限
  if (operation.requireOwner) {
    if (state.meta.ownerId !== clientId) {
      return { allowed: false, reason: 'Only room owner can perform this action' };
    }
  }

  // 检查 DM 权限
  if (operation.requireDM) {
    const player = state.players[clientId];
    if (!player?.isDM) {
      return { allowed: false, reason: 'Only DM can perform this action' };
    }
  }

  return { allowed: true };
}