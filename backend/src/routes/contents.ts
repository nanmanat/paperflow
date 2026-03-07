import { Router, Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';

const router = Router();

router.get('/api/repos/:owner/:repo/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { owner, repo } = req.params;
    const ref = req.query.ref as string;
    if (!ref) { res.status(400).json({ error: 'Missing ref query param' }); return; }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.git.getTree({ owner, repo, tree_sha: ref, recursive: '1' });
    const texPaths = data.tree
      .filter((item) => item.type === 'blob' && item.path?.endsWith('.tex'))
      .map((item) => item.path!);
    res.json(texPaths);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo/contents/*', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo } = req.params;
    const path = req.params[0] || '';
    const ref = req.query.ref as string | undefined;

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ...(ref && { ref }),
    });

    if (Array.isArray(data)) {
      res.json(data);
      return;
    }

    if ('type' in data && data.type === 'file' && 'content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      res.set('Content-Type', 'text/plain');
      res.send(content);
      return;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
