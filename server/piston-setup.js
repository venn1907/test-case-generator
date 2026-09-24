const pistonUrl = (process.env.PISTON_URL || 'http://piston:2000').replace(/\/$/, '');
const packages = [
  ['gcc', '10.2.0'],
  ['java', '15.0.2'],
  ['python', '3.12.0'],
  ['node', '20.11.1']
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForApi() {
  for (let attempt = 1; attempt <= 90; attempt++) {
    try {
      const response = await fetch(`${pistonUrl}/api/v2/packages`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return response.json();
    } catch {}
    console.log(`Waiting for Piston API (${attempt}/90)...`);
    await wait(2000);
  }
  throw new Error('Piston API did not become ready');
}

async function install(language, version) {
  const available = await fetch(`${pistonUrl}/api/v2/packages`).then(response => response.json());
  const current = available.find(item => item.language === language && item.language_version === version);
  if (current?.installed) return console.log(`${language} ${version} is already installed`);
  console.log(`Installing ${language} ${version}...`);
  const response = await fetch(`${pistonUrl}/api/v2/packages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language, version }), signal: AbortSignal.timeout(15 * 60 * 1000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Cannot install ${language} ${version}`);
  console.log(`Installed ${language} ${result.version || version}`);
}

await waitForApi();
for (const [language, version] of packages) await install(language, version);
console.log('All Piston runtimes are ready.');
