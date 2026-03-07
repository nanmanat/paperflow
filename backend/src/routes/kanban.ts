import { Router, Request, Response, NextFunction } from 'express';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db';
import { kanbanCards } from '../db/schema';

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

const COLUMN_ORDER: ColumnId[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

function toCard(row: typeof kanbanCards.$inferSelect): KanbanCard {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    column: row.columnId as ColumnId,
    branchName: row.branchName ?? undefined,
    prNumber: row.prNumber ?? undefined,
    prMerged: row.prMerged,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildBoard(rows: (typeof kanbanCards.$inferSelect)[]): KanbanBoard {
  const cards: Record<string, KanbanCard> = {};
  const columns: Record<ColumnId, string[]> = {
    backlog: [], todo: [], in_progress: [], in_review: [], done: [],
  };
  for (const row of rows) {
    const card = toCard(row);
    cards[card.id] = card;
    columns[card.column].push(card.id);
  }
  return { cards, columns };
}

router.get('/api/projects/:projectId/board', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.projectId, req.params.projectId))
      .orderBy(asc(kanbanCards.position));
    res.json(buildBoard(rows));
  } catch (error) {
    next(error);
  }
});

router.post('/api/projects/:projectId/cards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId } = req.params;
    const { title, description, column } = req.body as Pick<KanbanCard, 'title' | 'description' | 'column'>;
    if (!title || !column) { res.status(400).json({ error: 'title and column are required' }); return; }

    const existing = await db
      .select()
      .from(kanbanCards)
      .where(and(eq(kanbanCards.projectId, projectId), eq(kanbanCards.columnId, column)))
      .orderBy(asc(kanbanCards.position));
    const position = existing.length > 0 ? (existing[existing.length - 1]?.position ?? 0) + 1 : 0;

    const [inserted] = await db
      .insert(kanbanCards)
      .values({ projectId, title, description: description ?? '', columnId: column, position })
      .returning();

    const allRows = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.projectId, projectId))
      .orderBy(asc(kanbanCards.position));

    const board = buildBoard(allRows);
    res.status(201).json({ card: toCard(inserted), columns: board.columns });
  } catch (error) {
    next(error);
  }
});

router.patch('/api/projects/:projectId/cards/:cardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId, cardId } = req.params;
    const updates = req.body as Partial<Omit<KanbanCard, 'id' | 'projectId' | 'createdAt'>>;

    const existing = await db
      .select()
      .from(kanbanCards)
      .where(and(eq(kanbanCards.id, cardId), eq(kanbanCards.projectId, projectId)));
    if (existing.length === 0) { res.status(404).json({ error: 'Card not found' }); return; }

    const patch: Partial<typeof kanbanCards.$inferInsert> = { updatedAt: new Date() };
    if (updates.title !== undefined)      patch.title       = updates.title;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.column !== undefined)      patch.columnId    = updates.column;
    if (updates.branchName !== undefined)  patch.branchName  = updates.branchName;
    if (updates.prNumber !== undefined)    patch.prNumber    = updates.prNumber;
    if (updates.prMerged !== undefined)    patch.prMerged    = updates.prMerged;

    if (updates.column && updates.column !== (existing[0]?.columnId as ColumnId)) {
      const colRows = await db
        .select()
        .from(kanbanCards)
        .where(and(eq(kanbanCards.projectId, projectId), eq(kanbanCards.columnId, updates.column)))
        .orderBy(asc(kanbanCards.position));
      patch.position = colRows.length > 0 ? (colRows[colRows.length - 1]?.position ?? 0) + 1 : 0;
    }

    const [updated] = await db
      .update(kanbanCards)
      .set(patch)
      .where(eq(kanbanCards.id, cardId))
      .returning();

    const allRows = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.projectId, projectId))
      .orderBy(asc(kanbanCards.position));

    const board = buildBoard(allRows);
    res.json({ card: toCard(updated), columns: board.columns });
  } catch (error) {
    next(error);
  }
});

router.delete('/api/projects/:projectId/cards/:cardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId, cardId } = req.params;
    const deleted = await db
      .delete(kanbanCards)
      .where(and(eq(kanbanCards.id, cardId), eq(kanbanCards.projectId, projectId)))
      .returning();

    if (deleted.length === 0) { res.status(404).json({ error: 'Card not found' }); return; }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put('/api/projects/:projectId/columns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { projectId } = req.params;
    const columns = req.body as Record<ColumnId, string[]>;

    const updates: { id: string; columnId: ColumnId; position: number }[] = [];
    for (const col of COLUMN_ORDER) {
      const ids = columns[col] ?? [];
      ids.forEach((id, idx) => updates.push({ id, columnId: col, position: idx }));
    }

    await Promise.all(
      updates.map(({ id, columnId, position }) =>
        db
          .update(kanbanCards)
          .set({ columnId, position, updatedAt: new Date() })
          .where(and(eq(kanbanCards.id, id), eq(kanbanCards.projectId, projectId)))
      )
    );

    res.json(columns);
  } catch (error) {
    next(error);
  }
});

export default router;
