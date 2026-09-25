import express from 'express';
import archiver from 'archiver';
import { normalizeInputText } from './text.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const pistonUrl = (process.env.PISTON_URL || 'http://piston:2000').replace(/\/$/, '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));

const languages = Object.freeze({
  cpp17: { name: 'C++17 (GCC)', pistonLanguage: 'c++', version: '10.2.0', file: 'main.cpp' },
  c: { name: 'C (GCC)', pistonLanguage: 'c', version: '10.2.0', file: 'main.c' },
  java: { name: 'Java', pistonLanguage: 'java', version: '15.0.2', file: 'Main.java' },
  python3: { name: 'Python 3', pistonLanguage: 'python', version: '3.12.0', file: 'main.py' },
  javascript: { name: 'JavaScript (Node.js)', pistonLanguage: 'javascript', version: '20.11.1', file: 'main.js' }
});

const safeName = (value, fallback) => String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || fallback;

async function submitPiston(sourceCode, language, stdin) {
  const response = await fetch(`${pistonUrl}/api/v2/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      language: language.pistonLanguage,
      version: language.version,
      files: [{ name: language.file, content: sourceCode }],
      stdin,
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_memory_limit: 536870912,
      run_memory_limit: 268435456
    }),
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Piston returned HTTP ${response.status}`);
  const compileFailed = result.compile && result.compile.code !== 0;
  const runFailed = !compileFailed && (result.run?.code !== 0 || result.run?.signal);
  return {
    statusId: compileFailed ? 6 : runFailed ? 11 : 3,
    status: compileFailed ? 'Compilation Error' : runFailed ? 'Runtime Error' : 'Accepted',
    stdout: result.run?.stdout || '',
    stderr: result.run?.stderr || '',
    compileOutput: result.compile?.output || '',
    message: result.run?.signal ? `Signal: ${result.run.signal}` : '',
    time: result.run?.cpu_time == null ? null : Number((result.run.cpu_time / 1000).toFixed(3)),
    memory: result.run?.memory == null ? null : Math.round(result.run.memory / 1024)
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    const compiler = await fetch(`${pistonUrl}/api/v2/runtimes`, { signal: AbortSignal.timeout(2500) });
    res.json({ app: 'ok', compiler: compiler.ok ? 'ok' : 'unavailable', engine: 'piston' });
  } catch {
    res.status(503).json({ app: 'ok', compiler: 'unavailable', engine: 'piston' });
  }
});

app.get('/api/languages', (_req, res) => res.json(languages));

app.post('/api/run', async (req, res) => {
  const { sourceCode, language, inputs } = req.body || {};
  if (!languages[language]) return res.status(400).json({ error: 'Ngôn ngữ không được hỗ trợ.' });
  if (typeof sourceCode !== 'string' || !sourceCode.trim()) return res.status(400).json({ error: 'Chưa có source code.' });
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 100 || inputs.some(x => typeof x !== 'string' || x.length > 1_000_000)) {
    return res.status(400).json({ error: 'Danh sách input không hợp lệ (tối đa 100 file, 1 MB/file).' });
  }

  try {
    const results = [];
    for (const input of inputs) {
      const normalizedInput = normalizeInputText(input);
      results.push(await submitPiston(sourceCode, languages[language], normalizedInput));
    }
    res.json({ results });
  } catch (error) {
    const unavailable = error.name === 'TimeoutError' || /fetch failed|ECONNREFUSED|ENOTFOUND|Piston returned HTTP 5\d\d/i.test(error.message);
    res.status(unavailable ? 503 : 500).json({ error: unavailable ? 'Không kết nối được compiler Piston. Kiểm tra container piston.' : error.message });
  }
});

app.post('/api/export', (req, res) => {
  const { inputs, outputs, archiveName } = req.body || {};
  if (!Array.isArray(inputs) || !Array.isArray(outputs) || !inputs.length || inputs.length !== outputs.length || inputs.length > 100) {
    return res.status(400).json({ error: 'Input/output không hợp lệ.' });
  }
  const filename = `${safeName(archiveName, 'testcases').replace(/\.zip$/i, '')}.zip`;
  res.setHeader('content-type', 'application/zip');
  res.setHeader('content-disposition', `attachment; filename="${filename}"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', error => res.destroy(error));
  archive.pipe(res);
  inputs.forEach((input, index) => {
    const number = String(index + 1).padStart(3, '0');
    archive.append(normalizeInputText(input), { name: `${number}.in` });
    archive.append(String(outputs[index] ?? ''), { name: `${number}.out` });
  });
  archive.finalize();
});

app.get('*splat', (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`CP Test Forge listening on http://0.0.0.0:${port}`));
}

export { app };
