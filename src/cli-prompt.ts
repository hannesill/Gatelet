/**
 * Prompt for a passphrase with echo disabled.
 * Manages raw stdin directly — no readline (which interferes with raw mode).
 */
export function promptPassphrase(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    const useRaw = !!process.stdin.isTTY;
    if (useRaw) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();

    let input = '';
    const onData = (chunk: Buffer) => {
      const str = chunk.toString();

      for (const char of str) {
        if (char === '\n' || char === '\r') {
          if (useRaw) {
            process.stdin.setRawMode(false);
          }
          process.stdout.write('\n');
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          resolve(input);
          return;
        } else if (char === '\x7f' || char === '\b') {
          input = input.slice(0, -1);
        } else if (char === '\x03') {
          if (useRaw) {
            process.stdin.setRawMode(false);
          }
          process.stdout.write('\n');
          process.exit(1);
        } else if (char >= ' ') {
          input += char;
        }
      }
    };

    process.stdin.on('data', onData);
  });
}
