/**
 * Multiplayer Coordination Module
 * Follows Architecture.md and Spec.md guidelines for DDD frontend module structure
 */

export interface PlayerState {
  // Basic player attributes
  id: string
  name: string
  joinedAt: number
  
  // Connection state
  isConnected: boolean
  
  // Game state
  isReady: boolean
  gamePhase: 'lobby' | 'setup' | 'action1' | 'turn' | 'action2' | 'combat' | 'finished'
  currentShipId: string | null
  selectedTargets: string[]
  usedActions: number
  pendingActions: number
  
  // Room management
  roomId: string | null
  slotIndex: number
  
  // Gameplay flags
  hasActed: boolean
  fluxVentingActive: boolean
}

/**
 * Player manager service - manages player lifecycle and state synchronization
 */
class PlayerManager {
  // Store for all known players
  private players: Map<string, PlayerState> = new Map()
  private currentPlayerId: string | null = null
  private callbacks: {
    onPlayerJoined?: (player: PlayerState) => void
    onPlayerLeft?: (playerId: string) => void
    onPlayerReadyChanged?: (playerId: string, isReady: boolean) => void
    onPlayerStateChanged?: (playerId: string, newState: PlayerState) => void
  } = {}
  
  /**
   * Register a callback function
   */
  subscribe<T extends keyof typeof this.callbacks>(event: T, callback: (typeof this.callbacks)[T]) {
    this.callbacks[event] = callback
  }
  
  /**
   * Process a PLAYER_JOINED message from the server
   */
  handlePlayerJoined(playerData: { id: string; name: string; joinedAt: number; roomId?: string }): void {
    const newPlayerState: PlayerState = {
      id: playerData.id,
      name: playerData.name,
      joinedAt: playerData.joinedAt || Date.now(),
      isConnected: true,
      isReady: false,
      gamePhase: 'lobby',
      currentShipId: null,
      selectedTargets: [],
      usedActions: 0,
      pendingActions: 0,
      roomId: playerData.roomId || null,
      slotIndex: Array.from(this.players.values()).filter(p => p.roomId === playerData.roomId).length,
      hasActed: false,
      fluxVentingActive: false
    }
    
    this.players.set(newPlayerState.id, newPlayerState)
    
    if (this.callbacks.onPlayerJoined) {
      this.callbacks.onPlayerJoined(newPlayerState)
    }
  }
  
  /**
   * Process a PLAYER_LEFT message from the server
   */
  handlePlayerLeft(playerId: string): void {
    this.removePlayer(playerId)
  }
  
  /**
   * Add a new player to the game
   */
  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player)
    if (this.callbacks.onPlayerJoined) {
      this.callbacks.onPlayerJoined(player)
    }
  }
  
  /**
   * Remove a player from the game
   */
  removePlayer(playerId: string): void {
    if (this.players.has(playerId)) {
      this.players.delete(playerId)
      if (this.currentPlayerId === playerId) {
        this.currentPlayerId = null
      }
      if (this.callbacks.onPlayerLeft) {
        this.callbacks.onPlayerLeft(playerId)
      }
    }
  }
  
  /**
   * Update a player's state
   */
  updatePlayer(playerId: string, stateChanges: Partial<PlayerState>): void {
    const player = this.players.get(playerId)
    if (player) {
      const isReadyChange = 'isReady' in stateChanges && stateChanges.isReady !== player.isReady
      const newState = { ...player, ...stateChanges }
      this.players.set(playerId, newState)
      
      // Trigger callbacks
      if (isReadyChange && this.callbacks.onPlayerReadyChanged) {
        this.callbacks.onPlayerReadyChanged(playerId, newState.isReady!)
      }
      if (this.callbacks.onPlayerStateChanged) {
        this.callbacks.onPlayerStateChanged(playerId, newState)
      }
    }
  }
  
  /**
   * Get all players in a specific room
   */
  getPlayersInRoom(roomId: string): PlayerState[] {
    return Array.from(this.players.values()).filter(p => p.roomId === roomId)
  }
  
  /**
   * Get player by ID
   */
  getPlayerById(playerId: string): PlayerState | undefined {
    return this.players.get(playerId)
  }
  
  /**
   * Set the current player
   */
  setCurrentPlayer(playerId: string): void {
    this.currentPlayerId = playerId
  }
  
  /**
   * Get the current player
   */
  getCurrentPlayer(): PlayerState | null {
    if (!this.currentPlayerId) return null
    return this.players.get(this.currentPlayerId) || null
  }
  
  /**
   * Get other players in current room
   */
  getOtherPlayers(): PlayerState[] {
    const currentRoom = this.getCurrentPlayer()?.roomId
    if (!currentRoom) return []
    
    return Array.from(this.players.values())
      .filter(p => p.roomId === currentRoom && p.id !== this.currentPlayerId)
  }
  
  /**
   * Check readiness of all players in room
   */
  getAllPlayersReady(): boolean {
    const currentRoom = this.getCurrentPlayer()?.roomId
    if (!currentRoom) return false
    
    const players = this.getPlayersInRoom(currentRoom)
    return players.every(p => p.isReady && p.isConnected)
  }
  
  /**
   * Reset player state for new round
   */
  resetRoundState(roomId: string): void {
    const players = this.getPlayersInRoom(roomId)
    for (const player of players) {
      this.updatePlayer(player.id, {
        isReady: false,
        hasActed: false,
        selectedTargets: [],
        usedActions: 0,
        pendingActions: 0
      })
    }
  }
  
  /**
   * Get all connected players in room
   */
  getConnectedPlayers(roomId: string): PlayerState[] {
    return this.getPlayersInRoom(roomId).filter(p => p.isConnected)
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.players.clear()
    this.currentPlayerId = null
    this.callbacks = {}
  }
}

// Singleton instance
export const playerManager = new PlayerManager()

// Export utility types
export type { 
  PlayerManager 
}