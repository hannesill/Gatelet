import { useState, type ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './Logo';
import { 
  Link2, 
  Key, 
  FileText, 
  LogOut, 
  Menu, 
  X, 
  Shield, 
  Sun, 
  Moon, 
  Monitor,
  Activity,
  Zap
} from 'lucide-react';

const tabs = ['Connections', 'API Keys', 'Audit Log'] as const;
export type TabName = (typeof tabs)[number];

const tabMeta: Record<TabName, { icon: any; description: string }> = {
  'Connections': { icon: Link2, description: 'OAuth accounts' },
  'API Keys': { icon: Key, description: 'Agent credentials' },
  'Audit Log': { icon: FileText, description: 'Request history' },
};

const pageHeadings: Record<TabName, { title: string; description: string }> = {
  'Connections': { title: 'Connections', description: 'Manage OAuth connections and their access policies.' },
  'API Keys': { title: 'API Keys', description: 'Create and manage credentials for your agents.' },
  'Audit Log': { title: 'Audit Log', description: 'Review tool calls and policy decisions.' },
};

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

interface LayoutProps {
  summary: { connections: number; tools: number; uptime: number };
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  onLogout: () => void;
  children: ReactNode;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-100/50 p-1 dark:bg-white/5 ring-1 ring-zinc-950/5 dark:ring-white/10">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={cn(
            'relative rounded-full p-1.5 transition-all duration-200',
            theme === opt.value
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-white/10 dark:text-indigo-400'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
          )}
        >
          {theme === opt.value && (
            <motion.div
              layoutId="theme-pill"
              className="absolute inset-0 rounded-full bg-white dark:bg-white/10 shadow-sm"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <opt.icon className="relative z-10 h-3.5 w-3.5" />
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
  summary: { connections: number; tools: number; uptime: number };
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex h-full min-h-0 flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3.5 px-6 py-8">
        <div className="glow-indigo flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
          <Logo className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="font-[Fraunces] text-lg italic text-zinc-900 dark:text-white">Gatelet</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 dot-pulse" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Live Proxy</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 space-y-8 overflow-y-auto px-4 py-4">
        <div>
          <p className="mb-4 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400/80">
            Main Menu
          </p>
          <div className="space-y-1">
            {tabs.map(tab => {
              const { icon: Icon } = tabMeta[tab];
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => { onTabChange(tab); onNavigate?.(); }}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-200',
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/5 ring-1 ring-indigo-500/20 dark:ring-indigo-500/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className={cn(
                    'relative z-10 h-4.5 w-4.5 transition-colors duration-200',
                    active
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300',
                  )} />
                  <span className="relative z-10">{tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-4 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400/80">
            System Stats
          </p>
          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Link2 className="h-3.5 w-3.5" />
                <span>Connections</span>
              </div>
              <span className="tabular-nums text-xs font-semibold text-zinc-900 dark:text-zinc-300">{summary.connections}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Zap className="h-3.5 w-3.5" />
                <span>Active tools</span>
              </div>
              <span className="tabular-nums text-xs font-semibold text-zinc-900 dark:text-zinc-300">{summary.tools}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Activity className="h-3.5 w-3.5" />
                <span>Uptime</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatUptime(summary.uptime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-100 dark:border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
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
    <div className="relative isolate flex min-h-screen w-full max-lg:flex-col bg-white dark:bg-zinc-950">
      {/* Sidebar - unified design */}
      <div className="fixed inset-y-0 left-0 w-64 border-r border-zinc-100 bg-zinc-50/50 dark:border-white/5 dark:bg-zinc-900/50 backdrop-blur-xl max-lg:hidden">
        <SidebarNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          summary={summary}
          onLogout={onLogout}
        />
      </div>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-100 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-white/5 dark:bg-zinc-950/80 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/20">
              <Logo className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-[Fraunces] text-base italic text-zinc-900 dark:text-white">Gatelet</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm dark:bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-zinc-900"
            >
              <div className="absolute right-4 top-4 z-10">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav
                activeTab={activeTab}
                onTabChange={onTabChange}
                summary={summary}
                onLogout={onLogout}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <main className="flex flex-1 flex-col lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              >
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                  {heading.title}
                </h1>
                <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
                  {heading.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
