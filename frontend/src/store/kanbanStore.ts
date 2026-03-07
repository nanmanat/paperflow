import { create } from 'zustand'
import {
  getBoard,
  createCard as apiCreateCard,
  updateCard as apiUpdateCard,
  deleteCard as apiDeleteCard,
  updateColumns as apiUpdateColumns,
  type KanbanCard,
  type KanbanBoard,
  type ColumnId,
} from '@/api/github'

export type { ColumnId, KanbanCard }

export const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'text-muted-foreground' },
  { id: 'todo', label: 'To Do', color: 'text-blue-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-yellow-400' },
  { id: 'in_review', label: 'In Review', color: 'text-purple-400' },
  { id: 'done', label: 'Done', color: 'text-green-400' },
]

const EMPTY_COLUMNS: Record<ColumnId, string[]> = {
  backlog: [], todo: [], in_progress: [], in_review: [], done: [],
}

interface KanbanState {
  cards: Record<string, KanbanCard>
  columns: Record<ColumnId, string[]>
  loading: boolean
  fetchBoard: (projectId: string) => Promise<void>
  addCard: (card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<KanbanCard>
  updateCard: (projectId: string, id: string, updates: Partial<KanbanCard>) => Promise<void>
  deleteCard: (projectId: string, id: string) => Promise<void>
  moveCard: (projectId: string, cardId: string, toColumn: ColumnId) => Promise<void>
  reorderColumn: (projectId: string, column: ColumnId, cardIds: string[]) => Promise<void>
  getProjectCards: (projectId: string) => KanbanCard[]
}

export const useKanbanStore = create<KanbanState>()((set, get) => ({
  cards: {},
  columns: EMPTY_COLUMNS,
  loading: false,

  fetchBoard: async (projectId) => {
    set({ loading: true })
    try {
      const board: KanbanBoard = await getBoard(projectId)
      set({ cards: board.cards, columns: board.columns })
    } finally {
      set({ loading: false })
    }
  },

  addCard: async (card) => {
    const { card: newCard, columns } = await apiCreateCard(card.projectId, {
      title: card.title,
      description: card.description,
      column: card.column,
    })
    set((state) => ({
      cards: { ...state.cards, [newCard.id]: newCard },
      columns,
    }))
    return newCard
  },

  updateCard: async (projectId, id, updates) => {
    const { card: updated, columns } = await apiUpdateCard(projectId, id, updates)
    set((state) => ({
      cards: { ...state.cards, [id]: updated },
      columns,
    }))
  },

  deleteCard: async (projectId, id) => {
    const card = get().cards[id]
    if (!card) return
    await apiDeleteCard(projectId, id)
    set((state) => {
      const newCards = { ...state.cards }
      delete newCards[id]
      return {
        cards: newCards,
        columns: {
          ...state.columns,
          [card.column]: state.columns[card.column].filter((cid) => cid !== id),
        },
      }
    })
  },

  moveCard: async (projectId, cardId, toColumn) => {
    const card = get().cards[cardId]
    if (!card || card.column === toColumn) return
    const { card: updated, columns } = await apiUpdateCard(projectId, cardId, { column: toColumn })
    set((state) => ({ cards: { ...state.cards, [cardId]: updated }, columns }))
  },

  reorderColumn: async (projectId, column, cardIds) => {
    const newColumns = { ...get().columns, [column]: cardIds }
    set({ columns: newColumns })
    await apiUpdateColumns(projectId, newColumns)
  },

  getProjectCards: (projectId) =>
    Object.values(get().cards).filter((c) => c.projectId === projectId),
}))

