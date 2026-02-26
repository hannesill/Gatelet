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

function canonicalize(obj: Record<string, unknown>): string {
  const copy = { ...obj };
  delete copy.account;

  // Sort operation keys for stable comparison
  if (copy.operations && typeof copy.operations === 'object') {
    const ops = copy.operations as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(ops).sort()) {
      sorted[key] = ops[key];
    }
    copy.operations = sorted;
  }

  return JSON.stringify(copy);
}
