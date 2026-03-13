import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { MotionPlugin } from '@vueuse/motion'
import { playerManager } from '@/features/player/MPManager'
import './style.css'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(MotionPlugin)
app.mount('#app')

// 初始化多玩家协调系统
console.info('Multiplayer Coordination System initialized')
playerManager
