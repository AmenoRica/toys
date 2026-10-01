import test from 'node:test';
import assert from 'node:assert/strict';
import { CHORDS, spellChord, grade, wrongAnswerHints, parseNoteNames } from '../../docs/chord/music.js';

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

test('wrong notes name their intervals, while missing notes name only required intervals', () => {
  const chord = id => CHORDS.find(c => c.id === id);
  const hints = (root, id, selected) => wrongAnswerHints(root, chord(id), grade(selected, chord(id).intervals));
  assert.deepEqual(hints(0, 'maj7', [0, 3, 7, 11]), ['E♭는 단3도입니다.', '장3도가 필요합니다.']);
  assert.deepEqual(hints(0, 'maj7', [0]), ['장3도 · 완전5도 · 장7도가 필요합니다.']);
  assert.deepEqual(hints(6, 'major', [0, 3, 7]), ['A는 단3도입니다.', '장3도가 필요합니다.']);
  assert.deepEqual(hints(0, 'sus4', [0, 6, 7]), ['F♯는 증4도입니다.', '완전4도가 필요합니다.']);
  assert.deepEqual(hints(0, 'major', [0, 4, 6]), ['G♭는 감5도입니다.', '완전5도가 필요합니다.']);
  assert.deepEqual(hints(0, 'augmented', [0, 4, 7]), ['G는 완전5도입니다.', '증5도가 필요합니다.']);
  assert.deepEqual(hints(0, 'dim7', [0, 3, 6, 10]), ['B♭는 단7도입니다.', '감7도가 필요합니다.']);
  assert.deepEqual(hints(0, 'maj7', [0, 4, 7, 11, 12]), ['C4는 완전8도입니다.']);
});

test('all 132 root/chord combinations have interval-only hints for missing notes', () => {
  for (let root = 0; root < 12; root++) {
    for (const chord of CHORDS) {
      const hints = wrongAnswerHints(root, chord, grade([0], chord.intervals));
      assert.equal(hints.length, 1);
      assert.doesNotMatch(hints[0], /[A-G]|undefined/);
      assert.match(hints[0], /도가 필요합니다\.$/);
      for (let offset = 1; offset <= 12; offset++) {
        if (chord.intervals.includes(offset)) continue;
        const wrong = wrongAnswerHints(root, chord, grade([0, offset], chord.intervals));
        assert.doesNotMatch(wrong.join(' '), /undefined/);
        assert.match(wrong[0], /는 .+도입니다\.$/);
        assert.doesNotMatch(wrong.at(-1), /[A-G]/);
      }
    }
  }
});

test('written answers grade correctly for all 132 root/chord combinations', () => {
  for (let root = 0; root < 12; root++) {
    for (const chord of CHORDS) {
      for (const notes of [spellChord(root, chord), spellChord(root, chord).slice(1)]) {
        const answer = parseNoteNames(notes.join(' '), root);
        assert.equal(answer.valid, true);
        assert.equal(grade([0, ...answer.offsets], chord.intervals).correct, true);
      }
    }
  }
});
test('note-name parsing accepts enharmonics, case, separators and double accidentals', () => {
  assert.deepEqual(parseNoteNames(' e , g · b ', 0), {valid:true, offsets:[4,7,11]});
  assert.deepEqual(parseNoteNames('D# Eb D♯ E♭', 0), {valid:true, offsets:[3]});
  assert.deepEqual(parseNoteNames('B# Cb E# Fb G## Bbb', 0), {valid:true, offsets:[0,11,5,4,9]});
  assert.deepEqual(parseNoteNames('A♯ C♯ E♯', 6), {valid:true, offsets:[4,7,11]});
  assert.deepEqual(parseNoteNames('', 0), {valid:true, offsets:[]});
  for (const text of ['H', 'E3', '#', 'C#b', 'Dbbb', '<img>', 'E/G', 'EG']) {
    assert.deepEqual(parseNoteNames(text, 0), {valid:false, offsets:[]});
  }
});
