import { VERSION } from './version.js';
import { config } from './config.js';

export interface UpdateInfo {
  available: boolean;
  latestVersion: string | null;
  currentVersion: string;
  releaseUrl: string | null;
  lastCheckedAt: number | null;
  error: string | null;
}

let cached: UpdateInfo = {
  available: false,
  latestVersion: null,
  currentVersion: VERSION,
  releaseUrl: null,
  lastCheckedAt: null,
  error: null,
};
let interval: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(
      'https://api.github.com/repos/hannesill/gatelet/releases/latest',
      {
        headers: {
          'User-Agent': `gatelet/${VERSION}`,
          Accept: 'application/vnd.github.v3+json',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      cached = { ...cached, error: `GitHub API returned ${res.status}` };
      return cached;
    }

    const data = (await res.json()) as { tag_name: string; html_url: string };
    const latestVersion = data.tag_name.replace(/^v/, '');
    const available = compareSemver(latestVersion, VERSION) > 0;

    cached = {
      available,
      latestVersion,
      currentVersion: VERSION,
      releaseUrl: data.html_url,
      lastCheckedAt: Date.now(),
      error: null,
    };
  } catch (err) {
    cached = {
      ...cached,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  return cached;
}

export function getUpdateInfo(): UpdateInfo {
  return cached;
}

export function startUpdateChecker(): void {
  if (config.IS_DOCKER) return;

  // Fire-and-forget initial check
  checkForUpdate().then(info => {
    if (info.available) {
      console.log('');
      console.log(`  Update available: v${info.latestVersion} (current: v${info.currentVersion})`);
      console.log(`  ${info.releaseUrl}`);
      console.log('');
    }
  }).catch(() => {
    // Silently ignore — startup must not be affected
  });

  interval = setInterval(checkForUpdate, CHECK_INTERVAL);
  interval.unref();
}

export function stopUpdateChecker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function resetUpdateChecker(): void {
  stopUpdateChecker();
  cached = {
    available: false,
    latestVersion: null,
    currentVersion: VERSION,
    releaseUrl: null,
    lastCheckedAt: null,
    error: null,
  };
}
