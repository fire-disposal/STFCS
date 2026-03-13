<template>
  <div class="drawing-toolbar">
    <div class="tool-group">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="tool-btn"
        :class="{ active: currentTool === tool.id }"
        :title="tool.name"
        @click="selectTool(tool.id)"
      >
        <span class="tool-icon">{{ tool.icon }}</span>
      </button>
    </div>
    
    <div class="color-group">
      <button
        v-for="color in colors"
        :key="color"
        class="color-btn"
        :style="{ background: color }"
        :class="{ active: currentColor === color }"
        @click="selectColor(color)"
      />
    </div>
    
    <div class="action-group">
      <button class="action-btn" @click="undo" title="Undo">↶</button>
      <button class="action-btn" @click="clear" title="Clear All">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDrawingStore, type DrawingTool } from '@/stores/useDrawingStore'

const emit = defineEmits<{
  clear: []
}>()

const drawingStore = useDrawingStore()

const tools: { id: DrawingTool; name: string; icon: string }[] = [
  { id: 'pen', name: 'Pen', icon: '✎' },
  { id: 'line', name: 'Line', icon: '/' },
  { id: 'arrow', name: 'Arrow', icon: '→' },
  { id: 'rect', name: 'Rectangle', icon: '□' },
  { id: 'circle', name: 'Circle', icon: '○' },
  { id: 'eraser', name: 'Eraser', icon: '⌫' }
]

const colors = ['#ff4444', '#ffaa44', '#ffff44', '#44ff44', '#44ffff', '#4488ff', '#ff44ff', '#ffffff']

const currentTool = ref<DrawingTool>('pen')
const currentColor = ref<string>('#ff4444')

function selectTool(toolId: DrawingTool): void {
  currentTool.value = toolId
  drawingStore.setTool(toolId)
}

function selectColor(color: string): void {
  currentColor.value = color
  drawingStore.setColor(color)
}

function undo(): void {
  drawingStore.undo()
}

function clear(): void {
  drawingStore.clear()
  emit('clear')
}
</script>

<style scoped>
.drawing-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px;
  background: rgba(30, 30, 60, 0.5);
  border-radius: 8px;
}

.tool-group {
  display: flex;
  gap: 4px;
}

.tool-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(40, 40, 80, 0.5);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  color: #aabbcc;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(60, 60, 100, 0.5);
}

.tool-btn.active {
  background: rgba(60, 100, 150, 0.5);
  border-color: #4a9eff;
  color: #aaccff;
}

.tool-icon {
  font-size: 16px;
}

.color-group {
  display: flex;
  gap: 4px;
}

.color-btn {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #ffffff;
}

.action-group {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(40, 40, 80, 0.5);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  color: #aabbcc;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(60, 60, 100, 0.5);
}
</style>