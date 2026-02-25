import { useState } from 'react';
import { Badge } from './catalyst/badge';
import { PolicyViewer } from './PolicyViewer';
import { PolicyEditor } from './PolicyEditor';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Mail, 
  Link2, 
  ChevronDown, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  Settings2
} from 'lucide-react';
import type { ConnectionWithMeta } from '../types';

const PROVIDER_ICONS: Record<string, any> = {
  google_calendar: Calendar,
  outlook_calendar: Calendar,
  google_gmail: Mail,
};

const PROVIDER_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  google_calendar: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-600 dark:text-blue-400' },
  outlook_calendar: { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300', icon: 'text-sky-600 dark:text-sky-400' },
  google_gmail: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300', icon: 'text-red-600 dark:text-red-400' },
};

function TokenStatus({ status }: { status: 'valid' | 'expired' | 'unknown' }) {
  if (status === 'valid') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <AlertCircle className="h-3 w-3" />
        Expired
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400">
      <HelpCircle className="h-3 w-3" />
      Unknown
    </div>
  );
}

interface Props {
  connection: ConnectionWithMeta;
  onDisconnect: () => void;
}

export function ConnectionCard({ connection, onDisconnect }: Props) {
  const [mode, setMode] = useState<'closed' | 'viewer' | 'editor'>('closed');
  const { toast } = useToast();

  const Icon = PROVIDER_ICONS[connection.provider_id] ?? Link2;
  const theme = PROVIDER_COLORS[connection.provider_id] ?? { 
    bg: 'bg-zinc-50 dark:bg-zinc-500/10', 
    text: 'text-zinc-700 dark:text-zinc-300', 
    icon: 'text-zinc-600 dark:text-zinc-400' 
  };

  async function handleDisconnect() {
    if (!confirm('Remove this connection?')) return;
    try {
      await api.deleteConnection(connection.id);
      toast('Connection removed');
      onDisconnect();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  return (
    <motion.div 
      layout
      className="group glass overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-zinc-950/[0.03] hover:ring-zinc-400/40 dark:hover:ring-white/20"
    >
      <div className="p-6">
        <div className="flex items-start gap-5">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105', theme.bg)}>
            <Icon className={cn('h-7 w-7', theme.icon)} />
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
                  {connection.displayName}
                </h3>
                <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {connection.account_name}
                </p>
              </div>
              <TokenStatus status={connection.tokenStatus} />
            </div>

            <div className="mt-4 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex h-5 items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
                  {connection.enabledTools}
                </div>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  / {connection.totalTools} tools active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-white/5">
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode(mode === 'closed' ? 'viewer' : 'closed')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                mode !== 'closed'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
              )}
            >
              <Settings2 className={cn('h-4 w-4 transition-transform duration-300', mode !== 'closed' && 'rotate-90')} />
              Manage Policy
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', mode !== 'closed' && 'rotate-180')} />
            </button>
            
            {mode === 'viewer' && (
              <button
                onClick={() => setMode('editor')}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition-all duration-200 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              >
                <Edit3 className="h-4 w-4" />
                Edit YAML
              </button>
            )}
          </div>

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </div>

      {/* Expandable Policy Section */}
      <AnimatePresence>
        {mode !== 'closed' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="border-t border-zinc-100 bg-zinc-50/50 dark:border-white/5 dark:bg-white/[0.02]"
          >
            <div className="p-6">
              {mode === 'viewer' && (
                <PolicyViewer
                  connectionId={connection.id}
                  providerId={connection.provider_id}
                  onEdit={() => setMode('editor')}
                />
              )}
              {mode === 'editor' && (
                <PolicyEditor
                  connectionId={connection.id}
                  providerId={connection.provider_id}
                  onClose={() => setMode('viewer')}
                  onSaved={onDisconnect}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
