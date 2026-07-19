import type { ConversationState } from '../types/simulation'

export interface MockConversationSession {
  conversationId: string
  status: ConversationState | 'ready' | 'ended'
  isDemo: true
}

function waitBriefly(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 180))
}

export const elevenLabsService = {
  async createConversationSession(): Promise<MockConversationSession> {
    await waitBriefly()
    return { conversationId: `demo-${Date.now()}`, status: 'ready', isDemo: true }
  },

  async getSignedConversationUrl(): Promise<string> {
    await waitBriefly()
    return 'demo://signed-conversation-url'
  },

  async startConversation(conversationId: string): Promise<MockConversationSession> {
    await waitBriefly()
    return { conversationId, status: 'listening', isDemo: true }
  },

  async endConversation(conversationId: string): Promise<MockConversationSession> {
    await waitBriefly()
    return { conversationId, status: 'ended', isDemo: true }
  },

  async getConversationStatus(conversationId: string): Promise<MockConversationSession> {
    await waitBriefly()
    return { conversationId, status: 'listening', isDemo: true }
  },
}
