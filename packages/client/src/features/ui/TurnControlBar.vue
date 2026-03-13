<template>
  <div class="turn-control-bar">
    <div class="turn-info">
      <span class="turn-label">Turn</span>
      <span class="turn-number">{{ turnNumber }}</span>
    </div>
    
    <div class="phase-indicator">
      <div
        v-for="(phase, index) in phases"
        :key="index"
        class="phase-item"
        :class="{ active: currentPhase === index, completed: index < currentPhase }"
      >
        <span class="phase-name">{{ phase }}</span>
      </div>
    </div>
    
    <div class="player-turn">
      <span class="player-label">{{ currentPlayerName }}'s Turn</span>
    </div>
    
    <button class="end-turn-btn" @click="endTurn" :disabled="!canEndTurn">
      End Turn
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const turnNumber = ref(1)
const currentPhase = ref(0)
const currentPlayerName = ref('Player 1')
const canEndTurn = ref(true)

const phases = ['Move 1', 'Turn', 'Move 2', 'Combat', 'End']

function endTurn(): void {
  if (currentPhase.value < phases.length - 1) {
    currentPhase.value++
  } else {
    currentPhase.value = 0
    turnNumber.value++
  }
}
</script>

<style scoped>
.turn-control-bar {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  gap: 24px;
}

.turn-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.turn-label {
  font-size: 10px;
  color: #8899aa;
  text-transform: uppercase;
}

.turn-number {
  font-size: 24px;
  font-weight: bold;
  color: #aaccff;
}

.phase-indicator {
  display: flex;
  gap: 8px;
  flex: 1;
}

.phase-item {
  padding: 6px 12px;
  background: rgba(40, 40, 80, 0.5);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  font-size: 12px;
  color: #667788;
}

.phase-item.active {
  background: rgba(60, 100, 150, 0.5);
  border-color: #4a9eff;
  color: #aaccff;
}

.phase-item.completed {
  background: rgba(60, 100, 80, 0.3);
  border-color: #44aa66;
  color: #88cc88;
}

.player-turn {
  font-size: 14px;
  color: #aaccff;
}

.end-turn-btn {
  padding: 8px 24px;
  background: rgba(60, 100, 150, 0.5);
  border: 1px solid #4a9eff;
  border-radius: 4px;
  color: #aaccff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.end-turn-btn:hover:not(:disabled) {
  background: rgba(80, 120, 170, 0.6);
}

.end-turn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>