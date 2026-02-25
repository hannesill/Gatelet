import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils';

export function GitHubStars({ className }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/hannesill/gatelet')
      .then(res => res.json())
      .then(data => {
        if (typeof data.stargazers_count === 'number') {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {});
  }, []);

  if (stars === null) return null;

  return (
    <motion.a
      href="https://github.com/hannesill/gatelet"
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold text-zinc-600 ring-1 ring-zinc-200 transition-all hover:bg-zinc-100 hover:scale-105 active:scale-95 dark:bg-white/5 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/10",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
        <span>Star</span>
      </div>
      <div className="h-3.5 w-px bg-zinc-300 dark:bg-zinc-700" />
      <span>{stars.toLocaleString()}</span>
    </motion.a>
  );
}
