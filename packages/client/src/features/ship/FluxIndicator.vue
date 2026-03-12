<template>
  <div class="flux-indicator" :class="{ 'overloaded': isOverloaded, 'venting': isVenting }">
    <div class="flux-header">
      <span class="flux-label">FLUX</span>
      <span class="flux-value">{{ flux.current }}/{{ flux.capacity }}</span>
    </div>

    <div class="flux-bar-container">
      <div
        v-motion
        class="flux-bar-fill"
        :class="fluxBarClass"
        :initial="{ width: '0%' }"
        :enter="{ width: `${fluxPercent}%` }"
        :transition="{ duration: 300, ease: 'easeOut' }"
      />
      <div class="flux-bar-threshold" :style="{ left: `${thresholdPercent}%` }" />
    </div>

    <div class="flux-details">
      <div class="flux-type">
        <span class="soft-flux" :class="{ active: flux.softFlux > 0 }">
          SOFT: {{ Math.round(flux.softFlux) }}
        </span>
        <span class="hard-flux" :class="{ active: flux.hardFlux > 0 }">
          HARD: {{ Math.round(flux.hardFlux) }}
        </span>
      </div>
      <div class="flux-dissipation">
        DISSIPATION: {{ flux.dissipation }}/s
      </div>
    </div>

    <Transition name="warning" mode="out-in">
      <div v-if="isOverloaded || isVenting" class="flux-warning" :class="warningClass">
        <span class="warning-icon">⚠</span>
        <span class="warning-text">{{ warningText }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FluxState, FluxOverloadState } from '@vt/shared'

interface Props {
  flux: FluxState
  fluxState?: FluxOverloadState
}

const props = withDefaults(defineProps<Props>(), {
  fluxState: 'normal'
})

const fluxPercent = computed(() => {
  return Math.min(100, (props.flux.current / props.flux.capacity) * 100)
})

const thresholdPercent = computed(() => {
  return 75
})

const isOverloaded = computed(() => {
  return props.fluxState === 'overloaded' || props.flux.current >= props.flux.capacity
})

const isVenting = computed(() => {
  return props.fluxState === 'venting'
})

const warningText = computed(() => {
  if (isOverloaded.value) return 'FLUX OVERLOAD - SYSTEMS DISABLED'
  if (isVenting.value) return 'VENTING FLUX - REDUCE OUTPUT'
  return ''
})

const warningClass = computed(() => {
  if (isOverloaded.value) return 'overloaded'
  if (isVenting.value) return 'venting'
  return ''
})

const fluxBarClass = computed(() => {
  if (isOverloaded.value) return 'overload'
  if (isVenting.value) return 'venting'
  if (fluxPercent.value >= 75) return 'high'
  if (fluxPercent.value >= 50) return 'medium'
  return 'low'
})
</script>

<style scoped>
.flux-indicator {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(10, 10, 30, 0.9);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  min-width: 200px;
}

.flux-indicator.overloaded {
  border-color: #ff4444;
  box-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
  animation: pulse-red 0.5s ease-in-out infinite;
}

.flux-indicator.venting {
  border-color: #ffff44;
  box-shadow: 0 0 10px rgba(255, 255, 68, 0.3);
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 20px rgba(255, 68, 68, 0.5); }
  50% { box-shadow: 0 0 40px rgba(255, 68, 68, 0.8); }
}

.flux-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: bold;
  color: #aaccff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.flux-bar-container {
  position: relative;
  height: 16px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.flux-bar-fill {
  height: 100%;
  transition: background-color 0.3s ease;
}

.flux-bar-fill.low {
  background: linear-gradient(90deg, #44ff44, #88ff88);
}

.flux-bar-fill.medium {
  background: linear-gradient(90deg, #ffff44, #ffdd44);
}

.flux-bar-fill.high {
  background: linear-gradient(90deg, #ffaa44, #ff6644);
}

.flux-bar-fill.venting {
  background: linear-gradient(90deg, #ff6600, #ff4400);
  animation: pulse-vent 0.3s ease-in-out infinite;
}

.flux-bar-fill.overload {
  background: linear-gradient(90deg, #ff4444, #cc0000);
  animation: pulse-overload 0.2s ease-in-out infinite;
}

@keyframes pulse-vent {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pulse-overload {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.flux-bar-threshold {
  position: absolute;
  top: 0;
  left: 75%;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
}

.flux-details {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #8899aa;
  text-transform: uppercase;
}

.flux-type {
  display: flex;
  gap: 12px;
}

.soft-flux {
  color: #4488ff;
}

.soft-flux.active {
  color: #88bbff;
  font-weight: bold;
}

.hard-flux {
  color: #ff4444;
}

.hard-flux.active {
  color: #ff8888;
  font-weight: bold;
}

.flux-dissipation {
  color: #88cc88;
}

.flux-warning {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.flux-warning.overloaded {
  background: rgba(255, 68, 68, 0.3);
  color: #ffaaaa;
}

.flux-warning.venting {
  background: rgba(255, 255, 68, 0.2);
  color: #ffffaa;
}

.warning-icon {
  font-size: 14px;
}

.warning-enter-active,
.warning-leave-active {
  transition: all 0.3s ease;
}

.warning-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.warning-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
