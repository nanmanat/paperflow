import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ExternalLink, Trash2, GitBranch, Book } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useProjectStore, type Project } from '@/store/projectStore'
import { getRepo } from '@/api/github'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useConfigStore } from '@/store/configStore'

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addProject } = useProjectStore()
  const { githubToken } = useConfigStore()
  const [form, setForm] = useState({ name: '', description: '', owner: '', repo: '', branch: 'main' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!githubToken) { toast.error('Set your GitHub token in Settings first'); return }
    setLoading(true)
    try {
      const repoData = await getRepo(form.owner, form.repo)
      await addProject({
        name: form.name || repoData.name,
        description: form.description || repoData.description || '',
        github: { owner: form.owner, repo: form.repo, defaultBranch: form.branch || repoData.default_branch }
      })
      toast.success('Project created!')
      onClose()
      setForm({ name: '', description: '', owner: '', repo: '', branch: 'main' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to verify repo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Connect a GitHub repository to create a project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">GitHub Owner</label>
              <Input placeholder="myusername" value={form.owner} onChange={e => setForm(f => ({...f, owner: e.target.value}))} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Repository</label>
              <Input placeholder="phd-thesis" value={form.repo} onChange={e => setForm(f => ({...f, repo: e.target.value}))} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Project Name <span className="text-muted-foreground font-normal">(optional, defaults to repo name)</span></label>
            <Input placeholder="My Research Project" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input placeholder="PhD thesis chapters" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Default Branch</label>
            <Input placeholder="main" value={form.branch} onChange={e => setForm(f => ({...f, branch: e.target.value}))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>{loading ? 'Verifying…' : 'Create Project'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const { deleteProject } = useProjectStore()
  const { githubToken } = useConfigStore()

  const handleDelete = async () => {
    if (!githubToken) { toast.error('Set your GitHub token in Settings to delete projects'); return }
    if (!confirm(`Delete "${project.name}"?`)) return
    try {
      await deleteProject(project.id)
      toast.success('Project deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }
  return (
    <div className="group rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center">
              <Book className="h-4 w-4 text-primary" />
            </div>
            <div>
              <Link to={`/projects/${project.id}`} className="font-semibold text-foreground hover:text-primary transition-colors text-sm">
                {project.name}
              </Link>
              <div className="flex items-center gap-1 mt-0.5">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{project.github.owner}/{project.github.repo}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Created {formatDate(project.createdAt)}</span>
          <div className="flex gap-1">
            <a
              href={`https://github.com/${project.github.owner}/${project.github.repo}`}
              target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 bg-muted/30 border-t border-border rounded-b-lg flex gap-3">
        <Link to={`/projects/${project.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">Board</Link>
        <Link to={`/projects/${project.id}/pulls`} className="text-xs text-muted-foreground hover:text-primary transition-colors">Pull Requests</Link>
      </div>
    </div>
  )
}

export function Home() {
  const { projects, loading, fetchProjects } = useProjectStore()
  const [showNew, setShowNew] = useState(false)
  const { githubToken } = useConfigStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your LaTeX research projects</p>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> New Project
          </Button>
        </div>

        {!githubToken && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex items-center gap-2">
            <span className="text-yellow-400 text-sm">⚠ No GitHub token configured — you can browse projects but cannot create, delete, or take actions.</span>
            <Link to="/settings" className="text-yellow-300 text-sm underline shrink-0">Set token</Link>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Book className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm mb-4">No projects yet. Connect a GitHub repo to get started.</p>
            <Button onClick={() => setShowNew(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
