import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCompressor } from '../../docs/unicode-squeeze/compressor.mjs';
const { rules, excluded_rules } = JSON.parse(readFileSync(new URL('../../docs/unicode-squeeze/rules.json', import.meta.url)));
const compress = createCompressor(rules);
const blockedOutputs = new Set(excluded_rules.map(r => r.replacement));
for (const ignoreCase of [false, true]) {
  const run = createCompressor(rules, ignoreCase);
  for (const random of [false, true]) {
    for (const excluded of excluded_rules) {
      const result = run(excluded.source, random);
      assert.ok(Array.from(result.text).every(c => !blockedOutputs.has(c)));
    }
  }
}
assert.equal(compress('\u05f0').text, '\u05f0'); // User-entered text is preserved.
assert.equal(compress('office').text, 'oﬃce');
assert.equal(compress('xiber').text, 'ⅺber');
assert.equal(compress('cyblr').text, 'cyЫr');
assert.equal(compress('Aeter').text, 'Aeter');
assert.equal(compress('aeter').text, 'æter');
assert.equal(compress('😀한글\n').text, '😀한글\n');
assert.equal(compress('😀').outputCodepoints, 1);
assert.equal(compress('').outputCodepoints, 0);
assert.deepEqual(compress('😀office!').changes, [
  { inputStart: 3, inputEnd: 6, outputStart: 3, outputEnd: 4 }
]);
assert.deepEqual(compress('😀').changes, []);
assert.equal(createCompressor(rules, true)('Aeter').outputCodepoints, 4);
assert.throws(() => createCompressor([{ source: 'a', replacement: 'x' }]));
const rule = (source, replacement, kind = 'confusable') => ({ source, replacement, evidence: [{ kind }] });
// A longest-match greedy algorithm loses here: abc+d+e versus ab+cde.
const overlap = createCompressor([rule('abc', 'X'), rule('ab', 'Y'), rule('cde', 'Z')]);
assert.equal(overlap('abcde').text, 'YZ');
assert.equal(createCompressor([rule('ab', 'x'), rule('xc', 'y')])('abc').text, 'xc');
const tie = createCompressor([rule('ab', 'A'), rule('ab', 'Ω', 'normalization'), rule('ab', 'Z', 'normalization')]);
assert.equal(tie('ab').text, 'Z');
assert.notEqual(tie('ab', true, () => 0).text, tie('ab', true, () => .999).text);
assert.equal(createCompressor([rule('xy', '😀')])('xy').outputCodepoints, 1);
assert.deepEqual(createCompressor([rule('xy', '😀')])('😀xy!xy').changes, [
  { inputStart: 2, inputEnd: 4, outputStart: 2, outputEnd: 4 },
  { inputStart: 5, inputEnd: 7, outputStart: 5, outputEnd: 7 }
]);
assert.deepEqual(createCompressor([rule('ab', 'X')])('abab').changes, [
  { inputStart: 0, inputEnd: 4, outputStart: 0, outputEnd: 2 }
]);

function brute(text, caseFold) {
  if (!text) return 0;
  const chars = Array.from(text);
  let best = 1 + brute(chars.slice(1).join(''), caseFold);
  for (const r of rules) {
    const prefix = text.slice(0, r.source.length);
    if ((caseFold ? prefix.toLowerCase() === r.source.toLowerCase() : prefix === r.source)) {
      best = Math.min(best, 1 + brute(text.slice(r.source.length), caseFold));
    }
  }
  return best;
}
let seed = 41;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const alphabet = Array.from('fijlVIXrnAOae 12.!😀');
for (const caseFold of [false, true]) {
  const run = createCompressor(rules, caseFold);
  for (let sample = 0; sample < 150; sample++) {
    const text = Array.from({ length: 7 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('');
    const optimal = brute(text, caseFold);
    for (const random of [false, true]) {
      const result = run(text, random, rng);
      assert.equal(result.outputCodepoints, optimal);
      assert.equal(Array.from(result.text).length, optimal);
      for (const change of result.changes) {
        assert.ok(Array.from(text.slice(change.inputStart, change.inputEnd)).length >
          Array.from(result.text.slice(change.outputStart, change.outputEnd)).length);
      }
    }
  }
}
for (const r of rules) assert.equal(compress(r.source).outputCodepoints, 1);
const long = 'office 😀 '.repeat(100000);
const started = performance.now();
const result = compress(long);
assert.equal(result.outputCodepoints, 700000);
console.log(`OK: all rules, greedy counterexample, case, shuffle, Unicode, 600 brute-force comparisons; 900000 codepoints in ${Math.round(performance.now() - started)} ms`);
