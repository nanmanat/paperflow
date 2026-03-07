import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfigStore } from '@/store/configStore'
import { getUser } from '@/api/github'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Eye, EyeOff, Key, Server } from 'lucide-react'

export function Settings() {
  const { githubToken, proxyUrl, setGithubToken, setProxyUrl } = useConfigStore()
  const [token, setToken] = useState(githubToken)
  const [proxy, setProxy] = useState(proxyUrl)
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    setGithubToken(token)
    setProxyUrl(proxy)
    toast.success('Settings saved')
  }

  const handleTest = async () => {
    setTesting(true)
    setStatus(null)
    // Temporarily set token for the test
    setGithubToken(token)
    setProxyUrl(proxy)
    try {
      const user = await getUser()
      setStatus({ ok: true, message: `Connected as @${user.login}` })
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Configure your GitHub connection</p>
      </div>

      <div className="space-y-6">
        {/* GitHub Token */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">GitHub Personal Access Token</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Create a PAT at{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              github.com/settings/tokens
            </a>{' '}
            with <code className="bg-muted px-1 rounded text-xs">repo</code> scope.
          </p>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {status && (
            <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${status.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {status.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {status.message}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !token}>
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>
        </div>

        {/* Proxy URL */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Backend Proxy URL</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            The local Express proxy server URL. Default is <code className="bg-muted px-1 rounded">http://localhost:3001</code>.
          </p>
          <Input
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="http://localhost:3001"
          />
        </div>

        <Button onClick={handleSave} className="w-full">Save Settings</Button>
      </div>
    </div>
  )
}
