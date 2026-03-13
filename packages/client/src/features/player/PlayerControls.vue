<template>
  <div class="player-controls">
    <div class="controls-info">
      <div class="current-player">
        <div v-if="currentPlayer" class="player-indicator">
          <div class="avatar">
            <span class="initial">{{ getPlayerInitials(currentPlayer.name) }}</span>
          </div>
          <div class="info">
            <div class="name">{{ currentPlayer.name }}</div>
            <div class="status">
              <span class="status-dot" :class="'status-' + (currentPlayer.isReady ? 'ready' : 'ingame')" />
              <span class="status-text">{{ currentPlayer.isReady ? 'Ready' : 'In Game' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-ready" :class="{ active: currentPlayer?.isReady }" @click="toggleReady">
          {{ currentPlayer?.isReady ? 'Ready' : 'Not Ready' }}
        </button>
        <button class="btn-end-turn" @click="endTurn">End Turn</button>
      </div>
    </div>
    
    <div class="player-status">
      <div class="status-item">
        <span class="status-label">Ship:</span>
        <span class="status-value">{{ currentState?.currentShipId || 'None' }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Phase:</span>
        <span class="status-value">{{ currentState?.gamePhase || 'Waiting' }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Flux Venting:</span>
        <span class="status-value" :class="{ active: currentState?.fluxVentingActive }">
          {{ currentState?.fluxVentingActive ? 'ON' : 'OFF' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getPlayerInitials } from './playerUtils'
import { playerManager } from './MPManager'

const emit = defineEmits<{
  endTurn: []
}>()

// 使用多玩家协调系统
const currentPlayer = computed(() => playerManager.getCurrentPlayer())
const currentState = computed(() => currentPlayer.value)

function toggleReady(): void {
  if (currentPlayer.value) {
    const updatedReady = !currentPlayer.value.isReady
    playerManager.updatePlayer(currentPlayer.value.id, { isReady: updatedReady })
    // 通知父组件准备状态改变
  }
}

function endTurn(): void {
  // 通知父组件结束轮次
  emit('endTurn')
}
</script>

<style scoped>
.player-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  background: rgba(20, 20, 40, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(100, 100, 150, 0.3);
}

.controls-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.current-player {
  flex: 1;
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

.status-dot.status-ingame {
  background: #4a9eff;
}

.status-dot.status-ready {
  background: #ffaa44;
}

.status-text {
  color: #8899aa;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn-ready,
.btn-end-turn {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ready {
  background: rgba(60, 100, 150, 0.5);
  border-color: #4a9eff;
  color: #aaccff;
}

.btn-ready:hover {
  background: rgba(80, 120, 170, 0.6);
}

.btn-ready.active {
  background: rgba(150, 60, 60, 0.5);
  border-color: #ff4444;
  color: #ffaaaa;
}

.btn-end-turn {
  background: rgba(74, 158, 255, 0.2);
  border-color: #4a9eff;
  color: #aaccff;
}

.btn-end-turn:hover {
  background: rgba(80, 120, 170, 0.6);
}

.player-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(100, 100, 150, 0.2);
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.status-label {
  color: #8899aa;
  font-size: 12px;
}

.status-value {
  color: #c0c0d0;
  font-size: 12px;
  font-weight: 500;
}

.status-value.active {
  color: #ffaa44;
}
</style>