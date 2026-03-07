import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitMerge, GitPullRequest, XCircle, Clock, FileText, Plus, Minus, Check, ExternalLink, CheckCheck, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

import { useProjectStore } from '@/store/projectStore';
import { useConfigStore } from '@/store/configStore';
import { useKanbanStore } from '@/store/kanbanStore';
import { getPull, getPullFiles, mergePull, compileLatex, getPRThreads, getPRIssueComments, resolveReviewThread, GitHubPR, GitHubPRFile, GitHubReviewThread, GitHubIssueComment } from '@/api/github';
import { formatDate } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';

type PdfState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; message: string };

function changedLinesFromHunk(diffHunk: string): string[] {
  const lines = diffHunk.split('\n').filter((l) => !l.startsWith('@@'));
  const changed = lines.filter((l) => l.startsWith('+') || l.startsWith('-'));
  const last = changed.length > 0 ? changed[changed.length - 1] : lines[lines.length - 1];
  return last ? [last] : [];
}

export function PRViewPage() {
  const { id, number } = useParams<{ id: string; number: string }>();
  const prNum = parseInt(number || '0', 10);
  const navigate = useNavigate();

  const { projects, loading: projectsLoading, fetchProjects, getProject } = useProjectStore();
  const project = getProject(id!);
  const { githubToken } = useConfigStore();
  const { cards, updateCard, moveCard } = useKanbanStore();

  const [pr, setPr] = useState<GitHubPR | null>(null);
  const [files, setFiles] = useState<GitHubPRFile[]>([]);
  const [threads, setThreads] = useState<GitHubReviewThread[]>([]);
  const [issueComments, setIssueComments] = useState<GitHubIssueComment[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const [texFiles, setTexFiles] = useState<GitHubPRFile[]>([]);
  const [selectedTexFile, setSelectedTexFile] = useState<string>('');
  const [headPdf, setHeadPdf] = useState<PdfState>({ status: 'idle' });

  const fetchPRData = useCallback(async () => {
    if (!project || !githubToken || isNaN(prNum)) return;
    setLoading(true);
    setError(null);
    try {
      const [prData, filesData, threadsData, issueCommentsData] = await Promise.all([
        getPull(project.github.owner, project.github.repo, prNum),
        getPullFiles(project.github.owner, project.github.repo, prNum),
        getPRThreads(project.github.owner, project.github.repo, prNum).catch(() => [] as GitHubReviewThread[]),
        getPRIssueComments(project.github.owner, project.github.repo, prNum).catch(() => [] as GitHubIssueComment[]),
      ]);
      setPr(prData);
      setFiles(filesData);
      setThreads(threadsData);
      setIssueComments(issueCommentsData);
      setResolvedIds(new Set(threadsData.filter((t) => t.isResolved).map((t) => t.id)));
      const tex = filesData.filter((f) => f.filename.endsWith('.tex'));
      setTexFiles(tex);
      if (tex.length > 0 && !selectedTexFile) {
        setSelectedTexFile(tex[0].filename);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load merge request details');
    } finally {
      setLoading(false);
    }
  }, [project, githubToken, prNum, selectedTexFile]);

  useEffect(() => { fetchPRData(); }, [fetchPRData]);

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedTexFile || !pr || !project) return;

    setHeadPdf({ status: 'idle' });

    async function compileRef(
      sha: string,
      setState: (s: PdfState) => void,
    ) {
      setState({ status: 'loading' });
      try {
        const result = await compileLatex(
          project!.github.owner,
          project!.github.repo,
          sha,
          selectedTexFile,
        );
        if ('error' in result) {
          setState({ status: 'error', message: result.error });
        } else {
          setState({ status: 'ready', url: result.pdfUrl });
        }
      } catch (e: any) {
        setState({ status: 'error', message: e.message || 'Failed' });
      }
    }

    compileRef(pr.head.sha, setHeadPdf);
  }, [selectedTexFile, pr, project, files]);

  const handleResolve = async (threadId: string) => {
    if (!project) return;
    setResolvingId(threadId);
    try {
      await resolveReviewThread(project.github.owner, project.github.repo, threadId);
      setResolvedIds((prev) => new Set([...prev, threadId]));
    } catch (e: any) {
      toast.error(e.message || 'Failed to resolve thread');
    } finally {
      setResolvingId(null);
    }
  };

  const handleMerge = async () => {
    if (!project || !pr) return;
    setIsMerging(true);
    try {
      await mergePull(project.github.owner, project.github.repo, pr.number, {
        merge_method: 'squash',
        commit_title: `${pr.title} (!${pr.number})`
      });
      toast.success('Merge request merged successfully');
      const card = Object.values(cards).find((c) => c.projectId === project.id && c.prNumber === pr.number);
      if (card) {
        updateCard(project.id, card.id, { prMerged: true });
        if (card.column !== 'done') moveCard(project.id, card.id, 'done');
      }
      await fetchPRData();
    } catch (e: any) {
      toast.error(e.message || 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  if (projectsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!project || !githubToken) {
    return <div className="p-8 text-center text-muted-foreground">Setup required.</div>;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Button variant="ghost" className="-ml-4 text-muted-foreground hover:text-foreground mb-2" onClick={() => navigate(`/projects/${project.id}/pulls`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Merge Requests
        </Button>
        <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md border border-destructive/20">{error}</div>
      </div>
    );
  }

  if (loading || !pr) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Button variant="ghost" disabled className="-ml-4 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="h-32 bg-card/50 animate-pulse rounded-lg border border-border" />
      </div>
    );
  }

  const isMerged = pr.merged || (pr.state === 'closed' && pr.merged_at);
  const isClosed = pr.state === 'closed' && !isMerged;
  const canMerge = pr.state === 'open' && !pr.draft;

  return (
    <div className="mx-auto px-4 py-3 space-y-3 flex flex-col h-full">
      <div className="flex-none space-y-2">
        <Button variant="ghost" className="-ml-3 text-muted-foreground hover:text-foreground text-xs h-7 px-2" onClick={() => navigate(`/projects/${project.id}/pulls`)}>
          <ArrowLeft className="w-3 h-3 mr-1" /> Back
        </Button>

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {pr.title} <span className="text-muted-foreground font-normal text-sm">!{pr.number}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {isMerged ? (
                <Badge className="bg-purple-500 hover:bg-purple-600 px-1.5 py-0 text-xs"><GitMerge className="w-3 h-3 mr-0.5"/> Merged</Badge>
              ) : isClosed ? (
                <Badge variant="destructive" className="px-1.5 py-0 text-xs"><XCircle className="w-3 h-3 mr-0.5"/> Closed</Badge>
              ) : pr.draft ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs"><GitPullRequest className="w-3 h-3 mr-0.5"/> Draft</Badge>
              ) : (
                <Badge variant="success" className="px-1.5 py-0 text-xs"><GitPullRequest className="w-3 h-3 mr-0.5"/> Open</Badge>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <img src={pr.user.avatar_url} alt={pr.user.login} className="w-4 h-4 rounded-full" />
                <span className="font-medium text-foreground">{pr.user.login}</span>
                <span className="hidden sm:inline">into</span>
                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">{pr.base.ref}</Badge>
                <span>&larr;</span>
                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">{pr.head.ref}</Badge>
              </div>
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(pr.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canMerge && (
              <Button onClick={handleMerge} disabled={isMerging} className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs px-3">
                {isMerging
                  ? <span className="flex items-center"><Clock className="w-3 h-3 mr-1 animate-spin"/> Merging...</span>
                  : <span className="flex items-center"><Check className="w-3 h-3 mr-1"/> Merge</span>
                }
              </Button>
            )}
            {isMerged && (
              <Button disabled variant="outline" className="border-purple-500 text-purple-500 h-7 text-xs px-3">
                <GitMerge className="w-3 h-3 mr-1" /> Merged
              </Button>
            )}
          </div>
        </div>

        {pr.body && (
          <div className="bg-muted/30 px-3 py-2 rounded border border-border/50 text-xs whitespace-pre-wrap">
            {pr.body}
          </div>
        )}
      </div>

      <Tabs defaultValue="latex" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-none w-fit">
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="latex">LaTeX Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="flex-1 overflow-auto mt-2 outline-none">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                <span>{pr.changed_files} files</span>
                <span className="text-green-500 flex items-center gap-0.5"><Plus className="w-2.5 h-2.5" />{pr.additions}</span>
                <span className="text-red-500 flex items-center gap-0.5"><Minus className="w-2.5 h-2.5" />{pr.deletions}</span>
              </div>
              <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-1.5 text-xs h-7 px-2.5">
                  <ExternalLink className="w-3 h-3" /> View on GitHub
                </Button>
              </a>
            </div>

            {threads.length === 0 && issueComments.length === 0 ? (
              <div className="border border-border rounded p-8 flex flex-col items-center gap-2 text-center text-muted-foreground">
                <MessageSquare className="w-5 h-5 opacity-40" />
                <span className="text-xs">No review comments on this pull request.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((thread) => {
                  const isResolved = resolvedIds.has(thread.id);
                  const firstComment = thread.comments.nodes[0];
                  if (!firstComment) return null;
                  return (
                    <div key={thread.id} className={`border rounded overflow-hidden ${isResolved ? 'border-border/40 opacity-60' : 'border-border'}`}>
                      <div className="bg-muted/40 px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border/50">
                        <div className="flex items-center gap-2 min-w-0">
                          {isResolved && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">Resolved</Badge>}
                          <span className="font-mono text-[11px] text-muted-foreground truncate">{firstComment.path}{firstComment.line ? `:${firstComment.line}` : ''}</span>
                        </div>
                        {!isResolved && (
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-[11px] gap-1 shrink-0"
                            disabled={resolvingId === thread.id}
                            onClick={() => handleResolve(thread.id)}
                          >
                            {resolvingId === thread.id
                              ? <><Clock className="w-3 h-3 animate-spin" /> Resolving…</>
                              : <><CheckCheck className="w-3 h-3" /> Resolve</>
                            }
                          </Button>
                        )}
                      </div>

                      {firstComment.diffHunk && (
                        <pre className="text-[10px] leading-5 font-mono overflow-x-auto bg-[#0d1117] px-3 py-2 border-b border-border/50">
                          {changedLinesFromHunk(firstComment.diffHunk).map((line, i) => (
                            <div
                              key={i}
                              className={
                                line.startsWith('+') ? 'text-green-400' :
                                line.startsWith('-') ? 'text-red-400' :
                                'text-gray-300'
                              }
                            >{line}</div>
                          ))}
                        </pre>
                      )}

                      <div className="divide-y divide-border/30">
                        {thread.comments.nodes.map((comment, idx) => (
                          <div key={comment.id} className={`px-3 py-2 flex gap-2.5 ${idx > 0 ? 'bg-muted/20' : ''}`}>
                            {comment.author && (
                              <img src={comment.author.avatarUrl} alt={comment.author.login} className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="font-medium text-foreground">{comment.author?.login ?? 'ghost'}</span>
                                <span className="text-muted-foreground">{formatDate(comment.createdAt)}</span>
                                <a href={comment.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-muted-foreground hover:text-foreground">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-wrap break-words">{comment.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {issueComments.map((comment) => (
                  <div key={comment.id} className="border border-border rounded px-3 py-2 flex gap-2.5">
                    <img src={comment.user.avatar_url} alt={comment.user.login} className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-medium text-foreground">{comment.user.login}</span>
                        <span className="text-muted-foreground">{formatDate(comment.created_at)}</span>
                        <a href={comment.html_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap break-words">{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="latex" className="flex-1 mt-2 outline-none flex flex-col min-h-0">
          <div className="border border-border rounded overflow-hidden flex-1 flex flex-col min-h-0">
            {texFiles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No LaTeX (.tex) files changed in this merge request.
              </div>
            ) : (
              <>
                <div className="bg-muted px-3 py-1.5 border-b border-border flex items-center gap-3 flex-none">
                  <span className="text-xs font-medium text-foreground">File:</span>
                  <Select value={selectedTexFile} onChange={(e) => setSelectedTexFile(e.target.value)} className="w-[280px] h-6 text-xs">
                    {texFiles.map((f) => (
                      <option key={f.filename} value={f.filename}>{f.filename}</option>
                    ))}
                  </Select>
                </div>

                <div className="flex-1 min-h-0">
                  <PdfPanel label={pr.head.ref} state={headPdf} />
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PdfPanel({ label, state }: { label: string; state: PdfState }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none px-2 py-1 bg-muted/50 border-b border-border text-[10px] font-semibold text-center uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex-1 min-h-0">
        {state.status === 'idle' && (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">No file</div>
        )}
        {state.status === 'loading' && (
          <div className="h-full flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 animate-spin" /> Compiling…
          </div>
        )}
        {state.status === 'error' && (
          <div className="h-full flex items-center justify-center p-4">
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive max-w-sm whitespace-pre-wrap">
              {state.message}
            </div>
          </div>
        )}
        {state.status === 'ready' && (
          <iframe
            src={state.url}
            className="w-full h-full border-0"
            title={`PDF preview — ${label}`}
          />
        )}
      </div>
    </div>
  );
}
