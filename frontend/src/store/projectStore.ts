import { create } from 'zustand'
import { listProjects, createProject, deleteProjectRemote, type SharedProject } from '@/api/github'

export type Project = SharedProject

interface ProjectState {
  projects: Project[]
  loading: boolean
  fetchProjects: () => Promise<void>
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  getProject: (id: string) => Project | undefined
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  loading: false,
  fetchProjects: async () => {
    set({ loading: true })
    try {
      const projects = await listProjects()
      set({ projects })
    } finally {
      set({ loading: false })
    }
  },
  addProject: async (project) => {
    const newProject = await createProject(project)
    set((state) => ({ projects: [newProject, ...state.projects] }))
    return newProject
  },
  deleteProject: async (id) => {
    await deleteProjectRemote(id)
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
  },
  getProject: (id) => get().projects.find((p) => p.id === id),
}))
