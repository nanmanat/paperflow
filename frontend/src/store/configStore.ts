import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ConfigState {
  githubToken: string
  proxyUrl: string
  setGithubToken: (token: string) => void
  setProxyUrl: (url: string) => void
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      githubToken: '',
      proxyUrl: 'http://localhost:3001',
      setGithubToken: (token) => set({ githubToken: token }),
      setProxyUrl: (url) => set({ proxyUrl: url }),
    }),
    { name: 'paperflow-config' }
  )
)
