import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/utils'

export type ColumnId = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'

export interface KanbanCard {
  id: string
  projectId: string
  title: string
  description: string
  column: ColumnId
  branchName?: string
  prNumber?: number
  prMerged?: boolean
  assignee?: string
  labels?: string[]
  createdAt: string
  updatedAt: string
}

export const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'text-muted-foreground' },
  { id: 'todo', label: 'To Do', color: 'text-blue-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-yellow-400' },
  { id: 'in_review', label: 'In Review', color: 'text-purple-400' },
  { id: 'done', label: 'Done', color: 'text-green-400' },
]

interface KanbanState {
  cards: Record<string, KanbanCard>
  columns: Record<ColumnId, string[]>
  addCard: (card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => KanbanCard
  updateCard: (id: string, updates: Partial<KanbanCard>) => void
  deleteCard: (id: string) => void
  moveCard: (cardId: string, toColumn: ColumnId, toIndex?: number) => void
  getProjectCards: (projectId: string) => KanbanCard[]
  reorderColumn: (column: ColumnId, cardIds: string[]) => void
}

const emptyColumns: Record<ColumnId, string[]> = {
  backlog: [], todo: [], in_progress: [], in_review: [], done: []
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      cards: {},
      columns: emptyColumns,
      addCard: (card) => {
        const newCard: KanbanCard = {
          ...card,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({
          cards: { ...state.cards, [newCard.id]: newCard },
          columns: {
            ...state.columns,
            [card.column]: [...(state.columns[card.column] ?? []), newCard.id],
          },
        }))
        return newCard
      },
      updateCard: (id, updates) =>
        set((state) => ({
          cards: {
            ...state.cards,
            [id]: { ...state.cards[id]!, ...updates, updatedAt: new Date().toISOString() },
          },
        })),
      deleteCard: (id) =>
        set((state) => {
          const card = state.cards[id]
          if (!card) return state
          const newCards = { ...state.cards }
          delete newCards[id]
          return {
            cards: newCards,
            columns: {
              ...state.columns,
              [card.column]: state.columns[card.column].filter((cid) => cid !== id),
            },
          }
        }),
      moveCard: (cardId, toColumn, toIndex) =>
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const fromColumn = card.column
          const fromIds = state.columns[fromColumn].filter((id) => id !== cardId)
          const toIds = [...state.columns[toColumn].filter((id) => id !== cardId)]
          if (toIndex !== undefined) toIds.splice(toIndex, 0, cardId)
          else toIds.push(cardId)
          return {
            cards: { ...state.cards, [cardId]: { ...card, column: toColumn, updatedAt: new Date().toISOString() } },
            columns: {
              ...state.columns,
              [fromColumn]: fromIds,
              [toColumn]: toIds,
            },
          }
        }),
      reorderColumn: (column, cardIds) =>
        set((state) => ({ columns: { ...state.columns, [column]: cardIds } })),
      getProjectCards: (projectId) =>
        Object.values(get().cards).filter((c) => c.projectId === projectId),
    }),
    { name: 'paperflow-kanban' }
  )
)
