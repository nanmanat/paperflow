import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

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

// In-memory store — persists for the lifetime of the server process.
// Replace with a JSON file or DB for durability across restarts.
const projects: Map<string, Project> = new Map();

router.get('/api/projects', (_req: Request, res: Response) => {
  res.json(Array.from(projects.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));
});

// POST /api/projects — requires token
router.post('/api/projects', (req: Request, res: Response, next: NextFunction) => {
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

    const project: Project = {
      id: randomUUID(),
      name,
      description: description ?? '',
      github,
      createdAt: new Date().toISOString(),
    };

    projects.set(project.id, project);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id — requires token
router.delete('/api/projects/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { id } = req.params;
    if (!projects.has(id)) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    projects.delete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
