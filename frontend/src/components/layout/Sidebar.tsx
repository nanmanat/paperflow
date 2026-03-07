import { Link, useLocation, useParams } from 'react-router-dom'
import { LayoutDashboard, GitPullRequest, Settings, BookOpen, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/projectStore'
import { useState } from 'react'

export function Sidebar() {
  const location = useLocation()
  const { id: projectId } = useParams()
  const { projects } = useProjectStore()
  const [projectsOpen, setProjectsOpen] = useState(true)

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <aside className="w-56 shrink-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-foreground text-sm">Paperflow</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-1">
        {/* Home */}
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
            isActive('/') && location.pathname === '/'
              ? 'bg-primary/20 text-primary'
              : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Projects
        </Link>

        {/* Projects */}
        {projects.length > 0 && (
          <div>
            <button
              onClick={() => setProjectsOpen(!projectsOpen)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span>Projects</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', projectsOpen ? '' : '-rotate-90')} />
            </button>
            {projectsOpen && (
              <div className="ml-2 space-y-0.5">
                {projects.map((project) => (
                  <div key={project.id}>
                    <Link
                      to={`/projects/${project.id}`}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors truncate',
                        projectId === project.id
                          ? 'bg-primary/20 text-primary'
                          : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <span className="truncate">{project.name}</span>
                    </Link>
                    {projectId === project.id && (
                      <div className="ml-4 space-y-0.5">
                        <Link
                          to={`/projects/${project.id}`}
                          className={cn('flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-colors',
                            location.pathname === `/projects/${project.id}` ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                        >
                          <LayoutDashboard className="h-3 w-3" /> Board
                        </Link>
                        <Link
                          to={`/projects/${project.id}/pulls`}
                          className={cn('flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-colors',
                            location.pathname.includes('/pulls') ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                        >
                          <GitPullRequest className="h-3 w-3" /> Pull Requests
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Settings */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
            isActive('/settings')
              ? 'bg-primary/20 text-primary'
              : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
