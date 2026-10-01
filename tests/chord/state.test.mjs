import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as music from '../../docs/chord/music.js';

function harness(audioWindow = {}) {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, {
      id, value: id === 'rootSelect' ? 'random' : id === 'volume' ? '50' : '',
      innerHTML: '', textContent: '', disabled: false, hidden: false, dataset: {},
      classList: {add() {}, remove() {}}, addEventListener() {},
      setAttribute(key, value) {this[key] = value;}, focus() {}
    });
    return elements.get(id);
  };
  const modes = ['triads', 'sevenths', 'all'].map(mode => ({...el(mode), dataset:{mode}}));
  const inputModes = ['roll', 'names'].map(inputMode => ({...el(inputMode), dataset:{inputMode}}));
  const listeners = {};
  const sandbox = {
    ...music, console, setTimeout, clearTimeout,
    document: {getElementById:el, querySelectorAll:selector => selector === '[data-mode]' ? modes : inputModes, querySelector:() => null,
      addEventListener(type, handler) {listeners[type] = handler;}, activeElement:null, modelContext:undefined},
    window: {addEventListener() {}, ...audioWindow}
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(new URL('../../docs/chord/app.js', import.meta.url), 'utf8').replace(/^import.*\n/, '');
  vm.runInContext(code + ';this.test={snapshot,check,reset,reveal,next,toggleNote,play,stop,setInputMode,editNoteNames,el:$};', sandbox);
  sandbox.test.keydown = event => listeners.keydown(event);
  return sandbox.test;
}

test('initial root, correction and no double scoring', () => {
  const t = harness();
  assert.equal(t.snapshot().selectedSemitones.join(','), '0');
  assert.equal(t.el('feedback').innerHTML.includes('chord-explanation'), false);
  t.check();
  assert.equal(t.el('feedback').innerHTML.includes('chord-explanation'), false);
  assert.equal(t.snapshot().score.attempts, 1);
  assert.equal(t.snapshot().result.missing.join(','), '4,7,11');
  assert.match(t.el('feedback').innerHTML, /장3도 · 완전5도 · 장7도가 필요합니다/);
  assert.doesNotMatch(t.el('noteRows').innerHTML, /\bmissing\b/);
  for (const n of [4, 7, 11]) t.toggleNote(n, false);
  t.check();
  assert.equal(t.snapshot().stage, 'success');
  assert.match(t.el('feedback').innerHTML, /메이저 3화음에 장7도를 더한 코드/);
  assert.match(t.el('feedback').innerHTML, /0 · 4 · 7 · 11반음/);
  assert.equal(t.snapshot().score.correct, 0);
  assert.equal(t.snapshot().score.attempts, 1);
  t.check();
  assert.equal(t.snapshot().score.attempts, 1);
});
test('wrong-answer feedback does not reveal correct note names or mark missing rows', () => {
  const t = harness();
  for (const n of [3, 7, 11]) t.toggleNote(n, false);
  t.check();
  assert.match(t.el('feedback').innerHTML, /E♭는 단3도입니다\.<br>장3도가 필요합니다\./);
  assert.doesNotMatch(t.el('feedback').innerHTML, /E는|필요한 음|chord-explanation/);
  assert.doesNotMatch(t.el('noteRows').innerHTML, /\bmissing\b/);
  t.toggleNote(3, false); t.toggleNote(4, false); t.check();
  assert.equal(t.snapshot().stage, 'success');
  assert.equal(t.snapshot().score.correct, 0);
  assert.equal(t.snapshot().score.attempts, 1);
});
test('first-try success, reset, reveal and fixed root', () => {
  const t = harness();
  for (const n of [4, 7, 11]) t.toggleNote(n, false);
  t.check();
  assert.equal(t.snapshot().score.correct, 1);
  assert.equal(t.snapshot().score.streak, 1);
  t.reset();
  assert.equal(t.snapshot().selectedSemitones.join(','), '0');
  assert.equal(t.el('feedback').innerHTML.includes('chord-explanation'), false);
  t.next(); t.reveal();
  assert.equal(t.snapshot().score.attempts, 2);
  assert.equal(t.snapshot().score.streak, 0);
  assert.equal(t.snapshot().stage, 'revealed');
  assert.match(t.el('feedback').innerHTML, /chord-explanation/);
  assert.match(t.el('feedback').innerHTML, /근음 기준:/);
  t.check();
  assert.equal(t.snapshot().score.attempts, 2);
  t.el('rootSelect').value = '6'; t.next();
  assert.equal(t.snapshot().root, 'F♯');
  assert.equal(t.el('feedback').innerHTML.includes('chord-explanation'), false);
});
test('invalid semitone inputs fail without changing selection', () => {
  const t = harness();
  for (const n of [-1, 13, 1.5]) assert.throws(() => t.toggleNote(n, false));
  assert.equal(t.snapshot().selectedSemitones.join(','), '0');
});

test('hard mode hides the roll, keeps interval hints and allows correction without double scoring', () => {
  const t = harness();
  t.setInputMode('names');
  assert.equal(t.el('pianoRoll').hidden, true);
  assert.equal(t.el('rollSummary').hidden, true);
  assert.equal(t.el('noteEntry').hidden, false);
  assert.equal(t.el('fixedRootName').textContent, 'C');
  t.el('noteInput').value = 'Eb G B'; t.editNoteNames(); t.check();
  assert.match(t.el('feedback').innerHTML, /E♭는 단3도입니다\.<br>장3도가 필요합니다\./);
  assert.doesNotMatch(t.el('feedback').innerHTML, /chord-explanation/);
  assert.equal(t.el('pianoRoll').hidden, true);
  t.el('noteInput').value = 'e g b'; t.editNoteNames(); t.check();
  assert.equal(t.snapshot().stage, 'success');
  assert.equal(t.el('noteInput').readOnly, true);
  assert.equal(t.snapshot().score.attempts, 1);
  assert.equal(t.snapshot().score.correct, 0);
  t.setInputMode('roll');
  assert.equal(t.el('pianoRoll').hidden, false);
  assert.equal(t.el('noteEntry').hidden, true);
  assert.equal(t.snapshot().selectedSemitones.join(','), '0');
  assert.equal(t.snapshot().score.attempts, 1);
});
test('hard-mode syntax errors do not score; Enter grades valid text with the fixed root', () => {
  const t = harness(); t.setInputMode('names');
  t.el('noteInput').value = 'E#b G B'; t.editNoteNames(); t.check();
  assert.equal(t.snapshot().score.attempts, 0);
  assert.equal(t.el('noteInput')['aria-invalid'], 'true');
  assert.match(t.el('feedback').innerHTML, /음 이름을 확인해주세요/);
  t.el('noteInput').value = 'C E G B C'; t.editNoteNames();
  let prevented = false;
  t.keydown({target:t.el('noteInput'), key:'Enter', preventDefault() {prevented = true;}});
  assert.equal(prevented, true);
  assert.equal(t.snapshot().stage, 'success');
  assert.equal(t.snapshot().score.correct, 1);
  assert.equal(t.snapshot().score.streak, 1);
  t.reset();
  assert.equal(t.el('noteInput').value, '');
  assert.equal(t.el('noteInput').readOnly, false);
  assert.equal(t.snapshot().score.attempts, 1);
});
test('hard-mode reveal and next keep the roll hidden and clear stale text', () => {
  const t = harness(); t.setInputMode('names'); t.reveal();
  assert.equal(t.el('noteInput').value, 'E G B');
  assert.equal(t.el('noteInput').readOnly, true);
  assert.equal(t.el('pianoRoll').hidden, true);
  assert.equal(t.snapshot().score.attempts, 1);
  t.el('rootSelect').value = '6'; t.next();
  assert.equal(t.snapshot().inputMode, 'names');
  assert.equal(t.el('pianoRoll').hidden, true);
  assert.equal(t.el('fixedRootName').textContent, 'F♯');
  assert.equal(t.el('noteInput').value, '');
  assert.equal(t.el('noteInput').readOnly, false);
  assert.equal(t.el('noteInput')['aria-invalid'], 'false');
});

function synth(state = 'running') {
  const oscillators = [];
  const param = () => ({value:0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime(value) {this.value = value;}});
  let resume;
  class AudioContext {
    constructor() {this.state = state; this.currentTime = 0; this.destination = {};}
    resume() {return new Promise(resolve => {resume = () => {this.state = 'running'; resolve();};});}
    createGain() {return {gain:param(), connect() {}};}
    createBiquadFilter() {return {frequency:param(), connect() {}};}
    createOscillator() {
      const oscillator = {frequency:param(), detune:param(), connect() {},
        started:false, start() {this.started = true;}, stop() {}};
      oscillators.push(oscillator);
      return oscillator;
    }
  }
  return {AudioContext, oscillators, resume:() => resume()};
}

test('stop during pending audio resume prevents delayed playback', async () => {
  const audio = synth('suspended');
  const t = harness({AudioContext:audio.AudioContext});
  const playback = t.play([0, 4, 7, 11], true);
  t.stop(); audio.resume(); await playback;
  assert.equal(audio.oscillators.length, 0);
  assert.equal(t.el('audioState').textContent, 'SYNTH');
  assert.equal(t.el('playhead').hidden, true);
});

test('Web Audio schedules each chord pitch and updates transport state', async () => {
  const audio = synth();
  const t = harness({AudioContext:audio.AudioContext});
  await t.play([0, 4, 7, 11], true);
  assert.equal(audio.oscillators.length, 8);
  for (const [i, offset] of [0, 4, 7, 11].entries()) {
    const expected = 440 * 2 ** ((48 + offset - 69) / 12);
    for (const oscillator of audio.oscillators.slice(i * 2, i * 2 + 2)) {
      assert.equal(oscillator.frequency.value, expected);
      assert.equal(oscillator.type, 'triangle');
      assert.equal(oscillator.started, true);
    }
  }
  assert.equal(t.el('audioState').textContent, 'PLAYING');
  assert.equal(t.el('playhead').hidden, false);
  t.stop();
  assert.equal(t.el('audioState').textContent, 'SYNTH');
  assert.equal(t.el('playhead').hidden, true);
});
test('hard mode plays typed chord pitches without a roll playhead', async () => {
  const audio = synth(); const t = harness({AudioContext:audio.AudioContext});
  t.setInputMode('names'); t.el('noteInput').value = 'E G B'; t.editNoteNames();
  await t.play(t.snapshot().selectedSemitones, true);
  assert.equal(audio.oscillators.length, 8);
  assert.equal(t.el('playhead').hidden, true);
  assert.equal(t.el('audioState').textContent, 'PLAYING');
  t.stop();
});
