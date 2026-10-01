import test from 'node:test';
import assert from 'node:assert/strict';
import { CHORDS, spellChord, grade } from '../../docs/chord/music.js';

test('132 root/chord combinations have correct grading and spelling count', () => {
  for (let root = 0; root < 12; root++) {
    for (const chord of CHORDS) {
      assert.equal(grade(chord.intervals, chord.intervals).correct, true);
      assert.equal(grade([0], chord.intervals).correct, false);
      assert.equal(grade([...chord.intervals, 12], chord.intervals).correct, false);
      assert.equal(spellChord(root, chord).length, chord.intervals.length);
      // Check written note names against actual pitches, including double accidentals.
      const naturals = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};
      spellChord(root, chord).forEach((name, i) => {
        const accidental = [...name.slice(1)].reduce((sum, mark) => sum + (mark === '♯' ? 1 : -1), 0);
        assert.equal((naturals[name[0]] + accidental + 12) % 12, (root + chord.intervals[i]) % 12);
      });
    }
  }
});
test('chord spelling respects chord degrees and enharmonics', () => {
  const chord = id => CHORDS.find(c => c.id === id);
  assert.deepEqual(spellChord(0, chord('dim7')), ['C', 'E♭', 'G♭', 'B♭♭']);
  assert.deepEqual(spellChord(6, chord('maj7')), ['F♯', 'A♯', 'C♯', 'E♯']);
  assert.deepEqual(spellChord(1, chord('minor')), ['D♭', 'F♭', 'A♭']);
});
test('grading reports missing and extra notes and de-duplicates input', () => {
  assert.deepEqual(grade([0, 3, 7], [0, 4, 7]), {correct:false, missing:[4], extra:[3]});
  assert.equal(grade([0, 4, 7, 7], [0, 4, 7]).correct, true);
});
