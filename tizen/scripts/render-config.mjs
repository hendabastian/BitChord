import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tmpl = readFileSync(join(root, 'config.xml.tmpl'), 'utf8');

const packageId = process.env.TIZEN_PACKAGE_ID || 'BChordTV01';
const version = pkg.version || '1.9.0';

const rendered = tmpl
  .replace(/\$\{VERSION\}/g, version)
  .replace(/\$\{PACKAGE_ID\}/g, packageId);

const outDir = join(root, 'build', 'wgt-src');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'config.xml'), rendered, 'utf8');

console.log(`[render-config] Rendered config.xml (version: ${version}, packageId: ${packageId})`);

