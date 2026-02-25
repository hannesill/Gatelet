import { ConnectionCard } from '../components/ConnectionCard';
import { OAuthButton } from '../components/OAuthButton';
import { SystemHealth } from '../components/SystemHealth';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from '../components/ProviderLogos';
import type { Status } from '../types';

function EmptyState({ oauthProviders }: { oauthProviders: Status['oauthProviders'] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-zinc-200 bg-white py-20 px-6 text-center dark:border-zinc-800 dark:bg-white/[0.02] overflow-hidden"
    >
      <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 to-transparent pointer-events-none" />
      
      <div className="relative flex h-24 w-48 items-center justify-center mb-4">
        <div className="absolute left-0 top-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10 -rotate-12 translate-x-4">
          <GmailLogo className="h-8 w-8" />
        </div>
        <div className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
          <Plus className="h-10 w-10 text-zinc-300" />
        </div>
        <div className="absolute right-0 top-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10 rotate-12 -translate-x-4">
          <GoogleCalendarLogo className="h-8 w-8" />
        </div>
        <div className="absolute right-4 bottom-0 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10 rotate-6 translate-y-2">
          <OutlookCalendarLogo className="h-7 w-7" />
        </div>
      </div>
      
      <h3 className="relative z-10 mt-8 text-xl font-bold text-zinc-900 dark:text-white">Connect your first service</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Gatelet works best when connected to your existing accounts. 
        Select a provider below to get started.
      </p>
      
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        {oauthProviders.map(p => (
          <OAuthButton key={p.id} provider={p} />
        ))}
      </div>
    </motion.div>
  );
}

interface Props {
  status: Status;
  onRefresh: () => void;
}

export function Connections({ status, onRefresh }: Props) {
  return (
    <div className="space-y-10">
      <SystemHealth />

      {status.connections.length === 0 ? (
        <EmptyState oauthProviders={status.oauthProviders} />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {status.connections.map((conn, i) => (
                <motion.div
                  key={conn.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: i * 0.05,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                >
                  <ConnectionCard
                    connection={conn}
                    onDisconnect={onRefresh}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {status.oauthProviders.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl glass p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                  Available Integrations
                </h3>
              </div>
              <div className="flex flex-wrap gap-4">
                {status.oauthProviders.map(p => (
                  <OAuthButton key={p.id} provider={p} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
