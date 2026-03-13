<template>
  <div class="weapon-toolbar">
    <div class="weapon-list">
      <div
        v-for="weapon in weapons"
        :key="weapon.id"
        class="weapon-item"
        :class="{ selected: selectedWeaponId === weapon.id, disabled: weapon.disabled }"
        @click="selectWeapon(weapon.id)"
      >
        <div class="weapon-icon">
          <span class="weapon-type">{{ weapon.type?.[0]?.toUpperCase() ?? '?' }}</span>
        </div>
        <div class="weapon-info">
          <span class="weapon-name">{{ weapon.name }}</span>
          <span class="weapon-range">{{ weapon.range }}u</span>
        </div>
        <div class="weapon-status">
          <span v-if="weapon.disabled" class="status-disabled">DISABLED</span>
          <span v-else-if="weapon.cooldown > 0" class="status-cooldown">{{ weapon.cooldown }}s</span>
          <span v-else class="status-ready">READY</span>
        </div>
      </div>
    </div>
    
    <button class="fire-btn" :disabled="!selectedWeaponId" @click="fireWeapon">
      Fire
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Weapon {
  id: string
  name: string
  type: 'ballistic' | 'energy' | 'missile'
  range: number
  damage: number
  cooldown: number
  disabled: boolean
}

const selectedWeaponId = ref<string | null>(null)

const weapons = ref<Weapon[]>([
  { id: 'w1', name: 'Autocannon', type: 'ballistic', range: 800, damage: 100, cooldown: 0, disabled: false },
  { id: 'w2', name: 'Pulse Laser', type: 'energy', range: 600, damage: 150, cooldown: 2, disabled: false },
  { id: 'w3', name: 'Harpoon MRM', type: 'missile', range: 1200, damage: 200, cooldown: 0, disabled: true }
])

function selectWeapon(id: string): void {
  const weapon = weapons.value.find(w => w.id === id)
  if (weapon && !weapon.disabled) {
    selectedWeaponId.value = selectedWeaponId.value === id ? null : id
  }
}

function fireWeapon(): void {
  if (selectedWeaponId.value) {
    console.log('Firing weapon:', selectedWeaponId.value)
  }
}
</script>

<style scoped>
.weapon-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.weapon-list {
  display: flex;
  gap: 8px;
  flex: 1;
}

.weapon-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(40, 40, 80, 0.5);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.weapon-item:hover:not(.disabled) {
  background: rgba(60, 60, 100, 0.5);
}

.weapon-item.selected {
  background: rgba(60, 100, 150, 0.5);
  border-color: #4a9eff;
}

.weapon-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.weapon-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 20, 40, 0.8);
  border-radius: 4px;
}

.weapon-type {
  font-size: 14px;
  font-weight: bold;
  color: #aaccff;
}

.weapon-info {
  display: flex;
  flex-direction: column;
}

.weapon-name {
  font-size: 12px;
  color: #aaccff;
}

.weapon-range {
  font-size: 10px;
  color: #667788;
}

.weapon-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-ready {
  background: rgba(68, 255, 68, 0.2);
  color: #88ff88;
}

.status-cooldown {
  background: rgba(255, 170, 68, 0.2);
  color: #ffaa88;
}

.status-disabled {
  background: rgba(255, 68, 68, 0.2);
  color: #ff8888;
}

.fire-btn {
  padding: 10px 24px;
  background: rgba(150, 60, 60, 0.5);
  border: 1px solid #ff4444;
  border-radius: 4px;
  color: #ffaaaa;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.fire-btn:hover:not(:disabled) {
  background: rgba(180, 80, 80, 0.6);
}

.fire-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>