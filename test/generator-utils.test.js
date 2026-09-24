import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText, preferBoundary, seedToUint32 } from '../public/generator-utils.js';

test('string seeds are stable and distinct', () => {
  assert.equal(seedToUint32('contest-round-1'), seedToUint32('contest-round-1'));
  assert.notEqual(seedToUint32('contest-round-1'), seedToUint32('contest-round-2'));
  assert.equal(seedToUint32('2026'), 2026);
});

test('boundary strategy still randomizes but prefers min and max', () => {
  assert.equal(preferBoundary(sequence([0.2, 0.1]), -10, 10, () => 3), -10);
  assert.equal(preferBoundary(sequence([0.2, 0.9]), -10, 10, () => 3), 10);
  assert.equal(preferBoundary(sequence([0.9]), -10, 10, () => 3), 3);
});

test('text generation can prefer the edges of its character set', () => {
  assert.equal(generateText(sequence([0.2, 0.1, 0.2, 0.9]), 2, 'abc', true), 'ac');
  assert.equal(generateText(sequence([0, 0.99]), 2, 'abc'), 'ac');
});

function sequence(values) {
  let index = 0;
  return () => values[index++];
}
