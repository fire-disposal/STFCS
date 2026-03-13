import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChatMessage {
  id: string
  type: 'player' | 'system'
  senderId?: string
  senderName?: string
  content: string
  timestamp: number
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const maxMessages = 100

  const recentMessages = computed(() => {
    return messages.value.slice(-50)
  })

  function addPlayerMessage(senderId: string, senderName: string, content: string): void {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'player',
      senderId,
      senderName,
      content,
      timestamp: Date.now()
    }
    messages.value.push(message)
    trimMessages()
  }

  function addSystemMessage(content: string): void {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'system',
      content,
      timestamp: Date.now()
    }
    messages.value.push(message)
    trimMessages()
  }

  function trimMessages(): void {
    if (messages.value.length > maxMessages) {
      messages.value = messages.value.slice(-maxMessages)
    }
  }

  function clearMessages(): void {
    messages.value = []
  }

  function handleWSMessage(payload: { senderId: string; senderName: string; content: string; timestamp: number }): void {
    addPlayerMessage(payload.senderId, payload.senderName, payload.content)
  }

  return {
    messages,
    recentMessages,
    addPlayerMessage,
    addSystemMessage,
    clearMessages,
    handleWSMessage
  }
})