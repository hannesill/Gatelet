import { motion } from 'framer-motion';
import { Logo } from './Logo';

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
      {/* Duplicate for seamless loop */}
      {Array.from({ length: logos }).map((_, i) => (
        <Logo key={`dup-${i}`} className="h-32 w-32 shrink-0" strokeWidth={1.3} />
      ))}
    </motion.div>
  );
}
