<template>
  <div class="player-indicator" :class="playerStateClass">
    <div class="avatar">
      <span class="initial">{{ getPlayerInitials(player.name) }}</span>
    </div>
    <div class="info">
      <div class="name">{{ player.name }}</div>
      <div class="status">
        <span class="status-dot" :class="'status-' + status.state" />
        <span class="status-text">{{ status.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getPlayerInitials } from './playerUtils'
import type { PlayerState } from './MPManager'

interface Props {
  player: PlayerState
  status?: 'online' | 'offline' | 'ingame' | 'ready' | 'away'
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  status: 'online',
  isActive: false
})

// 计算玩家状态和显示文本
const status = computed(() => {
  const playerState = props.player
  if (!playerState) return {state: 'unknown', text: 'Unknown'}
  
  // 优先考虑连接状态
  if (!playerState.isConnected) {
    return {state: 'offline', text: 'Offline'}
  }
  
  // 考虑就绪状态
  if (playerState.isReady) {
    return {state: 'ready', text: 'Ready'}
  }
  
  // 默认在线状态
  return {state: 'ingame', text: 'In Game'}
})

const playerStateClass = computed(() => ({
  'player-active': props.isActive,
  [`player-${status.value.state}`]: true
}))
</script>

<style scoped>
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

.status-dot.status-online {
  background: #44ff44;
}

.status-dot.status-offline {
  background: #667788;
}

.status-dot.status-ingame {
  background: #4a9eff;
}

.status-dot.status-ready {
  background: #ffaa44;
}

.status-dot.status-away {
  background: #8888ff;
}

.status-text {
  color: #8899aa;
}
</style>