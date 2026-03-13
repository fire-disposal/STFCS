<template>
  <div class="player-list">
    <div class="list-header">
      <h4>Players</h4>
      <span class="count">({{ currentPlayers.length }})</span>
    </div>
    
    <div class="player-items">
      <div 
        v-for="player in currentPlayers" 
        :key="player.id"
        class="player-indicator"
        :class="{ 'player-active': isActive(player.id) }"
      >
        <div class="avatar">
          <span class="initial">{{ getPlayerInitials(player.name) }}</span>
        </div>
        <div class="info">
          <div class="name">{{ player.name }}</div>
          <div class="status">
            <span class="status-dot" :class="'status-' + playerStatus(player)" />
            <span class="status-text">{{ statusText(player) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getPlayerInitials } from './playerUtils'
import { playerManager } from './MPManager'

interface Props {
  currentPlayerId?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentPlayerId: undefined
})

const currentPlayers = computed(() => {
  const currentPlayer = playerManager.getCurrentPlayer()
  if (currentPlayer?.roomId) {
    return playerManager.getPlayersInRoom(currentPlayer.roomId)
  }
  return []
})

function isActive(playerId: string): boolean {
  return props.currentPlayerId ? playerId === props.currentPlayerId : false
}

function playerStatus(player: any): string {
  if (player.isConnected) {
    return player.isReady ? 'ready' : 'ingame'
  }
  return 'offline'
}

function statusText(player: any): string {
  if (!player.isConnected) return 'Offline'
  if (player.isReady) return 'Ready'
  return 'Connected'
}

defineExpose({
  currentPlayers
})
</script>

<style scoped>
.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  color: #aaccff;
  border-bottom: 1px solid rgba(100, 100, 150, 0.2);
}

.list-header h4 {
  margin: 0;
  font-size: 14px;
}

.count {
  font-size: 10px;
  color: #667788;
  background: rgba(40, 40, 80, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
}

.player-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(30, 30, 60, 0.5);
  border: 1px solid transparent;
}

.player-indicator.player-active {
  border-color: #4a9eff;
  background: rgba(40, 60, 100, 0.3);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(60, 100, 150, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: #aaccff;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.name {
  font-size: 12px;
  color: #c0c0d0;
  font-weight: 500;
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8899aa;
}

.status-dot.status-connection {
  background: #44ff44;
}

.status-dot.status-ready {
  background: #ffaa44;
}

.status-dot.status-ingame {
  background: #4a9eff;
}

.status-dot.status-offline {
  background: #667788;
}

.status-text {
  color: #8899aa;
}

.player-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.player-items::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.player-items::-webkit-scrollbar-track {
  background: rgba(20, 20, 40, 0.5);
  border-radius: 2px;
}

.player-items::-webkit-scrollbar-thumb {
  background: rgba(60, 100, 150, 0.5);
  border-radius: 2px;
}
</style>