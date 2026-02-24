import YAML from 'yaml';
import type { PolicyConfig } from './types.js';

export function parsePolicy(yamlString: string): PolicyConfig {
  const parsed = YAML.parse(yamlString);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid policy: must be a YAML object');
  }

  if (typeof parsed.provider !== 'string') {
    throw new Error('Invalid policy: missing "provider" field');
  }

  if (typeof parsed.account !== 'string') {
    throw new Error('Invalid policy: missing "account" field');
  }

  if (!parsed.operations || typeof parsed.operations !== 'object') {
    throw new Error('Invalid policy: missing "operations" object');
  }

  return parsed as PolicyConfig;
}
