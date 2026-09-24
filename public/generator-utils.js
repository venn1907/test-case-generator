export function seedToUint32(seed) {
  const text = String(seed ?? '').trim();
  if (/^[+-]?\d+$/.test(text)) return Number(BigInt.asUintN(32, BigInt(text)));

  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function preferBoundary(rng, min, max, fallback) {
  if (rng() < 0.65) return rng() < 0.5 ? min : max;
  return fallback();
}

export function generateText(rng, length, characters, preferEdges = false) {
  const size = Number(length);
  const chars = String(characters ?? '');
  if (!Number.isInteger(size) || size < 0 || size > 100000) throw new Error('Độ dài văn bản phải từ 0 đến 100000');
  if (!chars.length) throw new Error('Tập ký tự không được để trống');
  const randomCharacter = () => chars[Math.floor(rng() * chars.length)];
  return Array.from({ length: size }, () => preferEdges
    ? preferBoundary(rng, chars[0], chars.at(-1), randomCharacter)
    : randomCharacter()).join('');
}
