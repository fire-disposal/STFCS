/**
 * Utilities for the player system
 */

import type { PlayerInfo } from '@vt/shared'

/**
 * Generates player avatar initials from name
 */
export function getPlayerInitials(name: string): string {
  if (!name) return '?'
  const names = name.trim().split(/\s+/)
  if (names.length === 0) return '?'
  
  const firstPart = names[0] || '?'
  let initials = firstPart[0] ? firstPart[0].toUpperCase().slice(0, 1) : '?'
  
  if (names.length > 1) {
    const lastPart = names[names.length - 1] || ''
    const lastInit = lastPart[0] ? lastPart[0].toUpperCase().slice(0, 1) : ''
    initials += lastInit
  }

  return initials || "?"
}

/**
 * Generates consistent color based on player ID
 */
export function getPlayerAvatarColor(id: string): string {
  if (!id) return "#8888ff"
  
  // Create hash of ID
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  // Convert to HSL for consistent, pleasant colors
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 70%, 60%)`
}

/**
 * Sanitizes player name
 */
export function sanitizePlayerName(name: string): string {
  if (typeof name !== 'string') {
    return 'Anonymous'
  }
  
  // Remove potentially harmful characters
  const sanitized = name.replace(/[<>{}[\]\\]/g, '').trim()
  if (!sanitized) {
    return 'Anonymous'
  }
  
  // Limit length
  return sanitized.substring(0, 32)
}

/**
 * Validates player connection
 */
export function validatePlayerConnection(player: PlayerInfo | null | undefined): boolean {
  return !!(player &&
         typeof player.id === 'string' && 
         player.id.length > 0 &&
         typeof player.name === 'string' && 
         player.name.trim().length > 0)
}

/**
 * Formats time since player joined
 */
export function formatTimeSinceJoined(joinedAt: number | null | undefined): string {
  if (!joinedAt || typeof joinedAt !== 'number') return 'Just now'
  
  const seconds = Math.floor((Date.now() - joinedAt) / 1000)
  
  if (seconds < 60) {
    return 'Just now'
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return `${mins}m ago`
  } else {
    const hours = Math.floor(seconds / 3600)
    return `${hours}h ago`
  }
}