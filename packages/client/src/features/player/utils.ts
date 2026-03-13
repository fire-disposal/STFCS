// 为了解决当前存在的重复声明等问题，我们需要清理现有的文件

// 清理后的utils文件
export { 
  getPlayerInitials,
  getPlayerAvatarColor,
  sanitizePlayerName,
  validatePlayerConnection,
  formatTimeSinceJoined 
} from './playerUtils'