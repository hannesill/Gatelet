import { useState, type ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import clsx from 'clsx';

const tabs = ['Connections', 'API Keys', 'Audit Log'] as const;
export type TabName = (typeof tabs)[number];

function ConnectionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
      <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
    </svg>
  );
}

function AuditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z" clipRule="evenodd" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
    </svg>
  );
}

const tabMeta: Record<TabName, { icon: React.FC<{ className?: string }>; description: string }> = {
  'Connections': { icon: ConnectionsIcon, description: 'OAuth accounts' },
  'API Keys': { icon: KeyIcon, description: 'Agent credentials' },
  'Audit Log': { icon: AuditIcon, description: 'Request history' },
};

// Page headings for the content area
const pageHeadings: Record<TabName, { title: string; description: string }> = {
  'Connections': { title: 'Connections', description: 'Manage OAuth connections and their access policies.' },
  'API Keys': { title: 'API Keys', description: 'Create and manage credentials for your agents.' },
  'Audit Log': { title: 'Audit Log', description: 'Review tool calls and policy decisions.' },
};

interface LayoutProps {
  summary: { connections: number; tools: number };
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  onLogout: () => void;
  children: ReactNode;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light' as const, icon: SunIcon, label: 'Light' },
    { value: 'dark' as const, icon: MoonIcon, label: 'Dark' },
    { value: 'system' as const, icon: MonitorIcon, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={clsx(
            'rounded-md p-1.5 transition-colors',
            theme === opt.value
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
          )}
        >
          <opt.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function SidebarNav({
  activeTab,
  onTabChange,
  summary,
  onLogout,
  onNavigate,
}: {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  summary: { connections: number; tools: number };
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex h-full min-h-0 flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-5 dark:border-white/5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-sm shadow-blue-600/30">
          <ShieldIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">Gatelet</span>
          <p className="text-[11px] leading-tight text-zinc-500">Permission Proxy</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Navigation
        </p>
        <div className="space-y-0.5">
          {tabs.map(tab => {
            const { icon: Icon } = tabMeta[tab];
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { onTabChange(tab); onNavigate?.(); }}
                className={clsx(
                  'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-950/5 text-zinc-900 dark:bg-white/10 dark:text-white'
                    : 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200',
                )}
              >
                {active && (
                  <span className="absolute inset-y-1.5 -left-3 w-0.5 rounded-full bg-blue-500" />
                )}
                <Icon className={clsx('h-5 w-5 shrink-0 transition-colors', active ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400')} />
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 px-5 py-4 dark:border-white/5">
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Connections</span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{summary.connections}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Active tools</span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{summary.tools}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <SignOutIcon className="h-4 w-4" />
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

export function Layout({ summary, activeTab, onTabChange, onLogout, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const heading = pageHeadings[activeTab];

  return (
    <div className="relative isolate flex min-h-screen w-full max-lg:flex-col lg:bg-zinc-100 dark:lg:bg-zinc-950">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">
        <SidebarNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          summary={summary}
          onLogout={onLogout}
        />
      </div>

      {/* Mobile header */}
      <header className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3 dark:border-white/5 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="-ml-1 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
            <ShieldIcon className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">Gatelet</span>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-xs dark:bg-zinc-950/60" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl shadow-black/10 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-white/10">
            <div className="absolute right-3 top-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav
              activeTab={activeTab}
              onTabChange={onTabChange}
              summary={summary}
              onLogout={onLogout}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <main className="flex flex-1 flex-col pb-2 lg:min-w-0 lg:pl-64 lg:pt-2 lg:pr-2">
        <div className="grow p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-sm lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:shadow-none dark:lg:ring-white/10">
          <div className="mx-auto max-w-4xl">
            {/* Page heading */}
            <div className="mb-8">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{heading.title}</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{heading.description}</p>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
