import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const outDir = join(root, 'build', 'wgt-src', 'service');
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(root, 'service', 'src', 'main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: join(outDir, 'service.js'),
  external: [],
});

writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify(
    {
      name: 'bitchord-tv-service',
      version: '1.9.0',
      main: 'service.js',
    },
    null,
    2
  ),
  'utf8'
);

console.log('[build-service] Background service bundled to build/wgt-src/service/service.js');

