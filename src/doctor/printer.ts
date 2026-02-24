import type { DoctorResult, CheckStatus } from './index.js';

const ICONS: Record<CheckStatus, string> = {
  pass: '\x1b[32m✓\x1b[0m',   // green
  warn: '\x1b[33m!\x1b[0m',   // yellow
  fail: '\x1b[31m✗\x1b[0m',   // red
  skip: '\x1b[90m-\x1b[0m',   // gray
};

const STATUS_COLORS: Record<CheckStatus, string> = {
  pass: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  fail: '\x1b[31m',   // red
  skip: '\x1b[90m',   // gray
};

const RESET = '\x1b[0m';

export function printResults(results: DoctorResult[]): void {
  console.log('');
  console.log('Gatelet Doctor');
  console.log('');

  for (const r of results) {
    const icon = ICONS[r.status];
    const color = STATUS_COLORS[r.status];
    const fixedTag = r.fixed ? ' \x1b[36m(fixed)\x1b[0m' : '';
    console.log(`  ${icon} ${color}${r.check.name}${RESET}: ${r.message}${fixedTag}`);
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const fixed = results.filter(r => r.fixed).length;

  console.log('');
  const parts: string[] = [
    `\x1b[32m${passed} passed\x1b[0m`,
  ];
  if (warned > 0) parts.push(`\x1b[33m${warned} warning(s)\x1b[0m`);
  if (failed > 0) parts.push(`\x1b[31m${failed} failed\x1b[0m`);
  if (skipped > 0) parts.push(`\x1b[90m${skipped} skipped\x1b[0m`);
  if (fixed > 0) parts.push(`\x1b[36m${fixed} fixed\x1b[0m`);

  console.log(`  ${parts.join(', ')}`);
  console.log('');
}

export function printJson(results: DoctorResult[]): void {
  const output = results.map(r => ({
    id: r.check.id,
    name: r.check.name,
    status: r.status,
    message: r.message,
    fixable: r.check.fixable,
    fixed: r.fixed ?? false,
  }));
  console.log(JSON.stringify(output, null, 2));
}
