<template>
  <div class="ship-info-card" v-if="ship">
    <div class="card-header">
      <h3>{{ ship.id }}</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    
    <div class="card-content">
      <div class="stat-section">
        <div class="stat-label">Hull</div>
        <div class="stat-bar">
          <div class="stat-fill hull" :style="{ width: hullPercent + '%' }"></div>
          <span class="stat-value">{{ ship.hull.current }}/{{ ship.hull.max }}</span>
        </div>
      </div>
      
      <div class="stat-section">
        <div class="stat-label">Armor</div>
        <div class="armor-grid">
          <div
            v-for="(value, quadrant) in ship.armor.quadrants"
            :key="quadrant"
            class="armor-cell"
            :class="{ damaged: value < ship.armor.maxArmor }"
          >
            <span class="armor-quadrant">{{ quadrantShort(quadrant) }}</span>
            <span class="armor-value">{{ value }}</span>
          </div>
        </div>
      </div>
      
      <FluxIndicator :flux="ship.flux" :flux-state="ship.fluxState" />
      
      <div class="shield-section" v-if="ship.shield.active">
        <div class="stat-label">Shield</div>
        <div class="shield-info">
          <span class="shield-type">{{ ship.shield.type }}</span>
          <span class="shield-efficiency">{{ (ship.shield.efficiency * 100).toFixed(0) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ShipStatus, ArmorQuadrant } from '@vt/shared'
import FluxIndicator from '../ship/FluxIndicator.vue'

interface Props {
  ship: ShipStatus
}

const props = defineProps<Props>()
defineEmits<{
  close: []
}>()

const hullPercent = computed(() => {
  return (props.ship.hull.current / props.ship.hull.max) * 100
})

function quadrantShort(quadrant: ArmorQuadrant): string {
  const map: Record<ArmorQuadrant, string> = {
    'front_left': 'FL',
    'front_right': 'FR',
    'left': 'L',
    'right': 'R',
    'rear_left': 'RL',
    'rear_right': 'RR'
  }
  return map[quadrant]
}
</script>

<style scoped>
.ship-info-card {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 280px;
  background: rgba(10, 10, 30, 0.95);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 8px;
  z-index: 50;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(100, 100, 150, 0.2);
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  color: #aaccff;
}

.close-btn {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: #8899aa;
  font-size: 20px;
  cursor: pointer;
}

.close-btn:hover {
  color: #ff4444;
}

.card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 12px;
  color: #8899aa;
  text-transform: uppercase;
}

.stat-bar {
  position: relative;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.stat-fill.hull {
  background: linear-gradient(90deg, #44ff44, #88ff88);
}

.stat-value {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #ffffff;
}

.armor-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 4px;
}

.armor-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  background: rgba(40, 40, 80, 0.5);
  border-radius: 4px;
}

.armor-cell.damaged {
  background: rgba(80, 40, 40, 0.5);
}

.armor-quadrant {
  font-size: 10px;
  color: #667788;
}

.armor-value {
  font-size: 14px;
  color: #aaccff;
  font-weight: bold;
}

.shield-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shield-info {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: rgba(40, 80, 120, 0.3);
  border-radius: 4px;
}

.shield-type {
  font-size: 12px;
  color: #88ccff;
  text-transform: capitalize;
}

.shield-efficiency {
  font-size: 12px;
  color: #88ff88;
}
</style>