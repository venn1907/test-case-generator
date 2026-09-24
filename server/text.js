export function normalizeInputText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}
