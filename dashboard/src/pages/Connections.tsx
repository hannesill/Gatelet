import { useState } from 'react';
import { ConnectionCard } from '../components/ConnectionCard';
import { OAuthButton } from '../components/OAuthButton';
import { OAuthInfo } from '../components/OAuthSettings';
import { SystemHealth } from '../components/SystemHealth';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Info, X } from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from '../components/ProviderLogos';
import type { Status } from '../types';

function EmptyState({ oauthProviders }: { oauthProviders: Status['oauthProviders'] }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-zinc-200 bg-white py-20 px-6 text-center dark:border-zinc-800 dark:bg-white/[0.02] overflow-hidden"
    >
      <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 to-transparent pointer-events-none" />
      
      <button 
        onClick={() => setShowInfo(!showInfo)}
        className="absolute right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
        title="About OAuth Credentials"
      >
        {showInfo ? <X className="h-5 w-5" /> : <Info className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 p-6 backdrop-blur-sm dark:bg-zinc-900/95"
          >
            <div className="max-w-md text-left">
              <OAuthInfo />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
  const [showInfo, setShowInfo] = useState(false);

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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                    Available Integrations
                  </h3>
                </div>
                <button 
                  onClick={() => setShowInfo(!showInfo)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                  title="About OAuth Credentials"
                >
                  {showInfo ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </button>
              </div>

              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-8">
                      <OAuthInfo />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
