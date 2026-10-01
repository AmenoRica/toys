import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as music from '../../docs/chord/music.js';

function harness(audioWindow = {}, timers = {}) {
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
    ...music, console, setTimeout:timers.setTimeout || setTimeout, clearTimeout:timers.clearTimeout || clearTimeout,
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
  const oscillators = [], contexts = [], sources = [], gains = [], filters = [], resumes = [];
  const param = () => ({value:0, events:[],
    setValueAtTime(value, time) {this.events.push(['set', value, time]);},
    linearRampToValueAtTime(value, time) {this.events.push(['linear', value, time]);},
    exponentialRampToValueAtTime(value, time) {this.events.push(['exponential', value, time]);},
    setTargetAtTime(value) {this.value = value;}});
  const node = properties => ({connections:[], connect(destination) {this.connections.push(destination);},
    disconnect() {this.connections = [];}, ...properties});
  class AudioContext {
    constructor() {this.state = state; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.resumeCalls = 0; contexts.push(this);}
    setState(next) {this.state = next; this.onstatechange?.();}
    resume() {this.resumeCalls++; return new Promise(resolve => {resumes.push(() => {this.setState('running'); resolve();});});}
    createGain() {const gain = node({gain:param()}); gains.push(gain); return gain;}
    createBiquadFilter() {const filter = node({frequency:param()}); filters.push(filter); return filter;}
    createBuffer(channels, length, sampleRate) {return {channels, length, sampleRate, data:new Float32Array(length)};}
    createBufferSource() {
      const source = node({started:false, stopped:false, start() {this.started = true;}, stop() {this.stopped = true;}});
      sources.push(source); return source;
    }
    createOscillator() {
      const oscillator = node({frequency:param(), detune:param(),
        started:false, stops:[], start(time) {this.started = true; this.startTime = time;}, stop(time) {this.stops.push(time);}});
      oscillators.push(oscillator);
      return oscillator;
    }
  }
  return {AudioContext, oscillators, contexts, sources, gains, filters, resumes, resume:() => resumes.at(-1)()};
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

test('iOS preparation uses playback session and unlocks synchronously inside the initial tap', async () => {
  const audio = synth('suspended'); const session = {type:'auto'};
  const t = harness({AudioContext:audio.AudioContext, navigator:{audioSession:session}});
  const playback = t.play([0]);
  assert.equal(session.type, 'playback');
  assert.equal(audio.contexts[0].resumeCalls, 1);
  assert.equal(audio.sources[0].started, true);
  assert.equal(audio.sources[0].buffer.data[0], 0);
  assert.equal(audio.sources[0].connections[0], audio.contexts[0].destination);
  audio.resume(); await playback;
  assert.equal(audio.oscillators.length, 2);
  t.stop();
});
test('interrupted contexts resume on a fresh tap; mid-play interruption cancels voices', async () => {
  const audio = synth('interrupted'); const t = harness({AudioContext:audio.AudioContext});
  const playback = t.play([0]); audio.resume(); await playback;
  audio.contexts[0].setState('interrupted');
  assert.equal(t.el('audioState').textContent, 'SYNTH');
  assert.match(t.el('audioNotice').textContent, /소리가 중단/);
  assert.ok(audio.oscillators.every(voice => voice.stops.includes(undefined)));
  const retry = t.play([0]); audio.resume(); await retry;
  assert.equal(t.el('audioNotice').hidden, true);
  assert.equal(t.el('audioState').textContent, 'PLAYING');
  t.stop();
});
test('closed audio contexts are recreated without letting old state events stop new playback', async () => {
  const audio = synth(); const t = harness({AudioContext:audio.AudioContext});
  await t.play([0]); audio.contexts[0].setState('closed'); await t.play([0]);
  assert.equal(audio.contexts.length, 2);
  assert.equal(audio.gains[2].connections[0], audio.contexts[1].destination);
  audio.contexts[0].setState('closed');
  assert.equal(t.el('audioState').textContent, 'PLAYING');
  t.stop();
});
test('a blocked resume times out visibly and never plays notes when it resolves later', async () => {
  const audio = synth('suspended'); const tasks = new Map(); let nextId = 0;
  const t = harness({AudioContext:audio.AudioContext}, {
    setTimeout(fn, delay) {tasks.set(++nextId, {fn, delay}); return nextId;},
    clearTimeout(id) {tasks.delete(id);}
  });
  const feedback = t.el('feedback').innerHTML;
  const playback = t.play([0]);
  [...tasks.values()].find(task => task.delay === 3000).fn(); await playback;
  assert.match(t.el('audioNotice').textContent, /소리를 시작하지 못/);
  assert.equal(t.el('audioNotice').hidden, false);
  assert.equal(t.el('feedback').innerHTML, feedback);
  assert.equal(audio.sources[0].stopped, true);
  audio.resume(); await Promise.resolve();
  assert.equal(audio.oscillators.length, 0);
  assert.equal(t.el('audioState').textContent, 'SYNTH');
  assert.equal(tasks.size, 0);
});
test('resume rejection and non-running resolution report failure without unhandled playback', async () => {
  for (const rejected of [true, false]) {
    const audio = synth('interrupted');
    audio.AudioContext.prototype.resume = () => rejected ? Promise.reject(new Error('blocked')) : Promise.resolve();
    const t = harness({AudioContext:audio.AudioContext}); await t.play([0]);
    assert.equal(audio.oscillators.length, 0);
    assert.match(t.el('audioNotice').textContent, /소리를 시작하지 못/);
    assert.equal(t.el('audioState').textContent, 'SYNTH');
  }
});
test('latest rapid tap wins even when earlier resume resolves first', async () => {
  const audio = synth('suspended'); const t = harness({AudioContext:audio.AudioContext});
  const first = t.play([0]); const last = t.play([0,4,7,11], true);
  audio.resumes[0](); await first;
  assert.equal(audio.oscillators.length, 0);
  audio.resumes[1](); await last;
  assert.equal(audio.oscillators.length, 8);
  assert.equal(t.el('audioNotice').hidden, true);
  t.stop();
});
test('tone graph reaches the destination with positive gain and future start times', async () => {
  const audio = synth(); const t = harness({AudioContext:audio.AudioContext}); await t.play([0,4,7,11], true);
  const master = audio.gains[0];
  assert.equal(master.gain.value, .225);
  assert.equal(master.connections[0], audio.contexts[0].destination);
  for (const voice of audio.oscillators) {
    const filter = voice.connections[0]; const envelope = filter.connections[0];
    assert.equal(envelope.connections[0], master);
    assert.ok(envelope.gain.events.some(([kind, value]) => kind === 'linear' && value > 0));
    assert.ok(voice.startTime > audio.contexts[0].currentTime);
  }
  t.stop();
});
test('unsupported audio-session API does not block sound; zero app volume is explained', async () => {
  const audio = synth(); const t = harness({AudioContext:audio.AudioContext,
    navigator:{get audioSession() {throw new Error('unsupported');}}});
  await t.play([0]); assert.equal(audio.oscillators.length, 2); t.stop();
  t.el('volume').value = '0'; await t.play([0]);
  assert.equal(audio.oscillators.length, 2);
  assert.match(t.el('audioNotice').textContent, /볼륨이 0%/);
  assert.equal(t.el('volume').value, '0');
});

test('partial graph failure stops scheduled voices and preserves the exercise feedback', async () => {
  const audio = synth(); const original = audio.AudioContext.prototype.createOscillator;
  audio.AudioContext.prototype.createOscillator = function() {
    if (audio.oscillators.length === 2) throw new Error('graph failure');
    return original.call(this);
  };
  const t = harness({AudioContext:audio.AudioContext}); const feedback = t.el('feedback').innerHTML;
  await t.play([0,4,7,11], true);
  assert.equal(audio.oscillators.length, 2);
  assert.ok(audio.oscillators.every(voice => voice.stops.includes(undefined)));
  assert.match(t.el('audioNotice').textContent, /소리를 재생하지 못/);
  assert.equal(t.el('audioState').textContent, 'SYNTH');
  assert.equal(t.el('feedback').innerHTML, feedback);
});
