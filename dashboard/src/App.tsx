import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider, useToast } from './hooks/useToast';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Connections } from './pages/Connections';
import { ApiKeys } from './pages/ApiKeys';
import { AuditLog } from './pages/AuditLog';
import { Layout, type TabName } from './components/Layout';
import { api } from './api';
import type { Status } from './types';

/** Check auth by fetching /api/status — returns data on success, null on 401 */
async function checkAuth(): Promise<Status | null> {
  const res = await fetch('/api/status');
  if (!res.ok) return null;
  return res.json();
}

function AppContent() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Connections');
  const [showSetup, setShowSetup] = useState(false);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    const data = await checkAuth();
    if (data) {
      setStatus(data);
      setAuthed(true);
      // Show setup wizard for first-time users
      if (data.connections.length === 0 && data.apiKeys.active === 0) {
        setShowSetup(true);
      }
    } else {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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

  // Loading — show nothing to avoid flicker
  if (authed === null) return null;

  // Not authenticated
  if (!authed) {
    return <Login onLogin={fetchStatus} />;
  }

  // Setup wizard for first-time users
  if (showSetup && status) {
    return (
      <Setup
        oauthProviders={status.oauthProviders}
        onComplete={() => {
          setShowSetup(false);
          fetchStatus();
        }}
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
      {activeTab === 'API Keys' && <ApiKeys />}
      {activeTab === 'Audit Log' && <AuditLog />}
    </Layout>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
