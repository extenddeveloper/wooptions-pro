import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = process.platform === 'win32' ? resolve(root, 'node_modules/.bin/tsc.cmd') : resolve(root, 'node_modules/.bin/tsc');
const compiler = (() => {
  try { return tsc; } catch { return 'tsc'; }
})();
mkdirSync(resolve(root, 'build'), { recursive: true });
const targetTsconfig = resolve(root, 'tsconfig.admin.json');
try {
  execFileSync(`"${compiler}"`, ['-p', `"${targetTsconfig}"`], { stdio: 'inherit', shell: true });
} catch (error) {
  if (compiler !== 'tsc') execFileSync('npx', ['tsc', '-p', `"${targetTsconfig}"`], { stdio: 'inherit', shell: true });
  else throw error;
}
const copies = [
  ['resources/storefront/index.js', 'build/storefront.js'],
  ['resources/styles/admin.css', 'build/admin.css'],
  ['resources/styles/storefront.css', 'build/storefront.css']
];
for (const [source, target] of copies) {
  const sourcePath = resolve(root, source);
  const targetPath = resolve(root, target);
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}
const digest = (paths) => {
  const hash = createHash('sha256');
  for (const path of paths) hash.update(readFileSync(resolve(root, path)));
  return hash.digest('hex').slice(0, 20);
};
const adminVersion = digest(['build/admin.js', 'build/admin.css']);
const storefrontVersion = digest(['build/storefront.js', 'build/storefront.css']);
writeFileSync(resolve(root, 'build/admin.asset.php'), `<?php return array('dependencies' => array('react', 'react-dom', 'wp-api-fetch', 'wp-components', 'wp-data', 'wp-element', 'wp-i18n', 'editor', 'quicktags', 'wp-tinymce'), 'version' => '${adminVersion}');\n`);
writeFileSync(resolve(root, 'build/storefront.asset.php'), `<?php return array('dependencies' => array(), 'version' => '${storefrontVersion}');\n`);
console.log(`Built WooOptionsPro TSX assets (${adminVersion}).`);
