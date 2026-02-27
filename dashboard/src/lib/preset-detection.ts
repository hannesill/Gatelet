import { parse } from 'yaml';

/**
 * Detect which preset (if any) matches the current policy YAML.
 * Strips the `account` field before comparison since presets use `{account}`
 * while real policies have the actual email address.
 */
export function detectPreset(
  currentYaml: string,
  presetYamls: Record<string, string>,
): string | null {
  let currentParsed: Record<string, unknown>;
  try {
    currentParsed = parse(currentYaml) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!currentParsed || typeof currentParsed !== 'object') return null;

  const currentCanonical = canonicalize(currentParsed);

  for (const [name, presetYaml] of Object.entries(presetYamls)) {
    try {
      const presetParsed = parse(presetYaml) as Record<string, unknown>;
      if (!presetParsed || typeof presetParsed !== 'object') continue;
      const presetCanonical = canonicalize(presetParsed);
      if (currentCanonical === presetCanonical) return name;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Deep-sort all object keys so JSON.stringify produces a stable string
 * regardless of insertion order (which varies between hand-written YAML
 * and the output of stringifyPolicyYaml).
 */
function deepSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalize(obj: Record<string, unknown>): string {
  const copy = { ...obj };
  delete copy.account;
  return JSON.stringify(deepSortKeys(copy));
}
