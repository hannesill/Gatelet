import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compareSemver,
  checkForUpdate,
  startUpdateChecker,
  resetUpdateChecker,
  getUpdateInfo,
} from '../src/update-checker.js';

vi.mock('../src/version.js', () => ({ VERSION: '0.2.0' }));
vi.mock('../src/config.js', () => ({
  config: { IS_DOCKER: false },
}));

const mockFetch = vi.fn();

describe('compareSemver', () => {
  it('returns 1 when a is newer', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
  });

  it('returns 0 when equal', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns -1 when a is older', () => {
    expect(compareSemver('0.1.0', '0.2.0')).toBe(-1);
  });

  it('handles v prefix', () => {
    expect(compareSemver('v1.2.0', 'v1.1.0')).toBe(1);
    expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
  });

  it('handles major version bumps', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.9.9', '2.0.0')).toBe(-1);
  });
});

describe('checkForUpdate', () => {
  beforeEach(() => {
    resetUpdateChecker();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('detects a newer version', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tag_name: 'v0.3.0', html_url: 'https://github.com/hannesill/gatelet/releases/tag/v0.3.0' }),
    });

    const info = await checkForUpdate();
    expect(info.available).toBe(true);
    expect(info.latestVersion).toBe('0.3.0');
    expect(info.releaseUrl).toBe('https://github.com/hannesill/gatelet/releases/tag/v0.3.0');
    expect(info.error).toBeNull();
    expect(info.lastCheckedAt).toBeTypeOf('number');
  });

  it('reports no update when versions match', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tag_name: 'v0.2.0', html_url: 'https://github.com/hannesill/gatelet/releases/tag/v0.2.0' }),
    });

    const info = await checkForUpdate();
    expect(info.available).toBe(false);
    expect(info.latestVersion).toBe('0.2.0');
    expect(info.error).toBeNull();
  });

  it('records error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const info = await checkForUpdate();
    expect(info.error).toBe('Network error');
  });

  it('records error on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const info = await checkForUpdate();
    expect(info.error).toBe('GitHub API returned 403');
    expect(info.available).toBe(false);
  });

  it('preserves previous success data on subsequent failure', async () => {
    // First call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tag_name: 'v0.3.0', html_url: 'https://github.com/hannesill/gatelet/releases/tag/v0.3.0' }),
    });
    await checkForUpdate();

    // Second call: failure
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const info = await checkForUpdate();

    // Error is set but previous data is preserved
    expect(info.error).toBe('Timeout');
    expect(info.available).toBe(true);
    expect(info.latestVersion).toBe('0.3.0');
    expect(info.releaseUrl).toBe('https://github.com/hannesill/gatelet/releases/tag/v0.3.0');
  });
});

describe('startUpdateChecker', () => {
  beforeEach(() => {
    resetUpdateChecker();
    global.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetUpdateChecker();
    mockFetch.mockReset();
    vi.useRealTimers();
  });

  it('skips when IS_DOCKER is true', async () => {
    const { config } = await import('../src/config.js');
    (config as { IS_DOCKER: boolean }).IS_DOCKER = true;

    startUpdateChecker();

    expect(mockFetch).not.toHaveBeenCalled();

    // Restore
    (config as { IS_DOCKER: boolean }).IS_DOCKER = false;
  });

  it('fires initial check and sets interval', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v0.2.0', html_url: 'https://github.com/hannesill/gatelet/releases/tag/v0.2.0' }),
    });

    startUpdateChecker();

    // Flush the fire-and-forget promise
    await vi.advanceTimersByTimeAsync(0);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance 1 hour — should trigger another check
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('getUpdateInfo', () => {
  it('returns default state before any check', () => {
    resetUpdateChecker();
    const info = getUpdateInfo();
    expect(info.available).toBe(false);
    expect(info.currentVersion).toBe('0.2.0');
    expect(info.lastCheckedAt).toBeNull();
  });
});
