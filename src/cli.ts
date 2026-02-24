#!/usr/bin/env node
export {};

const args = process.argv.slice(2);
const command = args[0];

if (command === 'doctor') {
  const fix = args.includes('--fix');
  const json = args.includes('--json');

  const { runDoctor } = await import('./doctor/index.js');
  const { printResults, printJson } = await import('./doctor/printer.js');

  const results = await runDoctor({ fix });

  if (json) {
    printJson(results);
  } else {
    printResults(results);
  }

  const hasFail = results.some(r => r.status === 'fail');
  process.exit(hasFail ? 1 : 0);
} else {
  // Default: start the server
  await import('./index.js');
}
