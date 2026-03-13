import { ref } from 'vue'
import { WSClient } from '@/services/WSClient'
import type { IWSClient } from '@vt/shared'

const wsClient = ref<IWSClient | null>(null)
const isConnected = ref(false)
const currentRoomId = ref<string | null>(null)
const currentPlayerId = ref<string | null>(null)

function connect(url: string): Promise<void> {
  if (wsClient.value) {
    wsClient.value.disconnect()
  }
  
  const client = new WSClient(url)
  wsClient.value = client
  
  return client.connect().then(() => {
    isConnected.value = true
  })
}

function disconnect(): void {
  if (wsClient.value) {
    wsClient.value.disconnect()
    wsClient.value = null
    isConnected.value = false
    currentRoomId.value = null
    currentPlayerId.value = null
  }
}

function getClient(): IWSClient | null {
  return wsClient.value
}

function setRoomId(roomId: string): void {
  currentRoomId.value = roomId
}

function setPlayerId(playerId: string): void {
  currentPlayerId.value = playerId
}

export function useWSConnection() {
  return {
    wsClient,
    isConnected,
    currentRoomId,
    currentPlayerId,
    connect,
    disconnect,
    getClient,
    setRoomId,
    setPlayerId
  }
}