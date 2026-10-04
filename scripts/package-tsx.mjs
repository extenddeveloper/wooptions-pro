import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npm', ['run', 'check'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
console.log('Run your preferred ZIP tool on the wooptions-pro folder after checks pass.');
