import { Badge } from './catalyst/badge';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import type { ProviderReference } from '../types';

interface Props {
  connectionId: string;
  providerId: string;
  onEdit: () => void;
}

interface ParsedOperation {
  name: string;
  allow: boolean;
  constraints: Array<{ field: string; rule: string; value?: unknown }>;
  mutations: Array<{ field: string; action: string; value?: unknown }>;
}

function parsePolicyYaml(yamlText: string): { operations: ParsedOperation[] } {
  const ops: ParsedOperation[] = [];
  const lines = yamlText.split('\n');
  let inOperations = false;
  let currentOp: ParsedOperation | null = null;
  let inConstraints = false;
  let inMutations = false;

  for (const line of lines) {
    if (line.match(/^operations:\s*$/)) {
      inOperations = true;
      continue;
    }
    if (!inOperations) continue;

    const opMatch = line.match(/^  (\w+):\s*$/);
    if (opMatch) {
      if (currentOp) ops.push(currentOp);
      currentOp = { name: opMatch[1], allow: false, constraints: [], mutations: [] };
      inConstraints = false;
      inMutations = false;
      continue;
    }

    if (!currentOp) continue;

    const allowMatch = line.match(/^\s+allow:\s*(true|false)/);
    if (allowMatch) {
      currentOp.allow = allowMatch[1] === 'true';
      continue;
    }

    if (line.match(/^\s+constraints:\s*$/)) {
      inConstraints = true;
      inMutations = false;
      continue;
    }
    if (line.match(/^\s+mutations:\s*$/)) {
      inMutations = true;
      inConstraints = false;
      continue;
    }

    if (inConstraints) {
      const fieldMatch = line.match(/^\s+-\s*field:\s*(.+)/);
      if (fieldMatch) {
        currentOp.constraints.push({ field: fieldMatch[1].trim(), rule: '', value: undefined });
      }
      const ruleMatch = line.match(/^\s+rule:\s*(.+)/);
      if (ruleMatch && currentOp.constraints.length > 0) {
        currentOp.constraints[currentOp.constraints.length - 1].rule = ruleMatch[1].trim();
      }
      const valueMatch = line.match(/^\s+value:\s*(.+)/);
      if (valueMatch && currentOp.constraints.length > 0) {
        currentOp.constraints[currentOp.constraints.length - 1].value = valueMatch[1].trim().replace(/^"(.*)"$/, '$1');
      }
    }

    if (inMutations) {
      const fieldMatch = line.match(/^\s+-\s*field:\s*(.+)/);
      if (fieldMatch) {
        currentOp.mutations.push({ field: fieldMatch[1].trim(), action: '', value: undefined });
      }
      const actionMatch = line.match(/^\s+action:\s*(.+)/);
      if (actionMatch && currentOp.mutations.length > 0) {
        currentOp.mutations[currentOp.mutations.length - 1].action = actionMatch[1].trim();
      }
      const valueMatch = line.match(/^\s+value:\s*(.+)/);
      if (valueMatch && currentOp.mutations.length > 0) {
        currentOp.mutations[currentOp.mutations.length - 1].value = valueMatch[1].trim().replace(/^"(.*)"$/, '$1');
      }
    }
  }
  if (currentOp) ops.push(currentOp);
  return { operations: ops };
}

export function PolicyViewer({ connectionId, providerId, onEdit }: Props) {
  const { data: policyYaml } = useApi(() => api.getPolicy(connectionId), [connectionId]);
  const { data: ref } = useApi(() => api.getProviderReference(providerId), [providerId]);

  if (!policyYaml) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading policy...
      </div>
    );
  }

  const parsed = parsePolicyYaml(policyYaml);

  const listedOps = new Set(parsed.operations.map(o => o.name));
  const unlistedOps = ref?.operations.filter(o => !listedOps.has(o.policyOperation)).map(o => o.policyOperation) ?? [];

  return (
    <div>
      <div className="space-y-2">
        {parsed.operations.map(op => (
          <div
            key={op.name}
            className="rounded-lg bg-white px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-zinc-800/60 dark:ring-white/5"
          >
            <div className="flex items-center justify-between gap-3">
              <code className="text-sm text-zinc-800 dark:text-zinc-200">{op.name}</code>
              {op.allow
                ? <Badge color="green">allowed</Badge>
                : <Badge color="red">denied</Badge>}
            </div>

            {(op.constraints.length > 0 || op.mutations.length > 0) && (
              <div className="mt-2.5 space-y-1.5 border-t border-zinc-200 pt-2.5 dark:border-white/5">
                {op.constraints.map((c, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">constraint</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      <code className="text-zinc-700 dark:text-zinc-300">{c.field}</code> {c.rule}
                      {c.value !== undefined && <> = <code className="text-zinc-700 dark:text-zinc-300">{JSON.stringify(c.value)}</code></>}
                    </span>
                  </div>
                ))}
                {op.mutations.map((m, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">mutation</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      <code className="text-zinc-700 dark:text-zinc-300">{m.field}</code> &rarr; {m.action}
                      {m.value !== undefined && <> <code className="text-zinc-700 dark:text-zinc-300">{JSON.stringify(m.value)}</code></>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {unlistedOps.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-600">
          Not listed (denied by default): {unlistedOps.map((o, i) => (
            <span key={o}>{i > 0 && ', '}<code className="text-zinc-600 dark:text-zinc-500">{o}</code></span>
          ))}
        </p>
      )}
    </div>
  );
}
