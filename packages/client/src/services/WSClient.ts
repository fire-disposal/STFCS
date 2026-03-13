import type { IWSClient, WSMessage, WSMessageType, WSMessage as SharedWSMessage } from '@vt/shared'
import { useShipStore } from '@/stores/useShipStore'
import { useCombatStore } from '@/stores/useCombatStore'
import { useDrawingStore } from '@/stores/useDrawingStore'
import { useChatStore } from '@/stores/useChatStore'

let shipStoreInstance: ReturnType<typeof useShipStore> | null = null
let combatStoreInstance: ReturnType<typeof useCombatStore> | null = null
let drawingStoreInstance: ReturnType<typeof useDrawingStore> | null = null
let chatStoreInstance: ReturnType<typeof useChatStore> | null = null

function getShipStore() {
  if (!shipStoreInstance) {
    shipStoreInstance = useShipStore()
  }
  return shipStoreInstance
}

function getCombatStore() {
  if (!combatStoreInstance) {
    combatStoreInstance = useCombatStore()
  }
  return combatStoreInstance
}

function getDrawingStore() {
  if (!drawingStoreInstance) {
    drawingStoreInstance = useDrawingStore()
  }
  return drawingStoreInstance
}

function getChatStore() {
  if (!chatStoreInstance) {
    chatStoreInstance = useChatStore()
  }
  return chatStoreInstance
}

export class WSClient implements IWSClient {
  private ws: WebSocket | null = null
  private url: string
  private messageHandlers: Map<WSMessageType, Set<(payload: unknown) => void>> = new Map()
  private connected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(url: string) {
    this.url = url
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.connected = true
          this.reconnectAttempts = 0
          console.log('[WSClient] Connected to', this.url)
          resolve()
        }

        this.ws.onclose = (event) => {
          this.connected = false
          console.log('[WSClient] Disconnected', event.code, event.reason)
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('[WSClient] Error:', error)
          reject(error)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(data: string): void {
    try {
      const message: SharedWSMessage = JSON.parse(data)
      this.processMessage(message)

      const handlers = this.messageHandlers.get(message.type as WSMessageType)
      if (handlers) {
        handlers.forEach(handler => handler((message as any).payload))
      }
    } catch (error) {
      console.error('[WSClient] Failed to parse message:', error)
    }
  }

  private processMessage(message: SharedWSMessage): void {
    switch (message.type) {
      case 'PLAYER_JOINED':
        this.handlePlayerJoined(message.payload as any)
        break
      case 'PLAYER_LEFT':
        this.handlePlayerLeft(message.payload as any)
        break
      case 'SHIP_MOVED':
        this.handleShipMoved(message.payload as any)
        break
      case 'SHIP_STATUS_UPDATE':
        this.handleShipStatusUpdate(message.payload as any)
        break
      case 'EXPLOSION':
        this.handleExplosion(message.payload as any)
        break
      case 'SHIELD_UPDATE':
        this.handleShieldUpdate(message.payload as any)
        break
      case 'FLUX_STATE':
        this.handleFluxState(message.payload as any)
        break
      case 'COMBAT_EVENT':
        this.handleCombatEvent(message.payload as any)
        break
      case 'DRAWING_ADD':
        this.handleDrawingAdd(message.payload as any)
        break
      case 'DRAWING_CLEAR':
        this.handleDrawingClear(message.payload as any)
        break
      case 'CHAT_MESSAGE':
        this.handleChatMessage(message.payload as any)
        break
      case 'ERROR':
        this.handleError(message.payload as any)
        break
    }
  }

  private handlePlayerJoined(payload: any): void {
    console.log('[WSClient] Player joined:', payload)
    getChatStore().addSystemMessage(`${payload.name} joined the room`)
  }

  private handlePlayerLeft(payload: any): void {
    console.log('[WSClient] Player left:', payload)
    getChatStore().addSystemMessage(`Player left the room`)
  }

  private handleShipMoved(payload: any): void {
    const { shipId, newX, newY, newHeading } = payload
    getShipStore().updateShip(shipId, {
      position: { x: newX, y: newY },
      heading: newHeading
    })
  }

  private handleShipStatusUpdate(payload: any): void {
    getShipStore().updateShip(payload.id, payload)
  }

  private handleExplosion(payload: any): void {
    getCombatStore().showExplosion(payload)
  }

  private handleShieldUpdate(payload: any): void {
    const { shipId, active, type, coverageAngle } = payload
    const shipStore = getShipStore()
    const ship = shipStore.ships.get(shipId)
    if (ship) {
      shipStore.updateShip(shipId, {
        shield: {
          ...ship.shield,
          active,
          type,
          coverageAngle
        }
      })
    }
  }

  private handleFluxState(payload: any): void {
    const { shipId, fluxState, currentFlux, softFlux, hardFlux } = payload
    const shipStore = getShipStore()
    const ship = shipStore.ships.get(shipId)
    if (ship) {
      shipStore.updateShip(shipId, {
        flux: {
          ...ship.flux,
          current: currentFlux,
          softFlux,
          hardFlux
        },
        fluxState
      })
    }
  }

  private handleCombatEvent(payload: any): void {
    const { sourceShipId, targetShipId, weaponId, hit, damage, hitQuadrant } = payload
    const shipStore = getShipStore()
    const ship = shipStore.ships.get(targetShipId)
    const position = ship ? ship.position : { x: 0, y: 0 }

    getCombatStore().handleCombatEvent(
      sourceShipId,
      targetShipId,
      weaponId,
      hit,
      damage,
      hitQuadrant,
      position
    )
  }

  private handleDrawingAdd(payload: { playerId: string; element: any }): void {
    getDrawingStore().addElement(payload.element)
  }

  private handleDrawingClear(_payload: { playerId: string }): void {
    getDrawingStore().clear()
  }

  private handleChatMessage(payload: { senderId: string; senderName: string; content: string; timestamp: number }): void {
    getChatStore().handleWSMessage(payload)
  }

  private handleError(payload: any): void {
    console.error('[WSClient] Server error:', payload.code, payload.message)
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WSClient] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      if (!this.connected) {
        this.connect().catch(console.error)
      }
    }, delay)
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  send(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WSClient] Cannot send message, not connected')
      return
    }
    this.ws.send(JSON.stringify(message))
  }

  sendDrawing(element: any): void {
    this.send({
      type: 'DRAWING_ADD' as any,
      payload: { element }
    } as any)
  }

  sendChat(content: string): void {
    this.send({
      type: 'CHAT_MESSAGE' as any,
      payload: { content }
    } as any)
  }

  on(type: WSMessageType, handler: (payload: unknown) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)
  }

  off(type: WSMessageType, handler?: (payload: unknown) => void): void {
    const handlers = this.messageHandlers.get(type)
    if (!handlers) return

    if (handler) {
      handlers.delete(handler)
    } else {
      handlers.clear()
    }
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  setReconnectConfig(maxAttempts: number, baseDelay: number): void {
    this.maxReconnectAttempts = maxAttempts
    this.reconnectDelay = baseDelay
  }
}

export function createWSClient(url: string): IWSClient {
  return new WSClient(url)
}