import type { Mutation } from './types.js';
import { getByPath, setByPath, deleteByPath } from './field-path.js';

function applyMutation(
  mutation: Mutation,
  params: Record<string, unknown>,
): void {
  switch (mutation.action) {
    case 'set':
      setByPath(params, mutation.field, mutation.value);
      break;
    case 'delete':
      deleteByPath(params, mutation.field);
      break;
    case 'cap': {
      const current = getByPath(params, mutation.field);
      if (typeof current === 'number') {
        setByPath(params, mutation.field, Math.min(current, mutation.value as number));
      }
      break;
    }
  }
}

export function applyMutations(
  mutations: Mutation[],
  params: Record<string, unknown>,
): void {
  for (const mutation of mutations) {
    applyMutation(mutation, params);
  }
}
