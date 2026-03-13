<template>
  <div class="combat-log">
    <div class="log-header">
      <span>Combat Log</span>
    </div>
    <div class="log-content">
      <div
        v-for="(entry, index) in entries"
        :key="index"
        class="log-entry"
        :class="entry.type"
      >
        <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
        <span class="log-message">{{ entry.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface LogEntry {
  type: 'info' | 'damage' | 'hit' | 'miss' | 'system'
  message: string
  timestamp: number
}

const entries = ref<LogEntry[]>([
  { type: 'system', message: 'Combat phase started', timestamp: Date.now() - 120000 },
  { type: 'hit', message: 'Player 1 hits Player 2 with Autocannon', timestamp: Date.now() - 60000 },
  { type: 'damage', message: 'Player 2 takes 85 damage to front armor', timestamp: Date.now() - 59000 },
  { type: 'miss', message: 'Player 2 misses with Pulse Laser', timestamp: Date.now() - 30000 }
])

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.combat-log {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.log-header {
  padding: 12px;
  border-bottom: 1px solid rgba(100, 100, 150, 0.2);
  font-size: 14px;
  color: #aaccff;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.log-entry {
  padding: 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 12px;
}

.log-entry.info {
  background: rgba(40, 40, 80, 0.3);
  color: #aabbcc;
}

.log-entry.damage {
  background: rgba(80, 40, 40, 0.3);
  color: #ffaaaa;
}

.log-entry.hit {
  background: rgba(80, 80, 40, 0.3);
  color: #ffccaa;
}

.log-entry.miss {
  background: rgba(40, 60, 80, 0.3);
  color: #aaccff;
}

.log-entry.system {
  background: rgba(60, 60, 80, 0.3);
  color: #8899aa;
  font-style: italic;
}

.log-time {
  font-size: 10px;
  color: #556677;
  margin-right: 8px;
}

.log-message {
  word-break: break-word;
}
</style>