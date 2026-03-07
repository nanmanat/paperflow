import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/utils'

export interface Project {
  id: string
  name: string
  description: string
  github: {
    owner: string
    repo: string
    defaultBranch: string
  }
  createdAt: string
}

interface ProjectState {
  projects: Project[]
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => Project
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  getProject: (id: string) => Project | undefined
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      addProject: (project) => {
        const newProject: Project = { ...project, id: generateId(), createdAt: new Date().toISOString() }
        set((state) => ({ projects: [...state.projects, newProject] }))
        return newProject
      },
      updateProject: (id, updates) =>
        set((state) => ({ projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
      deleteProject: (id) =>
        set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
      getProject: (id) => get().projects.find((p) => p.id === id),
    }),
    { name: 'paperflow-projects' }
  )
)
