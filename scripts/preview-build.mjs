#!/usr/bin/env node
// Copies the files the Pages workflow deploys into dist/, for the fleet's
// site-preview combiner. Uses the committed exchange-rate.json rather than
// fetching a fresh rate. Keep the pathspec in step with pages.yml.
// Usage: npm run preview:build
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--', ':!:.*', ':!:scripts', ':!:*.md', ':!:package.json'],
  { cwd: root, encoding: 'utf8' },
).split('\0').filter(Boolean);

rmSync(dist, { recursive: true, force: true });
for (const f of files) {
  mkdirSync(dirname(join(dist, f)), { recursive: true });
  cpSync(join(root, f), join(dist, f));
}
console.log(`dist/: ${files.length} files`);
