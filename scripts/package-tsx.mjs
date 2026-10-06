import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const pluginSlug = 'wooptions-pro';
const stagingDir = resolve(distDir, pluginSlug);
const zipPath = resolve(distDir, `${pluginSlug}.zip`);

console.log('Building and validating WooOptions Pro assets...');

// 1. Build TSX and copy CSS/JS assets
execFileSync(process.execPath, [resolve(root, 'scripts/build-tsx.mjs')], { cwd: root, stdio: 'inherit' });

// 2. Validate JavaScript
execFileSync(process.execPath, ['--check', resolve(root, 'build/admin.js')], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['--check', resolve(root, 'build/storefront.js')], { cwd: root, stdio: 'inherit' });

// 3. Validate PHP syntax
execFileSync(process.execPath, [resolve(root, 'scripts/check-php.mjs')], { cwd: root, stdio: 'inherit' });

console.log('Preparing clean production package...');

// Clean previous dist directory
rmSync(stagingDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(stagingDir, { recursive: true });

// Production items to include in installable zip
const productionItems = [
  'wooptions-pro.php',
  'uninstall.php',
  'readme.txt',
  'README.md',
  'LICENSE',
  'assets',
  'blocks',
  'build',
  'config',
  'languages',
  'src',
  'templates'
];

for (const item of productionItems) {
  const sourcePath = resolve(root, item);
  if (existsSync(sourcePath)) {
    const targetPath = resolve(stagingDir, item);
    cpSync(sourcePath, targetPath, { recursive: true });
  }
}

console.log('Creating installable ZIP archive...');

// Create ZIP using tar (built into Windows, macOS, Linux) or fallback to PowerShell / zip
const createZip = () => {
  try {
    execFileSync('tar', ['-a', '-c', '-f', zipPath, pluginSlug], { cwd: distDir, stdio: 'pipe' });
    return true;
  } catch {
    if (process.platform === 'win32') {
      execFileSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Compress-Archive -Path "${stagingDir}" -DestinationPath "${zipPath}" -Force`
      ], { stdio: 'pipe' });
      return true;
    } else {
      execFileSync('zip', ['-rq', zipPath, pluginSlug], { cwd: distDir, stdio: 'pipe' });
      return true;
    }
  }
};

createZip();

// Clean staging directory to leave only the clean zip
rmSync(stagingDir, { recursive: true, force: true });

if (existsSync(zipPath)) {
  const stats = statSync(zipPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(0);
  console.log('====================================================');
  console.log(' WooOptions Pro Production ZIP Ready to Install:');
  console.log(` File: dist/${pluginSlug}.zip (${sizeMb} MB / ${sizeKb} KB)`);
  console.log(' Standard format: unzips to wooptions-pro/');
  console.log(' Ready for WordPress Plugins > Add New > Upload Plugin');
  console.log('====================================================');
} else {
  console.error('Failed to create ZIP package.');
  process.exit(1);
}
