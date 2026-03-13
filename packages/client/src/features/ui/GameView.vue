<template>
  <div class="game-view">
    <div class="top-bar">
      <TurnControlBar />
    </div>
    
    <div class="main-content">
      <aside class="left-panel" :class="{ collapsed: leftPanelCollapsed }">
        <button class="panel-toggle" @click="leftPanelCollapsed = !leftPanelCollapsed">
          {{ leftPanelCollapsed ? '>' : '<' }}
        </button>
        <RoomPanel v-if="!leftPanelCollapsed" @join-room="handleJoinRoom" @leave-room="handleLeaveRoom" />
      </aside>
      
      <main class="map-area">
        <MapCanvas
          @token-click="handleTokenClick"
          @token-right-click="handleTokenRightClick"
          @placement-confirm="handlePlacementConfirm"
        >
          <template #overlay>
            <DrawingOverlay v-if="drawingStore.isActive" />
          </template>
        </MapCanvas>
        
        <ShipInfoCard v-if="selectedShip" :ship="selectedShip" @close="closeShipInfo" />
        <PlayerControls class="player-controls-overlay" @end-turn="handleEndTurn" />
      </main>
      
      <aside class="right-panel" :class="{ collapsed: rightPanelCollapsed }">
        <button class="panel-toggle" @click="rightPanelCollapsed = !rightPanelCollapsed">
          {{ rightPanelCollapsed ? '<' : '>' }}
        </button>
        <CombatLog v-if="!rightPanelCollapsed" />
      </aside>
    </div>
    
    <div class="bottom-bar">
      <DrawingToolbar @clear="handleDrawingClear" />
      <WeaponToolbar />
    </div>
    
    <ChatPanel :expanded="chatExpanded" @toggle="chatExpanded = !chatExpanded" @send-message="handleChatSend" />
    
    <div v-if="!wsConnection.isConnected.value" class="connection-overlay">
      <div class="connection-dialog">
        <h3>Connect to Server</h3>
        <input v-model="serverUrl" type="text" placeholder="ws://localhost:3001" />
        <button @click="handleConnect" :disabled="isConnecting">
          {{ isConnecting ? 'Connecting...' : 'Connect' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import MapCanvas from '../map/MapCanvas.vue'
import TurnControlBar from './TurnControlBar.vue'
import RoomPanel from './RoomPanel.vue'
import PlayerControls from '../player/PlayerControls.vue'
import ShipInfoCard from './ShipInfoCard.vue'
import WeaponToolbar from './WeaponToolbar.vue'
import DrawingToolbar from './DrawingToolbar.vue'
import ChatPanel from './ChatPanel.vue'
import CombatLog from './CombatLog.vue'
import DrawingOverlay from './DrawingOverlay.vue'
import { useMapStore } from '@/stores/useMapStore'
import { useDrawingStore, type DrawingElement } from '@/stores/useDrawingStore'
import { useChatStore } from '@/stores/useChatStore'
import { useWSConnection } from '@/stores/useWSConnection'
import { playerManager } from '@/features/player/MPManager'
import type { ShipStatus } from '@vt/shared'

const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)
const chatExpanded = ref(false)
const serverUrl = ref('ws://localhost:3001')
const isConnecting = ref(false)

const mapStore = useMapStore()
const drawingStore = useDrawingStore()
const chatStore = useChatStore()
const wsConnection = useWSConnection()

const selectedShip = computed((): ShipStatus | null => {
  const tokenId = mapStore.selectedTokenId
  if (!tokenId) return null
  const token = mapStore.tokens.get(tokenId)
  if (!token || token.type !== 'ship') return null
  const data = token.data
  if (!data || typeof data !== 'object') return null
  return data as unknown as ShipStatus
})

function setupDrawingSync(): void {
  drawingStore.setOnElementAdded((element: DrawingElement) => {
    const client = wsConnection.getClient()
    if (client && wsConnection.isConnected.value) {
      client.send({
        type: 'DRAWING_ADD' as any,
        payload: { element }
      } as any)
    }
  })
  
  drawingStore.setOnClear(() => {
    const client = wsConnection.getClient()
    if (client && wsConnection.isConnected.value) {
      client.send({
        type: 'DRAWING_CLEAR' as any,
        payload: { clearAll: true }
      } as any)
    }
  })
}

async function handleConnect(): Promise<void> {
  if (isConnecting.value) return
  isConnecting.value = true
  
  try {
    await wsConnection.connect(serverUrl.value)
    setupDrawingSync()
    chatStore.addSystemMessage('Connected to server')
  } catch (error) {
    console.error('Failed to connect:', error)
    chatStore.addSystemMessage('Failed to connect to server')
  } finally {
    isConnecting.value = false
  }
}

function handleJoinRoom(roomId: string, playerName: string): void {
  const client = wsConnection.getClient()
  if (client && wsConnection.isConnected.value) {
    const playerId = `player_${Date.now()}`
    wsConnection.setPlayerId(playerId)
    wsConnection.setRoomId(roomId)
    
    // 添加玩家到管理器
    playerManager.setCurrentPlayer(playerId)
    playerManager.addPlayer({
      id: playerId,
      name: playerName,
      joinedAt: Date.now(),
      isConnected: true,
      isReady: false,
      currentShipId: null,
      selectedTargets: [],
      usedActions: 0,
      pendingActions: 0,
      roomId: roomId,
      slotIndex: 0,
      hasActed: false,
      fluxVentingActive: false,
      gamePhase: 'lobby'
    })
    
    client.send({
      type: 'PLAYER_JOINED' as any,
      payload: {
        id: playerId,
        name: playerName,
        joinedAt: Date.now(),
        roomId: roomId
      }
    } as any)
    
    chatStore.addSystemMessage(`Joined room: ${roomId}`)
  }
}

function handleLeaveRoom(): void {
  wsConnection.setRoomId('')
  playerManager.removePlayer(playerManager.getCurrentPlayer()?.id || '')
  chatStore.addSystemMessage('Left room')
}

function handleEndTurn(): void {
  // 处理结束轮次逻辑
  const currentPlayer = playerManager.getCurrentPlayer()
  if (currentPlayer) {
    playerManager.updatePlayer(currentPlayer.id, {
      hasActed: true
    })
    chatStore.addSystemMessage(`${currentPlayer.name} ended their turn`)
  }
}

function handleDrawingClear(): void {
  drawingStore.clear()
}

function handleChatSend(content: string): void {
  const client = wsConnection.getClient()
  if (client && wsConnection.isConnected.value) {
    client.send({
      type: 'CHAT_MESSAGE' as any,
      payload: { content }
    } as any)
  }
}

function handleTokenClick(tokenId: string): void {
  mapStore.selectToken(tokenId)
}

function handleTokenRightClick(tokenId: string | null, x: number, y: number): void {
  console.log('Right click:', tokenId, x, y)
}

function handlePlacementConfirm(x: number, y: number, rotation: number): void {
  console.log('Placement confirmed:', x, y, rotation)
  mapStore.setPlacementMode(false)
}

function closeShipInfo(): void {
  mapStore.selectToken(null)
}

  onMounted(() => {
    // 设置 WebSocket 消息处理器
    const client = wsConnection.getClient()
    if (client) {
      client.on('PLAYER_JOINED' as any, (payload: any) => {
        playerManager.handlePlayerJoined(payload)
        chatStore.addSystemMessage(`${payload.name} joined the game`)
      })
    }
    
    chatStore.addSystemMessage('Welcome! Connect to a server to start playing.')
  })

  onBeforeUnmount(() => {
    wsConnection.disconnect()
  })
</script>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #0a0a1a;
  color: #c0c0d0;
  overflow: hidden;
}

.top-bar {
  height: 48px;
  background: rgba(20, 20, 40, 0.95);
  border-bottom: 1px solid rgba(100, 100, 150, 0.3);
  flex-shrink: 0;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel,
.right-panel {
  width: 280px;
  background: rgba(15, 15, 30, 0.95);
  border-right: 1px solid rgba(100, 100, 150, 0.3);
  position: relative;
  transition: width 0.3s ease;
  flex-shrink: 0;
  overflow: hidden;
}

.right-panel {
  border-right: none;
  border-left: 1px solid rgba(100, 100, 150, 0.3);
}

.left-panel.collapsed,
.right-panel.collapsed {
  width: 32px;
}

.panel-toggle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  background: rgba(40, 40, 80, 0.8);
  border: 1px solid rgba(100, 100, 150, 0.3);
  color: #aaccff;
  cursor: pointer;
  z-index: 10;
}

.left-panel .panel-toggle {
  right: 0;
  border-radius: 4px 0 0 4px;
}

.right-panel .panel-toggle {
  left: 0;
  border-radius: 0 4px 4px 0;
}

.panel-toggle:hover {
  background: rgba(60, 60, 100, 0.9);
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.bottom-bar {
  height: 64px;
  background: rgba(20, 20, 40, 0.95);
  border-top: 1px solid rgba(100, 100, 150, 0.3);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
}

.chat-panel {
  position: fixed;
  right: 16px;
  bottom: 80px;
  z-index: 100;
}

.connection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.connection-dialog {
  background: rgba(20, 20, 40, 0.95);
  border: 1px solid rgba(100, 100, 150, 0.5);
  border-radius: 8px;
  padding: 24px;
  min-width: 300px;
}

.connection-dialog h3 {
  margin: 0 0 16px 0;
  color: #aaccff;
}

.connection-dialog input {
  width: 100%;
  padding: 10px;
  background: rgba(10, 10, 30, 0.8);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 4px;
  color: #c0c0d0;
  font-size: 14px;
  margin-bottom: 16px;
}

.connection-dialog button {
  width: 100%;
  padding: 10px;
  background: rgba(60, 100, 150, 0.5);
  border: 1px solid #4a9eff;
  border-radius: 4px;
  color: #aaccff;
  font-size: 14px;
  cursor: pointer;
}

.connection-dialog button:hover:not(:disabled) {
  background: rgba(80, 120, 170, 0.6);
}

.connection-dialog button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.player-controls-overlay {
  position: absolute;
  bottom: 80px;
  left: 16px;
  z-index: 200;
}
</style>