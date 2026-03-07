import { Router, Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';

const router = Router();

router.get('/api/repos/:owner/:repo/pulls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo } = req.params;
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';
    
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.list({ owner, repo, state });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo/pulls/:number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo, number } = req.params;
    const pull_number = parseInt(number, 10);
    
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo/pulls/:number/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo, number } = req.params;
    const pull_number = parseInt(number, 10);
    
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.listFiles({ owner, repo, pull_number });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo/pulls/:number/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo, number } = req.params;
    const pull_number = parseInt(number, 10);
    
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number,
      mediaType: { format: 'diff' },
    });
    
    res.set('Content-Type', 'text/plain');
    res.send(data);
  } catch (error) {
    next(error);
  }
});

router.post('/api/repos/:owner/:repo/pulls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo } = req.params;
    const { title, body, head, base } = req.body;

    if (!title || !head || !base) {
      res.status(400).json({ error: 'title, head, and base are required' });
      return;
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body: body || '',
      head,
      base,
    });
    
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/api/repos/:owner/:repo/pulls/:number/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    
    if (!token) {
      res.status(401).json({ error: 'Missing X-Github-Token header' });
      return;
    }

    const { owner, repo, number } = req.params;
    const pull_number = parseInt(number, 10);
    const { merge_method, commit_title, commit_message } = req.body;

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number,
      merge_method,
      commit_title,
      commit_message,
    });
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo/pulls/:number/threads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { owner, repo, number } = req.params;
    const pull_number = parseInt(number, 10);
    const octokit = new Octokit({ auth: token });

    const data = await octokit.graphql<{
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: Array<{
              id: string;
              isResolved: boolean;
              resolvedBy: { login: string } | null;
              comments: {
                nodes: Array<{
                  id: string;
                  databaseId: number;
                  body: string;
                  author: { login: string; avatarUrl: string } | null;
                  createdAt: string;
                  path: string;
                  line: number | null;
                  originalLine: number | null;
                  diffHunk: string;
                  url: string;
                }>;
              };
            }>;
          };
        } | null;
      } | null;
    }>(`
      query PullRequestThreads($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                resolvedBy { login }
                comments(first: 50) {
                  nodes {
                    id
                    databaseId
                    body
                    author { login avatarUrl }
                    createdAt
                    path
                    line
                    originalLine
                    diffHunk
                    url
                  }
                }
              }
            }
          }
        }
      }
    `, { owner, repo, number: pull_number });

    const threads = data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
    res.json(threads);
  } catch (error) {
    next(error);
  }
});

router.get('/api/repos/:owner/:repo/issues/:number/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { owner, repo, number } = req.params;
    const issue_number = parseInt(number, 10);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.listComments({ owner, repo, issue_number });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/api/repos/:owner/:repo/pulls/threads/:threadId/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-github-token'] as string;
    if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }

    const { threadId } = req.params;
    const octokit = new Octokit({ auth: token });

    await octokit.graphql(`
      mutation ResolveThread($id: ID!) {
        resolveReviewThread(input: { threadId: $id }) {
          thread { isResolved }
        }
      }
    `, { id: threadId });

    res.json({ resolved: true });
  } catch (error) {
    next(error);
  }
});

export default router;
