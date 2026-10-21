import { useSyncExternalStore } from 'react'
import { chat, type ChatBubbleData } from './engine'

export const useChat = () => useSyncExternalStore(chat.subscribe, chat.getSnapshot)

/** the live chat bubble for one character (actor id, or "manager") */
export const useChatBubble = (key: string): ChatBubbleData | null =>
  useSyncExternalStore(chat.subscribe, () => chat.bubbleOf(key))
