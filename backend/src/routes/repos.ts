import { Router, Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';

const router = Router();

router.get('/api/repos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
    });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo } = req.params;
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.get({ owner, repo });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
