import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, GitPullRequest, GitMerge, XCircle, Clock, FileText, Plus, Minus, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { useProjectStore } from '@/store/projectStore';
import { useConfigStore } from '@/store/configStore';
import { listPulls, GitHubPR } from '@/api/github';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PRListPage() {
  const { id } = useParams<{ id: string }>();
  const project = useProjectStore((s) => s.getProject(id!));
  const { githubToken } = useConfigStore();

  const [prs, setPrs] = useState<GitHubPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'closed'>('open');

  const fetchPRs = useCallback(async () => {
    if (!project || !githubToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listPulls(project.github.owner, project.github.repo, tab);
      setPrs(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch merge requests');
      toast.error(e.message || 'Failed to fetch merge requests');
    } finally {
      setLoading(false);
    }
  }, [project, githubToken, tab]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  if (!project) return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  if (!githubToken) return <div className="p-8 text-center text-muted-foreground">GitHub token missing</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Merge Requests</h1>
          <p className="text-sm text-muted-foreground">{project.github.owner}/{project.github.repo}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchPRs} disabled={loading} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'closed')}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          {error}
        </div>
      ) : loading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : prs.length === 0 ? (
        <div className="text-center p-16 border border-dashed border-border rounded-lg bg-card/50">
          <GitPullRequest className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No merge requests found</h3>
          <p className="text-sm text-muted-foreground mt-1">There are no {tab} merge requests for this project.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          {prs.map((pr) => {
            const isMerged = pr.merged || (pr.state === 'closed' && pr.merged_at);
            const isClosed = pr.state === 'closed' && !isMerged;
            
            return (
              <div key={pr.number} className="flex items-start p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                <div className="mr-4 mt-1">
                  {isMerged ? (
                    <GitMerge className="w-5 h-5 text-purple-500" />
                  ) : isClosed ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : pr.draft ? (
                    <GitPullRequest className="w-5 h-5 text-gray-500" />
                  ) : (
                    <GitPullRequest className="w-5 h-5 text-green-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link to={`/projects/${project.id}/pulls/${pr.number}`} className="text-base font-semibold text-foreground hover:text-primary transition-colors truncate">
                      {pr.title}
                    </Link>
                    {pr.draft && <Badge variant="secondary">Draft</Badge>}
                    {isMerged && <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">Merged</Badge>}
                    {isClosed && <Badge variant="destructive">Closed</Badge>}
                    {!isMerged && !isClosed && !pr.draft && <Badge variant="success">Open</Badge>}
                  </div>
                  
                  <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                    <span className="font-mono text-xs text-foreground bg-muted px-1.5 py-0.5 rounded">!{pr.number}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(pr.created_at)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <img src={pr.user.avatar_url} alt={pr.user.login} className="w-4 h-4 rounded-full" />
                      <span>{pr.user.login}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono bg-muted/50 px-2 py-0.5 rounded border border-border">
                      <span className="truncate max-w-[150px]">{pr.head.ref}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{pr.base.ref}</span>
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end gap-1 text-sm shrink-0">
                  {pr.changed_files !== undefined && (
                    <div className="flex items-center gap-3 bg-muted/30 px-2 py-1 rounded">
                      <span className="flex items-center gap-1 text-muted-foreground" title="Changed files">
                        <FileText className="w-3.5 h-3.5" />
                        {pr.changed_files}
                      </span>
                      <span className="flex items-center text-green-500 font-mono text-xs" title="Additions">
                        <Plus className="w-3 h-3" />{pr.additions}
                      </span>
                      <span className="flex items-center text-red-500 font-mono text-xs" title="Deletions">
                        <Minus className="w-3 h-3" />{pr.deletions}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
