import { cn } from '../utils';

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-6 w-6", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l-8 3v7c0 6 8 10 8 10s8-4 8-10" />
      <path d="M12 2l8 3" />
      <path d="M20 12h-8" />
    </svg>
  );
}
