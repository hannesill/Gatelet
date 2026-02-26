import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider, useToast } from './hooks/useToast';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Connections } from './pages/Connections';
import { ApiKeys } from './pages/ApiKeys';
import { AuditLog } from './pages/AuditLog';
import { Settings } from './pages/Settings';
import { Layout, type TabName } from './components/Layout';
import { api } from './api';
import { Logo } from './components/Logo';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Status } from './types';

/** Check auth by fetching /api/status — returns data on success, null on 401, throws on network error */
async function checkAuth(): Promise<{ status: Status } | { error: 'unauthorized' } | { error: 'network' }> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return { error: 'unauthorized' };
    const status = await res.json() as Status;
    return { status };
  } catch {
    return { error: 'network' };
  }
}

function AppContent() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('Connections');
  const [showSetup, setShowSetup] = useState(false);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    const result = await checkAuth();
    if ('status' in result) {
      setNetworkError(false);
      setStatus(result.status);
      setAuthed(true);
      // Show setup wizard for first-time users
      if (!result.status.setupCompleted) {
        setShowSetup(true);
      }
    } else if (result.error === 'network') {
      setNetworkError(true);
    } else {
      setNetworkError(false);
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Listen for auth expiration from any API call
  useEffect(() => {
    function handleAuthExpired() {
      setAuthed(false);
      setStatus(null);
    }
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('oauth') === 'success') {
      const provider = params.get('provider') ?? '';
      toast(`Connected ${provider.replace('_', ' ')}`);
      history.replaceState(null, '', '/');
      fetchStatus();
    }
    if (params.get('oauth') === 'error') {
      toast(params.get('message') || 'Connection failed', 'error');
      history.replaceState(null, '', '/');
    }
  }, []);

  async function handleLogout() {
    await api.logout();
    setAuthed(false);
    setStatus(null);
  }

  // Network error
  if (networkError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo className="h-10 w-10 text-zinc-400" />
        <p className="text-sm text-zinc-500">Cannot reach server</p>
        <button
          onClick={fetchStatus}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading
  if (authed === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo className="h-10 w-10 text-zinc-400 animate-pulse" />
        <svg className="h-5 w-5 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // Not authenticated
  if (!authed) {
    return <Login onLogin={fetchStatus} />;
  }

  // Setup wizard for first-time users
  if (showSetup && status) {
    return (
      <Setup
        oauthProviders={status.oauthProviders}
        connections={status.connections}
        runtime={status.runtime}
        onComplete={async () => {
          await api.completeSetup();
          setShowSetup(false);
          fetchStatus();
        }}
        onRefresh={fetchStatus}
      />
    );
  }

  // Dashboard
  if (!status) return null;

  const summary = {
    connections: status.connections.length,
    tools: status.tools.filter(t => t.enabled).length,
    uptime: status.uptime,
  };

  return (
    <Layout
      summary={summary}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'Connections' && (
        <Connections status={status} onRefresh={fetchStatus} />
      )}
      {activeTab === 'API Keys' && <ApiKeys runtime={status.runtime} />}
      {activeTab === 'Audit Log' && <AuditLog />}
      {activeTab === 'Settings' && <Settings />}
    </Layout>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}
