import type { ConversationState } from '../../types/simulation'

export const stateLabels: Record<ConversationState, string> = {
  listening: 'הדמות מקשיבה',
  thinking: 'הדמות חושבת',
  speaking: 'הדמות מדברת',
}

export function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
