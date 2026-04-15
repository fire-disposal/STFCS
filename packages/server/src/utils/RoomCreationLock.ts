/**
 * 房间创建并发控制
 *
 * 使用全局锁机制防止同一用户同时创建多个房间
 */

const roomCreationLocks = new Map<number, { timestamp: number; roomId?: string }>();
const LOCK_TIMEOUT_MS = 5000;  // 锁超时 5 秒

/**
 * 尝试获取房间创建锁
 * @param shortId 用户短 ID
 * @returns 是否成功获取锁
 */
export function tryAcquireRoomCreationLock(shortId: number): boolean {
  cleanupExpiredLocks();
  
  const existingLock = roomCreationLocks.get(shortId);
  if (existingLock) {
    // 已经有锁，拒绝
    return false;
  }
  
  // 获取锁
  roomCreationLocks.set(shortId, {
    timestamp: Date.now(),
  });
  
  // 自动释放锁（超时保护）
  setTimeout(() => {
    const lock = roomCreationLocks.get(shortId);
    if (lock && !lock.roomId) {
      roomCreationLocks.delete(shortId);
    }
  }, LOCK_TIMEOUT_MS);
  
  return true;
}

/**
 * 标记锁对应的房间（创建成功后）
 * @param shortId 用户短 ID
 * @param roomId 房间 ID
 */
export function markLockWithRoom(shortId: number, roomId: string): void {
  const lock = roomCreationLocks.get(shortId);
  if (lock) {
    lock.roomId = roomId;
    // 房间创建成功，立即释放锁
    setTimeout(() => {
      roomCreationLocks.delete(shortId);
    }, 1000);
  }
}

/**
 * 检查用户是否已有房间（通过锁机制）
 * @param shortId 用户短 ID
 * @returns 是否已有房间
 */
export function userHasRoom(shortId: number): boolean {
  cleanupExpiredLocks();
  return roomCreationLocks.has(shortId);
}

/**
 * 清理过期的锁
 */
function cleanupExpiredLocks(): void {
  const now = Date.now();
  for (const [id, lock] of roomCreationLocks.entries()) {
    if (now - lock.timestamp > LOCK_TIMEOUT_MS) {
      roomCreationLocks.delete(id);
    }
  }
}

/**
 * 获取统计信息（用于调试）
 */
export function getLockStats(): { activeLocks: number; locks: Array<{ shortId: number; age: number }> } {
  cleanupExpiredLocks();
  const now = Date.now();
  return {
    activeLocks: roomCreationLocks.size,
    locks: Array.from(roomCreationLocks.entries()).map(([shortId, lock]) => ({
      shortId,
      age: now - lock.timestamp,
    })),
  };
}
