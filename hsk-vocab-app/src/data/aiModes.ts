import { GraduationCap, MessageCircle, Sparkles, LucideIcon } from 'lucide-react'

export type AIMode = 'chat' | 'conversation' | 'grammar'

export interface AIModeConfig {
  id: AIMode
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  emptyTitle: string
  emptySubtitle: string
}

export const AI_MODES: AIModeConfig[] = [
  {
    id: 'chat',
    label: 'Free Chat',
    shortLabel: 'Chat',
    icon: Sparkles,
    description: 'General Chinese tutor — ask anything',
    emptyTitle: 'HSK Study Assistant',
    emptySubtitle: 'Ask about Chinese vocabulary, grammar, or get practice quizzes.',
  },
  {
    id: 'conversation',
    label: 'Conversation',
    shortLabel: 'Talk',
    icon: MessageCircle,
    description: 'Practice real scenarios with an AI partner',
    emptyTitle: 'Pick a scenario',
    emptySubtitle: 'Choose a situation to practice. The AI will stay in character.',
  },
  {
    id: 'grammar',
    label: 'Grammar',
    shortLabel: 'Grammar',
    icon: GraduationCap,
    description: 'Focus on a specific grammar pattern',
    emptyTitle: 'Pick a grammar pattern',
    emptySubtitle: 'Choose a pattern to study. The AI will teach with examples.',
  },
]

export const AI_MODE_BY_ID: Record<AIMode, AIModeConfig> = AI_MODES.reduce(
  (acc, m) => ({ ...acc, [m.id]: m }),
  {} as Record<AIMode, AIModeConfig>
)

export const CHAT_MODE_LABEL = (mode: AIMode): string => AI_MODE_BY_ID[mode].label