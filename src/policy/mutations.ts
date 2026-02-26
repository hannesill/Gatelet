import type { Mutation } from './types.js';
import { setByPath, deleteByPath } from './field-path.js';

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
