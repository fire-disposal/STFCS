<template>
  <div class="chat-panel" :class="{ expanded: expanded }">
    <div class="chat-header" @click="$emit('toggle')">
      <span class="chat-title">Chat</span>
      <span class="toggle-icon">{{ expanded ? '▼' : '▲' }}</span>
    </div>
    
    <div class="chat-messages" v-if="expanded" ref="messagesRef">
      <div
        v-for="msg in chatStore.recentMessages"
        :key="msg.id"
        class="chat-message"
        :class="msg.type"
      >
        <span v-if="msg.senderName" class="sender">{{ msg.senderName }}:</span>
        <span class="content">{{ msg.content }}</span>
        <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
      </div>
    </div>
    
    <div class="chat-input" v-if="expanded">
      <input
        v-model="inputText"
        type="text"
        placeholder="Type a message..."
        @keyup.enter="sendMessage"
      />
      <button @click="sendMessage" :disabled="!inputText.trim()">Send</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/useChatStore'

defineProps<{
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
  'send-message': [content: string]
}>()

const chatStore = useChatStore()
const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)

function sendMessage(): void {
  if (inputText.value.trim()) {
    const content = inputText.value.trim()
    chatStore.addPlayerMessage('local', 'You', content)
    emit('send-message', content)
    inputText.value = ''
    scrollToBottom()
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom(): void {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

watch(() => chatStore.messages.length, scrollToBottom)
</script>

<style scoped>
.chat-panel {
  width: 320px;
  background: rgba(15, 15, 30, 0.95);
  border: 1px solid rgba(100, 100, 150, 0.3);
  border-radius: 8px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(30, 30, 60, 0.5);
  cursor: pointer;
}

.chat-title {
  font-size: 12px;
  color: #aaccff;
}

.toggle-icon {
  font-size: 10px;
  color: #667788;
}

.chat-messages {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
}

.chat-message {
  padding: 4px 0;
  font-size: 12px;
}

.chat-message.system {
  color: #8899aa;
  font-style: italic;
}

.chat-message.player {
  color: #c0c0d0;
}

.sender {
  color: #4a9eff;
  margin-right: 4px;
}

.content {
  word-break: break-word;
}

.timestamp {
  font-size: 10px;
  color: #556677;
  margin-left: 8px;
}

.chat-input {
  display: flex;
  border-top: 1px solid rgba(100, 100, 150, 0.2);
}

.chat-input input {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  color: #c0c0d0;
  font-size: 12px;
}

.chat-input input::placeholder {
  color: #556677;
}

.chat-input button {
  padding: 8px 16px;
  background: rgba(60, 100, 150, 0.5);
  border: none;
  color: #aaccff;
  cursor: pointer;
}

.chat-input button:hover:not(:disabled) {
  background: rgba(80, 120, 170, 0.6);
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>