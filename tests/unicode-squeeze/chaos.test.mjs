import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCompressor } from '../../docs/unicode-squeeze/compressor.mjs';
const official = JSON.parse(readFileSync(new URL('../../docs/unicode-squeeze/rules.json', import.meta.url)));
const visual = JSON.parse(readFileSync(new URL('../../docs/unicode-squeeze/visual-rules.json', import.meta.url)));
assert.equal(visual.rules.length, 183);
const all = [...official.rules, ...visual.rules];
assert.equal(new Set(all.map(r => `${r.source}\0${r.replacement}`)).size, all.length);
for (const r of visual.rules) {
  assert.ok(!official.excluded_bidi_classes.includes(r.bidi_class));
  assert.equal(r.evidence[0].kind, 'visual');
  assert.equal([...r.replacement].length, 1);
}
const normal = createCompressor(official.rules);
const chaos = createCompressor(all);
const snapshot = JSON.stringify(official.rules);
assert.equal(normal('Aa').text, 'Aa');
assert.equal(chaos('Aa').outputCodepoints, 1);
for (const r of visual.rules) assert.equal(chaos(r.source).outputCodepoints, 1);
assert.equal(JSON.stringify(official.rules), snapshot);
const rule = (replacement, kind) => ({ source: 'ab', replacement, evidence: [{ kind }] });
const tie = [rule('A', 'visual'), rule('B', 'confusable'), rule('C', 'normalization')];
assert.equal(createCompressor(tie)('ab').text, 'C');
assert.equal(createCompressor(tie.slice(0, 2))('ab').text, 'B');
assert.equal(createCompressor(tie)('ab', true, () => .999).text, 'A');
assert.equal(createCompressor(tie)('ab', true, () => 0).text, 'C');
assert.equal(createCompressor(all, true)('AA').outputCodepoints, 1);
assert.equal(createCompressor(all)('😀Aa').changes[0].inputStart, 2);
function minimum(text, rules, ignore) {
  const chars = [...text]; if (!chars.length) return 0;
  let best = 1 + minimum(chars.slice(1).join(''), rules, ignore);
  for (const r of rules) {
    const prefix = text.slice(0, r.source.length);
    if ((ignore ? prefix.toLowerCase() === r.source.toLowerCase() : prefix === r.source))
      best = Math.min(best, 1 + minimum(text.slice(r.source.length), rules, ignore));
  }
  return best;
}
let seed = 91;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const alphabet = [...'AaIlJrnvfW😀'];
for (const rules of [official.rules, all]) for (const ignore of [false, true]) {
  const run = createCompressor(rules, ignore);
  for (let i=0; i<80; i++) {
    const text = Array.from({ length: 6 }, () => alphabet[Math.floor(rng()*alphabet.length)]).join('');
    const expected = minimum(text, rules, ignore);
    for (const random of [false, true]) assert.equal(run(text, random, rng).outputCodepoints, expected);
  }
}
console.log('PASS: 183 visual candidates, mode separation, official priority, mixed-case, optimal random paths, highlights, no RTL; 640 brute-force comparisons');
