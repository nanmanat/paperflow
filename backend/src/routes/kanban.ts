import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

export type ColumnId = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export interface KanbanCard {
  id: string;
  projectId: string;
  title: string;
  description: string;
  column: ColumnId;
  branchName?: string;
  prNumber?: number;
  prMerged?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanBoard {
  cards: Record<string, KanbanCard>;
  columns: Record<ColumnId, string[]>;
}

const EMPTY_COLUMNS: Record<ColumnId, string[]> = {
  backlog: [], todo: [], in_progress: [], in_review: [], done: [],
};

const boards: Map<string, KanbanBoard> = new Map();

function getOrCreateBoard(projectId: string): KanbanBoard {
  if (!boards.has(projectId)) {
    boards.set(projectId, { cards: {}, columns: { ...EMPTY_COLUMNS } });
  }
  return boards.get(projectId)!;
}

router.get('/api/projects/:projectId/board', (req: Request, res: Response) => {
  const board = getOrCreateBoard(req.params.projectId);
  res.json(board);
});

router.post('/api/projects/:projectId/cards', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId } = req.params;
    const { title, description, column } = req.body as Pick<KanbanCard, 'title' | 'description' | 'column'>;
    if (!title || !column) { res.status(400).json({ error: 'title and column are required' }); return; }

    const board = getOrCreateBoard(projectId);
    const card: KanbanCard = {
      id: randomUUID(),
      projectId,
      title,
      description: description ?? '',
      column,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    board.cards[card.id] = card;
    board.columns[column] = [...(board.columns[column] ?? []), card.id];
    res.status(201).json({ card, columns: board.columns });
  } catch (error) {
    next(error);
  }
});

router.patch('/api/projects/:projectId/cards/:cardId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId, cardId } = req.params;
    const board = getOrCreateBoard(projectId);
    const existing = board.cards[cardId];
    if (!existing) { res.status(404).json({ error: 'Card not found' }); return; }

    const updates = req.body as Partial<Omit<KanbanCard, 'id' | 'projectId' | 'createdAt'>>;
    const newColumn = updates.column;
    const oldColumn = existing.column;

    const updated: KanbanCard = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    board.cards[cardId] = updated;

    if (newColumn && newColumn !== oldColumn) {
      board.columns[oldColumn] = board.columns[oldColumn].filter((id) => id !== cardId);
      board.columns[newColumn] = [...(board.columns[newColumn] ?? []), cardId];
    }

    res.json({ card: updated, columns: board.columns });
  } catch (error) {
    next(error);
  }
});

router.delete('/api/projects/:projectId/cards/:cardId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId, cardId } = req.params;
    const board = getOrCreateBoard(projectId);
    const card = board.cards[cardId];
    if (!card) { res.status(404).json({ error: 'Card not found' }); return; }

    delete board.cards[cardId];
    board.columns[card.column] = board.columns[card.column].filter((id) => id !== cardId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put('/api/projects/:projectId/columns', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId } = req.params;
    const columns = req.body as Record<ColumnId, string[]>;
    const board = getOrCreateBoard(projectId);
    board.columns = { ...EMPTY_COLUMNS, ...columns };
    res.json(board.columns);
  } catch (error) {
    next(error);
  }
});

export default router;
