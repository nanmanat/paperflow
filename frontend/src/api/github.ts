import { useConfigStore } from '@/store/configStore'

class GitHubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { proxyUrl, githubToken } = useConfigStore.getState()
  const url = `${proxyUrl}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Github-Token': githubToken,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new GitHubApiError(res.status, err.error ?? err.message ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('text/plain') || contentType.includes('text/x-diff')) {
    return res.text() as Promise<T>
  }
  return res.json() as Promise<T>
}

export type ColumnId = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'

export interface KanbanCard {
  id: string
  projectId: string
  title: string
  description: string
  column: ColumnId
  branchName?: string
  prNumber?: number
  prMerged?: boolean
  createdAt: string
  updatedAt: string
}

export interface KanbanBoard {
  cards: Record<string, KanbanCard>
  columns: Record<ColumnId, string[]>
}

export const getBoard = (projectId: string) =>
  request<KanbanBoard>(`/api/projects/${projectId}/board`)

export const createCard = (projectId: string, data: Pick<KanbanCard, 'title' | 'description' | 'column'>) =>
  request<{ card: KanbanCard; columns: Record<ColumnId, string[]> }>(`/api/projects/${projectId}/cards`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateCard = (projectId: string, cardId: string, data: Partial<Omit<KanbanCard, 'id' | 'projectId' | 'createdAt'>>) =>
  request<{ card: KanbanCard; columns: Record<ColumnId, string[]> }>(`/api/projects/${projectId}/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

export const deleteCard = (projectId: string, cardId: string) =>
  request<void>(`/api/projects/${projectId}/cards/${cardId}`, { method: 'DELETE' })

export const updateColumns = (projectId: string, columns: Record<ColumnId, string[]>) =>
  request<Record<ColumnId, string[]>>(`/api/projects/${projectId}/columns`, {
    method: 'PUT',
    body: JSON.stringify(columns),
  })

export interface SharedProject {
  id: string;
  name: string;
  description: string;
  github: { owner: string; repo: string; defaultBranch: string };
  createdAt: string;
}

export const listProjects = () => request<SharedProject[]>('/api/projects')
export const createProject = (data: Omit<SharedProject, 'id' | 'createdAt'>) =>
  request<SharedProject>('/api/projects', { method: 'POST', body: JSON.stringify(data) })
export const deleteProjectRemote = (id: string) =>
  request<void>(`/api/projects/${id}`, { method: 'DELETE' })

// User
export const getUser = () => request<{ login: string; name: string; avatar_url: string }>('/api/user')

// Repos
export const listRepos = () => request<GitHubRepo[]>('/api/repos')
export const getRepo = (owner: string, repo: string) => request<GitHubRepo>(`/api/repos/${owner}/${repo}`)

// Branches
export const listBranches = (owner: string, repo: string) =>
  request<GitHubBranch[]>(`/api/repos/${owner}/${repo}/branches`)
export const createBranch = (owner: string, repo: string, branchName: string, fromBranch: string) =>
  request<GitHubBranch>(`/api/repos/${owner}/${repo}/branches`, {
    method: 'POST',
    body: JSON.stringify({ branchName, fromBranch }),
  })

// Pull Requests
export const listPulls = (owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') =>
  request<GitHubPR[]>(`/api/repos/${owner}/${repo}/pulls?state=${state}`)
export const getPull = (owner: string, repo: string, number: number) =>
  request<GitHubPR>(`/api/repos/${owner}/${repo}/pulls/${number}`)
export const getPullFiles = (owner: string, repo: string, number: number) =>
  request<GitHubPRFile[]>(`/api/repos/${owner}/${repo}/pulls/${number}/files`)
export const getPullDiff = (owner: string, repo: string, number: number) =>
  request<string>(`/api/repos/${owner}/${repo}/pulls/${number}/diff`)
export const createPull = (owner: string, repo: string, data: { title: string; body: string; head: string; base: string }) =>
  request<GitHubPR>(`/api/repos/${owner}/${repo}/pulls`, { method: 'POST', body: JSON.stringify(data) })
export const mergePull = (owner: string, repo: string, number: number, data?: { merge_method?: string; commit_title?: string }) =>
  request<{ merged: boolean; message: string }>(`/api/repos/${owner}/${repo}/pulls/${number}/merge`, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: 'squash', ...data }),
  })

// File contents
export const getFileContent = (owner: string, repo: string, path: string, ref?: string) =>
  request<string>(`/api/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`)

export const getTexFiles = (owner: string, repo: string, ref: string) =>
  request<string[]>(`/api/repos/${owner}/${repo}/tree?ref=${encodeURIComponent(ref)}`)

// Types
export interface GitHubRepo {
  id: number; name: string; full_name: string; description: string | null;
  private: boolean; html_url: string; default_branch: string;
  owner: { login: string; avatar_url: string };
  updated_at: string; pushed_at: string; open_issues_count: number;
}

export interface GitHubBranch {
  name: string; commit: { sha: string }; protected: boolean;
}

export interface GitHubPR {
  number: number; title: string; body: string | null; state: 'open' | 'closed';
  merged: boolean; merged_at: string | null; created_at: string; updated_at: string;
  html_url: string; draft: boolean;
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string; repo: { full_name: string } };
  base: { ref: string; sha: string };
  changed_files: number; additions: number; deletions: number;
  mergeable: boolean | null; mergeable_state: string;
}

export interface GitHubPRFile {
  filename: string; status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number; deletions: number; changes: number; patch?: string;
}

export interface GitHubThreadComment {
  id: string;
  databaseId: number;
  body: string;
  author: { login: string; avatarUrl: string } | null;
  createdAt: string;
  path: string;
  line: number | null;
  startLine: number | null;
  originalLine: number | null;
  originalStartLine: number | null;
  diffHunk: string;
  url: string;
}

export interface GitHubReviewThread {
  id: string;
  isResolved: boolean;
  resolvedBy: { login: string } | null;
  comments: { nodes: GitHubThreadComment[] };
}

export interface GitHubIssueComment {
  id: number;
  node_id: string;
  body: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
}

export const getPRThreads = (owner: string, repo: string, number: number) =>
  request<GitHubReviewThread[]>(`/api/repos/${owner}/${repo}/pulls/${number}/threads`)

export const getPRIssueComments = (owner: string, repo: string, number: number) =>
  request<GitHubIssueComment[]>(`/api/repos/${owner}/${repo}/issues/${number}/comments`)

export const resolveReviewThread = (owner: string, repo: string, threadId: string) =>
  request<{ resolved: boolean }>(`/api/repos/${owner}/${repo}/pulls/threads/${encodeURIComponent(threadId)}/resolve`, { method: 'PUT' })

export async function compileLatex(
  owner: string,
  repo: string,
  ref: string,
  filepath: string,
): Promise<{ pdfUrl: string } | { error: string }> {
  const { proxyUrl, githubToken } = useConfigStore.getState()
  const res = await fetch(`${proxyUrl}/api/latex/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Github-Token': githubToken },
    body: JSON.stringify({ owner, repo, ref, filepath }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Compile failed' })) as { error?: string }
    return { error: body.error ?? 'Compile failed' }
  }
  const blob = await res.blob()
  return { pdfUrl: URL.createObjectURL(blob) }
}
