<template>
  <div class="room-panel">
    <div class="panel-header">
      <h3>Room</h3>
      <span class="room-id" v-if="currentRoomId">{{ currentRoomId }}</span>
    </div>
    
    <div class="player-list">
      <div class="list-header">
        <span>Players ({{ playerCount }})</span>
      </div>
      <div class="players-container">
        <div
          v-for="player in playersInRoom"
          :key="player.id"
          class="player-item"
          :class="{ self: isCurrentPlayer(player.id) }"
        >
          <span class="player-status" :class="getPlayerStatus(player)"></span>
          <span class="player-name">{{ player.name }}</span>
          <span v-if="isCurrentPlayer(player.id)" class="you-badge">You</span>
        </div>
      </div>
    </div>
    
    <div class="room-actions">
      <div v-if="!inRoom" class="join-form">
        <input v-model="roomIdInput" type="text" placeholder="Room ID" />
        <input v-model="playerNameInput" type="text" placeholder="Your Name" />
        <button class="btn-primary" @click="handleJoin" :disabled="!canJoin">Join Room</button>
      </div>
      <button v-else class="btn-danger" @click="handleLeave">Leave Room</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { playerManager } from '@/features/player/MPManager'

interface Props {
  inRoom?: boolean
  currentRoomId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  inRoom: false,
  currentRoomId: null
})

const emit = defineEmits<{
  'join-room': [roomId: string, playerName: string]
  'leave-room': []
}>()

const roomIdInput = ref('')
const playerNameInput = ref('')
const inRoomState = ref(props.inRoom)
const currentRoomIdState = ref(props.currentRoomId)

// Calculate players in current room
const playersInRoom = computed(() => {
  const currentRoom = currentRoomIdState.value
  if (!currentRoom) return []
  return playerManager.getPlayersInRoom(currentRoom)
})

const playerCount = computed(() => playersInRoom.value.length)

const canJoin = computed(() => {
  return roomIdInput.value.trim() && playerNameInput.value.trim()
})

function handleJoin(): void {
  if (canJoin.value) {
    const roomId = roomIdInput.value.trim()
    const playerName = playerNameInput.value.trim()
    
    currentRoomIdState.value = roomId
    inRoomState.value = true
    
    // Notify parent component
    emit('join-room', roomId, playerName)
  }
}

function handleLeave(): void {
  inRoomState.value = false
  currentRoomIdState.value = null
  
  emit('leave-room')
}

function isCurrentPlayer(playerId: string): boolean {
  const current = playerManager.getCurrentPlayer()
  return current ? current.id === playerId : false
}

function getPlayerStatus(player: any): string {
  if (!player.isConnected) return 'offline'
  if (player.isReady) return 'ready'
  return 'waiting'
}

defineExpose({
  addPlayer: (player: any) => console.log('Adding player:', player), // Temporary mock
  removePlayer: (playerId: string) => console.log('Removing player:', playerId), // Temporary mock
  currentRoomId: currentRoomIdState,
  currentPlayerId: computed(() => playerManager.getCurrentPlayer()?.id || null)
})
</script>

<style scoped>
.room-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #aaccff;
}

.room-id {
  font-size: 12px;
  color: #667788;
  background: rgba(40, 40, 80, 0.5);
  padding: 4px 8px;
  border-radius: 4px;
}

.player-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-header {
  font-size: 12px;
  color: #8899aa;
  margin-bottom: 8px;
}

.players-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
  flex: 1;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(30, 30, 60, 0.5);
  border-radius: 4px;
  margin-bottom: 4px;
}

.player-item.self {
  background: rgba(40, 60, 80, 0.5);
}

.player-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.player-status.ready {
  background: #44ff44;
}

.player-status.waiting {
  background: #ffaa44;
}

.player-status.offline {
  background: #667788;
}

.player-name {
  flex: 1;
  font-size: 14px;
}

.you-badge {
  font-size: 10px;
  color: #aaccff;
  background: rgba(74, 158, 255, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
}

.room-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.join-form input {
  padding: 10px;
  background: rgba(10, 10, 30, 0.8);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  color: #c0c0d0;
  font-size: 14px;
}

.join-form input::placeholder {
  color: #556677;
}

.btn-primary,
.btn-danger {
  padding: 10px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: rgba(60, 100, 150, 0.5);
  border-color: #4a9eff;
  color: #aaccff;
}

.btn-danger {
  background: rgba(150, 60, 60, 0.5);
  border-color: #ff4444;
  color: #ffaaaa;
}

.btn-primary:hover:not(:disabled),
.btn-danger:hover {
  filter: brightness(1.2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.players-container::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.players-container::-webkit-scrollbar-track {
  background: rgba(20, 20, 40, 0.5);
  border-radius: 2px;
}

.players-container::-webkit-scrollbar-thumb {
  background: rgba(60, 100, 150, 0.5);
  border-radius: 2px;
}
</style>