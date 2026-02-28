import { useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';

interface UpdateInfo {
  available: boolean;
  latestVersion: string | null;
  currentVersion: string;
  releaseUrl: string | null;
}

export function UpdateBanner({ update }: { update?: UpdateInfo }) {
  const [dismissed, setDismissed] = useState(false);

  if (!update?.available || dismissed) return null;

  return (
    <div className="animate-in glass overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-500/20">
      <div className="flex items-start gap-4 p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
          <ArrowUpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
            v{update.latestVersion} is available
            <span className="font-normal text-indigo-700 dark:text-indigo-400/80">
              {' '}(you're running v{update.currentVersion})
            </span>
          </h3>
          {update.releaseUrl && (
            <a
              href={update.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View release notes &rarr;
            </a>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
