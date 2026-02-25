import { motion } from 'framer-motion';

function Logo({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="5" x2="23" y2="5" />
      <line x1="1" y1="7" x2="23" y2="7" />
      <line x1="2" y1="7" x2="2" y2="22" />
      <line x1="8.5" y1="7" x2="8.5" y2="22" />
      <line x1="15.5" y1="7" x2="15.5" y2="22" />
      <line x1="22" y1="7" x2="22" y2="22" />
      <path d="M8.5 22V14a3.5 3.5 0 0 1 7 0v8" />
      <path d="M2 22v-4.5a3.25 3.25 0 0 1 6.5 0V22" />
      <path d="M15.5 22v-4.5a3.25 3.25 0 0 1 6.5 0V22" />
      <line x1="1" y1="22" x2="23" y2="22" />
    </svg>
  );
}

export function DynamicBackground() {
  const rows = 18;
  const logosPerRow = 25;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none opacity-[0.02] dark:opacity-[0.03]">
      <div className="flex flex-col gap-2 -mt-24 pb-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Row
            key={i}
            reverse={i % 2 === 0}
            speed={60 + (i % 3) * 30}
            logos={logosPerRow}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ reverse, speed, logos }: { reverse: boolean; speed: number; logos: number }) {
  return (
    <motion.div
      className="flex gap-4 whitespace-nowrap"
      initial={{ x: reverse ? '-50%' : '0%' }}
      animate={{ x: reverse ? '0%' : '-50%' }}
      transition={{
        duration: speed,
        ease: "linear",
        repeat: Infinity,
      }}
    >
      {Array.from({ length: logos }).map((_, i) => (
        <Logo key={i} className="h-32 w-32 shrink-0" strokeWidth={1.3} />
      ))}
      {Array.from({ length: logos }).map((_, i) => (
        <Logo key={`dup-${i}`} className="h-32 w-32 shrink-0" strokeWidth={1.3} />
      ))}
    </motion.div>
  );
}
