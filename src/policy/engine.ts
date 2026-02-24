import type { PolicyConfig, PolicyResult } from './types.js';
import { evaluateConstraint } from './constraints.js';
import { applyMutations } from './mutations.js';

export function evaluate(
  policy: PolicyConfig,
  operation: string,
  params: Record<string, unknown>,
): PolicyResult {
  const opPolicy = policy.operations[operation];

  if (!opPolicy) {
    return {
      action: 'deny',
      reason: `Operation '${operation}' is not configured in policy`,
    };
  }

  if (!opPolicy.allow) {
    return {
      action: 'deny',
      reason: `Operation '${operation}' is explicitly denied`,
    };
  }

  if (opPolicy.constraints) {
    for (const constraint of opPolicy.constraints) {
      const result = evaluateConstraint(constraint, params);
      if (!result.ok) {
        return { action: 'deny', reason: result.reason! };
      }
    }
  }

  const clonedParams = structuredClone(params);

  if (opPolicy.mutations) {
    applyMutations(opPolicy.mutations, clonedParams);
  }

  return { action: 'allow', mutatedParams: clonedParams, guards: opPolicy.guards };
}
