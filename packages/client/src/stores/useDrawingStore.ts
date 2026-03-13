import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type DrawingTool = 'pen' | 'line' | 'arrow' | 'rect' | 'circle' | 'eraser'

export interface DrawingElement {
  id?: string
  type: 'path' | 'line' | 'arrow' | 'rect' | 'circle'
  color: string
  lineWidth: number
  path?: string
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  cx?: number
  cy?: number
  radius?: number
}

type OnElementAddedCallback = (element: DrawingElement) => void
type OnClearCallback = () => void

export const useDrawingStore = defineStore('drawing', () => {
  const elements = ref<DrawingElement[]>([])
  const currentTool = ref<DrawingTool>('pen')
  const currentColor = ref('#ff4444')
  const lineWidth = ref(2)
  const isActive = ref(false)
  const isDrawing = ref(false)
  const startPoint = ref<{ x: number; y: number } | null>(null)
  const currentPath = ref<{ x: number; y: number }[]>([])
  const onElementAddedCallback = ref<OnElementAddedCallback | null>(null)
  const onClearCallback = ref<OnClearCallback | null>(null)

  const canUndo = computed(() => elements.value.length > 0)

  function setOnElementAdded(callback: OnElementAddedCallback): void {
    onElementAddedCallback.value = callback
  }

  function setOnClear(callback: OnClearCallback): void {
    onClearCallback.value = callback
  }

  function setTool(tool: DrawingTool): void {
    currentTool.value = tool
    isActive.value = tool !== 'eraser'
  }

  function setColor(color: string): void {
    currentColor.value = color
  }

  function setLineWidth(width: number): void {
    lineWidth.value = width
  }

  function generateId(): string {
    return `draw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  function startDrawing(x: number, y: number): void {
    isDrawing.value = true
    startPoint.value = { x, y }
    
    if (currentTool.value === 'pen') {
      currentPath.value = [{ x, y }]
    }
  }

  function continueDrawing(x: number, y: number): void {
    if (!isDrawing.value || !startPoint.value) return

    if (currentTool.value === 'pen') {
      currentPath.value.push({ x, y })
    }
  }

  function finishDrawing(): DrawingElement | null {
    if (!isDrawing.value || !startPoint.value) {
      isDrawing.value = false
      return null
    }

    const lastPoint = currentPath.value.length > 0 
      ? currentPath.value[currentPath.value.length - 1]
      : startPoint.value

    let newElement: DrawingElement | null = null

    if (currentTool.value === 'pen' && currentPath.value.length > 1) {
      const pathString = currentPath.value
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ')
      
      newElement = {
        id: generateId(),
        type: 'path',
        color: currentColor.value,
        lineWidth: lineWidth.value,
        path: pathString
      }
    } else if (currentTool.value === 'line' && lastPoint) {
      newElement = {
        id: generateId(),
        type: 'line',
        color: currentColor.value,
        lineWidth: lineWidth.value,
        x1: startPoint.value.x,
        y1: startPoint.value.y,
        x2: lastPoint.x,
        y2: lastPoint.y
      }
    } else if (currentTool.value === 'arrow' && lastPoint) {
      newElement = {
        id: generateId(),
        type: 'arrow',
        color: currentColor.value,
        lineWidth: lineWidth.value,
        x1: startPoint.value.x,
        y1: startPoint.value.y,
        x2: lastPoint.x,
        y2: lastPoint.y
      }
    } else if (currentTool.value === 'rect' && lastPoint) {
      newElement = {
        id: generateId(),
        type: 'rect',
        color: currentColor.value,
        lineWidth: lineWidth.value,
        x1: startPoint.value.x,
        y1: startPoint.value.y,
        x2: lastPoint.x,
        y2: lastPoint.y
      }
    } else if (currentTool.value === 'circle' && lastPoint) {
      const dx = lastPoint.x - startPoint.value.x
      const dy = lastPoint.y - startPoint.value.y
      const radius = Math.sqrt(dx * dx + dy * dy)
      
      newElement = {
        id: generateId(),
        type: 'circle',
        color: currentColor.value,
        lineWidth: lineWidth.value,
        cx: startPoint.value.x,
        cy: startPoint.value.y,
        radius
      }
    }

    if (newElement) {
      elements.value.push(newElement)
      if (onElementAddedCallback.value) {
        onElementAddedCallback.value(newElement)
      }
    }

    isDrawing.value = false
    startPoint.value = null
    currentPath.value = []
    
    return newElement
  }

  function undo(): void {
    if (elements.value.length > 0) {
      elements.value.pop()
    }
  }

  function clear(): void {
    elements.value = []
    if (onClearCallback.value) {
      onClearCallback.value()
    }
  }

  function addElement(element: DrawingElement): void {
    if (!element.id) {
      element.id = generateId()
    }
    elements.value.push(element)
  }

  function setElements(newElements: DrawingElement[]): void {
    elements.value = newElements
  }

  return {
    elements,
    currentTool,
    currentColor,
    lineWidth,
    isActive,
    isDrawing,
    canUndo,
    setOnElementAdded,
    setOnClear,
    setTool,
    setColor,
    setLineWidth,
    startDrawing,
    continueDrawing,
    finishDrawing,
    undo,
    clear,
    addElement,
    setElements
  }
})