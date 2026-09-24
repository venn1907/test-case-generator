import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { app } from '../server/index.js';
import { normalizeInputText } from '../server/text.js';

const port = 31991;
const base = `http://127.0.0.1:${port}`;
let server;

test.before(async () => {
  await new Promise(resolve => { server = app.listen(port, '127.0.0.1', resolve); });
});

test.after(() => server?.close());

test('serves the builder UI', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /CP Test Forge/);
});

test('code editor disables programming ligatures', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.code-editor[\s\S]*font-variant-ligatures:none/);
  assert.match(css, /font-feature-settings:[^;]*"liga" 0[^;]*"calt" 0/);
});

test('rejects an empty solution', async () => {
  const response = await fetch(`${base}/api/run`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceCode: '', language: 'cpp17', inputs: ['1\n'] })
  });
  assert.equal(response.status, 400);
});

test('normalizes generated input without outer or line whitespace', () => {
  assert.equal(normalizeInputText('\r\n  23 8  \r\n  96 95 80   \r\n\t'), '23 8\n96 95 80');
  assert.equal(normalizeInputText('1 2\n3 4\n'), '1 2\n3 4');
});

test('exports matching .in and .out files as ZIP', async () => {
  const response = await fetch(`${base}/api/export`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputs: ['1 2\n', '3 4\n'], outputs: ['3\n', '7\n'], archiveName: 'sample' })
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = Buffer.from(bytes).toString('latin1');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.deepEqual([...bytes.slice(0, 2)], [0x50, 0x4b]);
  for (const name of ['001.in', '001.out', '002.in', '002.out']) assert.match(text, new RegExp(name.replace('.', '\\.')));
});
