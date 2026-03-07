import { Router, Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';

const router = Router();

router.get('/api/user', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;

    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.users.getAuthenticated();

    res.json({ login: data.login, name: data.name, avatar_url: data.avatar_url });
  } catch (error) {
    next(error);
  }
});

export default router;
