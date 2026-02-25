import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Terminal } from 'lucide-react';
import { cn } from '../utils';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative mt-6 flex w-full max-w-lg items-center overflow-hidden rounded-2xl bg-zinc-950 p-1.5 shadow-2xl ring-1 ring-zinc-900/50 dark:bg-black/40 dark:ring-white/10">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center text-zinc-500">
        <Terminal className="h-5 w-5" />
      </div>
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm font-medium text-zinc-300 scrollbar-hide select-all">
        {command}
      </code>
      <button
        onClick={handleCopy}
        className={cn(
          "flex h-12 w-28 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer",
          copied 
            ? "bg-emerald-500 text-white" 
            : "bg-white/10 text-white hover:bg-white/20 active:scale-95"
        )}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Copy className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}
