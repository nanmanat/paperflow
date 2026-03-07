import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { projects } from '../db/schema';

const router = Router();

export interface Project {
  id: string;
  name: string;
  description: string;
  github: {
    owner: string;
    repo: string;
    defaultBranch: string;
  };
  createdAt: string;
}

function toProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    github: {
      owner: row.githubOwner,
      repo: row.githubRepo,
      defaultBranch: row.defaultBranch,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

router.get('/api/projects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(projects)
      .orderBy(projects.createdAt);
    res.json(rows.map(toProject).reverse());
  } catch (error) {
    next(error);
  }
});

router.post('/api/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { name, description, github } = req.body as Omit<Project, 'id' | 'createdAt'>;
    if (!name || !github?.owner || !github?.repo || !github?.defaultBranch) {
      res.status(400).json({ error: 'name, github.owner, github.repo, and github.defaultBranch are required' });
      return;
    }

    const [row] = await db
      .insert(projects)
      .values({
        name,
        description: description ?? '',
        githubOwner: github.owner,
        githubRepo: github.repo,
        defaultBranch: github.defaultBranch,
      })
      .returning();

    res.status(201).json(toProject(row));
  } catch (error) {
    next(error);
  }
});

router.delete('/api/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { id } = req.params;
    const deleted = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
