import { ConnectionCard } from '../components/ConnectionCard';
import { OAuthButton } from '../components/OAuthButton';
import { SystemHealth } from '../components/SystemHealth';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Sparkles } from 'lucide-react';
import type { Status } from '../types';

function EmptyState({ oauthProviders }: { oauthProviders: Status['oauthProviders'] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-zinc-200 bg-white py-20 px-6 text-center dark:border-zinc-800 dark:bg-white/[0.02]"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl shadow-zinc-950/5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
        <Link2 className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
      </div>
      <h3 className="mt-8 text-xl font-bold text-zinc-900 dark:text-white">Connect your first service</h3>
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
