import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlayerInfo, PlayerGameState } from '@vt/shared'

// 基于 DDD 领域模型设计
export interface PlayerData extends PlayerInfo {
  gameState: PlayerGameState
  isConnected: boolean
  isReady: boolean
  joinedRoomId: string | null
}

// 重新定义一个完整的store
export const usePlayerStore = defineStore('player', () => {
  const allPlayers = ref<Map<string, PlayerData>>(
    new Map<string, PlayerData>()
  )
  const currentPlayerId = ref<string | null>(null)
  
  const currentPlayer = computed(() => {
    if (!currentPlayerId.value) return null
    const player = allPlayers.value.get(currentPlayerId.value)
    return player || null
  })
  
  const otherPlayers = computed(() => {
    if (!currentPlayerId.value) return []
    return Array.from(allPlayers.value.values())
      .filter(p => p.id !== currentPlayerId.value)  
  })
  
  const playersInCurrentRoom = computed(() => {
    const currentRoomId = currentPlayer.value?.joinedRoomId
    return currentRoomId 
      ? Array.from(allPlayers.value.values()).filter(p => 
          p.joinedRoomId === currentRoomId
        )
      : []
  })

  // 添加玩家
  function addPlayer(player: PlayerData): void {
    const existing = allPlayers.value.get(player.id)
    if (existing) {
      // 如果玩家已存在，合并状态
      const mergedPlayer = {
        ...existing,
        ...player,
        gameState: { ...existing.gameState, ...player.gameState }
      }
      allPlayers.value.set(player.id, mergedPlayer)
    } else {
      allPlayers.value.set(player.id, player)
    }
  }

  // 更新玩家连接状态
  function updatePlayerConnection(id: string, connected: boolean): void {
    const player = allPlayers.value.get(id)
    if (player) {
      allPlayers.value.set(id, { ...player, isConnected: connected })
    }
  }

  // 设置当前玩家
  function setCurrentPlayer(id: string, playerInfo?: Partial<Omit<PlayerData, 'id'>>): void {
    currentPlayerId.value = id
    
    if (playerInfo) {
      addPlayer({ id, ...playerInfo } as PlayerData)
    }
  }

  // 添加其他玩家
  function addPeerPlayer(peer: PlayerInfo): void {
    const existing = allPlayers.value.get(peer.id)
    if (existing) return
    
    allPlayers.value.set(peer.id, {
      ...peer,
      gameState: {
        currentShipId: null,
        hasActivatedFluxVenting: false,
        readyForNextPhase: false,
        selectedWeapons: []
      },
      isConnected: true,
      isReady: false,
      joinedRoomId: null
    })
  }

  // 移除玩家
  function removePlayer(id: string): void {
    allPlayers.value.delete(id)
    if (currentPlayerId.value === id) {
      currentPlayerId.value = null
    }
  }

  // 更新玩家就绪状态
  function setPlayerReady(id: string, ready: boolean): void {
    const player = allPlayers.value.get(id)
    if (player) {
      allPlayers.value.set(id, { ...player, isReady: ready })
    }
  }

  // 更新房间ID
  function setPlayerRoom(id: string, roomId: string | null): void {
    const player = allPlayers.value.get(id)
    if (player) {
      allPlayers.value.set(id, { ...player, joinedRoomId: roomId })
    }
  }

  // 更新玩家的游戏状态
  function updatePlayerGameState(id: string, gameState: Partial<PlayerGameState>) {
    const player = allPlayers.value.get(id)
    if (player) {
      allPlayers.value.set(id, { 
        ...player, 
        gameState: { ...player.gameState, ...gameState }
      })
    }
  }

  // 重置指定房间内所有玩家的状态
  function resetRoomPlayers(roomId: string): void {
    const toUpdate: PlayerData[] = []
    
    allPlayers.value.forEach(player => {
      if (player.joinedRoomId === roomId) {
        toUpdate.push({
          ...player,
          gameState: {
            currentShipId: null,
            hasActivatedFluxVenting: false,
            readyForNextPhase: false,
            selectedWeapons: []
          },
          isReady: false
        })
      }
    })
    
    // 批量更新
    toUpdate.forEach(p => allPlayers.value.set(p.id, p))
  }

  return {
    allPlayers,
    currentPlayerId,
    currentPlayer,
    otherPlayers,
    playersInCurrentRoom,
    addPlayer,
    updatePlayerConnection,
    setCurrentPlayer,
    addPeerPlayer,
    removePlayer,
    setPlayerReady,
    setPlayerRoom,
    updatePlayerGameState,
    resetRoomPlayers
  }
})