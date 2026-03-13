<template>
  <svg class="drawing-overlay" ref="svgRef">
    <g v-for="(element, index) in elements" :key="index">
      <path
        v-if="element.type === 'path'"
        :d="element.path"
        :stroke="element.color"
        :stroke-width="element.lineWidth || 2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <line
        v-else-if="element.type === 'line'"
        :x1="element.x1 ?? 0"
        :y1="element.y1 ?? 0"
        :x2="element.x2 ?? 0"
        :y2="element.y2 ?? 0"
        :stroke="element.color"
        :stroke-width="element.lineWidth || 2"
      />
      <line
        v-else-if="element.type === 'arrow'"
        :x1="element.x1 ?? 0"
        :y1="element.y1 ?? 0"
        :x2="element.x2 ?? 0"
        :y2="element.y2 ?? 0"
        :stroke="element.color"
        :stroke-width="element.lineWidth || 2"
        marker-end="url(#arrowhead)"
      />
      <rect
        v-else-if="element.type === 'rect'"
        :x="Math.min(element.x1 ?? 0, element.x2 ?? 0)"
        :y="Math.min(element.y1 ?? 0, element.y2 ?? 0)"
        :width="Math.abs((element.x2 ?? 0) - (element.x1 ?? 0))"
        :height="Math.abs((element.y2 ?? 0) - (element.y1 ?? 0))"
        :stroke="element.color"
        :stroke-width="element.lineWidth || 2"
        fill="none"
      />
      <circle
        v-else-if="element.type === 'circle'"
        :cx="element.cx ?? 0"
        :cy="element.cy ?? 0"
        :r="element.radius ?? 0"
        :stroke="element.color"
        :stroke-width="element.lineWidth || 2"
        fill="none"
      />
    </g>
    
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
      </marker>
    </defs>
  </svg>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useDrawingStore } from '@/stores/useDrawingStore'

const svgRef = ref<SVGSVGElement | null>(null)
const drawingStore = useDrawingStore()

const elements = computed(() => drawingStore.elements)

function handleMouseDown(e: MouseEvent): void {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  drawingStore.startDrawing(x, y)
}

function handleMouseMove(e: MouseEvent): void {
  if (!svgRef.value || !drawingStore.isDrawing) return
  const rect = svgRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  drawingStore.continueDrawing(x, y)
}

function handleMouseUp(): void {
  drawingStore.finishDrawing()
}

onMounted(() => {
  if (svgRef.value) {
    svgRef.value.addEventListener('mousedown', handleMouseDown)
    svgRef.value.addEventListener('mousemove', handleMouseMove)
    svgRef.value.addEventListener('mouseup', handleMouseUp)
    svgRef.value.addEventListener('mouseleave', handleMouseUp)
  }
})

onBeforeUnmount(() => {
  if (svgRef.value) {
    svgRef.value.removeEventListener('mousedown', handleMouseDown)
    svgRef.value.removeEventListener('mousemove', handleMouseMove)
    svgRef.value.removeEventListener('mouseup', handleMouseUp)
    svgRef.value.removeEventListener('mouseleave', handleMouseUp)
  }
})
</script>

<style scoped>
.drawing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 100;
}
</style>