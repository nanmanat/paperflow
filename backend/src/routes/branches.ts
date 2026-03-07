import { Router, Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';

const router = Router();

router.get('/api/repos/:owner/:repo/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo } = req.params;
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.listBranches({ owner, repo });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/api/repos/:owner/:repo/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo } = req.params;
    const { branchName, fromBranch } = req.body;

    if (!branchName || !fromBranch) {
      res.status(400).json({ error: 'branchName and fromBranch are required' });
      return;
    }

    const octokit = new Octokit({ auth: token });
    
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${fromBranch}`,
    });

    const sha = refData.object.sha;

    const { data } = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
    });
    
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
