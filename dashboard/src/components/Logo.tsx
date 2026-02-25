import { cn } from '../utils';

export function Logo({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={cn("h-6 w-6", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* Entablature / top beam */}
      <line x1="1" y1="5" x2="23" y2="5" />
      <line x1="1" y1="7" x2="23" y2="7" />
      {/* Four pillars */}
      <line x1="2" y1="7" x2="2" y2="22" />
      <line x1="8.5" y1="7" x2="8.5" y2="22" />
      <line x1="15.5" y1="7" x2="15.5" y2="22" />
      <line x1="22" y1="7" x2="22" y2="22" />
      {/* Center arch (tall) */}
      <path d="M8.5 22V14a3.5 3.5 0 0 1 7 0v8" />
      {/* Left arch (shorter) */}
      <path d="M2 22v-4.5a3.25 3.25 0 0 1 6.5 0V22" />
      {/* Right arch (shorter) */}
      <path d="M15.5 22v-4.5a3.25 3.25 0 0 1 6.5 0V22" />
      {/* Ground line */}
      <line x1="1" y1="22" x2="23" y2="22" />
    </svg>
  );
}
