// Keep Kane's stream and exit code while giving kanehack a known pack path.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const [destination, command, ...args] = process.argv.slice(2);
if (!destination || !command) {
  console.error('Usage: capture-kane-evidence.mjs <destination> <command> [args...]');
  process.exit(2);
}

const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'inherit'] });
let executionId;
child.stdout.on('data', (chunk) => process.stdout.write(chunk));
const lines = createInterface({ input: child.stdout });
lines.on('line', (line) => {
  try {
    const event = JSON.parse(line);
    if (event.type === 'testrun_start' || event.type === 'testrun_done') {
      executionId = event.execution_id ?? executionId;
    }
  } catch {
    // Non-JSON diagnostics are forwarded unchanged, not treated as evidence.
  }
});

child.on('error', () => {
  console.error('Could not start Kane; no evidence was copied.');
  process.exitCode = 127;
});
child.on('close', (code, signal) => {
  process.exitCode = process.exitCode ?? code ?? (signal ? 3 : 2);
  if (typeof executionId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(executionId)) {
    console.error('Kane did not identify a suite execution; no evidence was copied.');
    if (process.exitCode === 0) process.exitCode = 2;
    return;
  }
  const source = join('.testmuai', 'evidence', `${executionId}.evidence`);
  try {
    if (!existsSync(source)) throw new Error('missing');
    copyFileSync(source, destination);
    console.error(`Suite evidence ready for reporting: ${destination}`);
  } catch {
    console.error('The current suite evidence pack could not be copied; no old pack was substituted.');
    if (process.exitCode === 0) process.exitCode = 2;
  }
});
