// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { recordedWav } from '../../docs/webmollusk/wav.mjs';
let Capture;
globalThis.AudioWorkletProcessor = class {
  constructor() { this.messages = []; this.port = { postMessage: data => this.messages.push(structuredClone(data)) }; }
};
globalThis.registerProcessor = (name, processor) => { Capture = processor; };
await import('../../docs/webmollusk/capture.mjs');
const capture = new Capture();
const left = Float32Array.from({ length: 4203 }, (_, i) => i / 10000);
capture.process([[left, Float32Array.from(left, x => x * -0.5)]]);
capture.port.onmessage({ data: 'stop' });
capture.port.onmessage({ data: 'stop' });
assert.equal(capture.process([[left]]), false);
assert.equal(capture.messages.filter(x => x.done).length, 1);
const chunks = capture.messages.filter(x => x.chunk).map(x => x.chunk);
assert.deepEqual(chunks.map(x => x.length), [4096, 107], 'Final partial chunk must be retained');
const wave = Buffer.from(recordedWav(chunks, 48000));
assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
assert.equal(wave.readUInt32LE(4), wave.length - 8);
assert.equal(wave.readUInt16LE(20), 3);
assert.equal(wave.readUInt16LE(22), 1);
assert.equal(wave.readUInt32LE(24), 48000);
assert.equal(wave.readUInt32LE(40), left.length * 4);
for (let i = 0; i < left.length; i++) assert.equal(wave.readFloatLE(44 + i * 4), left[i] * 0.25);
const limit = new Capture();
limit.frames = 11999997;
limit.process([[Float32Array.of(0.1, 0.2, 0.3, 0.4)]]);
assert.equal(limit.frames, 12000000);
assert.equal(limit.messages[0].chunk.length, 3);
assert.equal(limit.messages[1].done, true);
assert.throws(() => recordedWav([], 48000));
assert.throws(() => recordedWav([Float32Array.of(NaN)], 48000));
assert.throws(() => recordedWav(chunks, 22050));
console.log('PASS: PCM capture, stereo averaging, partial flush, idempotent stop, length cap, WAV encoding.');
// Drive the actual UI module with browser APIs stubbed, without using a microphone.
const elements = new Map();
for (const id of ['file', 'preset', 'convert', 'status', 'result', 'record', 'record-time',
  'original', 'output', 'filename', 'original-download', 'download', 'result-label', 'details']) {
  elements.set(id, { textContent: '', hidden: false, disabled: false, value: '0', controls: true,
    selectedOptions: [{ textContent: 'Squid Girl' }], handlers: {},
    addEventListener(name, fn) { this.handlers[name] = fn; }, pause() {}, load() {},
    removeAttribute(name) { delete this[name]; } });
}
const el = id => elements.get(id);
globalThis.document = { getElementById: el };
globalThis.window = { addEventListener() {}, AudioWorkletNode: true };
let liveNode, stops = 0, closed = 0, conversions = 0, denied = false;
const track = { stop() { stops++; }, addEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
  async getUserMedia() {
    if (denied) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  }
} } });
globalThis.AudioContext = class {
  constructor() { this.state = 'running'; this.sampleRate = 48000; this.audioWorklet = { async addModule() {} }; }
  async resume() {}
  async close() { this.state = 'closed'; closed++; }
  createMediaStreamSource() { return { connect() {} }; }
};
globalThis.AudioWorkletNode = class {
  constructor() {
    liveNode = this;
    this.port = { postMessage: () => { this.completion = this.port.onmessage({ data: { done: true } }); }, close() {} };
  }
  connect() {} disconnect() {}
};
globalThis.Worker = class {
  postMessage({ input }) {
    conversions++;
    assert.equal(new DataView(input).getUint32(40, true), 24);
    queueMicrotask(() => this.onmessage({ data: { output: input, frames: 24006, rate: 48000, milliseconds: 1, peak: 0.2 } }));
  }
};
await import('../../docs/webmollusk/app.mjs');
await el('record').handlers.click();
assert.equal(el('record').disabled, false, 'Stop stays enabled during capture');
assert.equal(el('file').disabled, true);
assert.equal(el('original').controls, false, 'Playback disabled during recording');
await liveNode.port.onmessage({ data: { chunk: Float32Array.of(0.1, 0.2, 0.3, 0.1, 0.2, 0.3) } });
await el('record').handlers.click();
await liveNode.completion;
assert(stops > 0 && closed === 1, 'Microphone and context released');
assert.equal(conversions, 1, 'Stop automatically converts once');
assert.equal(el('original-download').hidden, false);
assert.equal(el('result').hidden, false);
assert.equal(el('file').disabled, false);
assert.equal(el('record').disabled, false);
assert.equal(el('output').controls, true);
assert.match(el('download').download, /-squid-girl.wav$/);
// No play() exists on the stub: calling autoplay would fail this check.
denied = true;
await el('record').handlers.click();
assert.match(el('status').textContent, /허용되지/);
assert.equal(el('record').disabled, false);
assert.equal(closed, 2);
assert.equal(el('original-download').hidden, false, 'Denied capture preserves the last recording');
console.log('PASS: stop -> automatic conversion, manual playback, both downloads, cleanup, permission-denied recovery.');

const { audioFileError, audioInput } = await import('../../docs/webmollusk/wav.mjs');
assert(audioFileError({ name: 'video.exe', size: 100 }));
assert(audioFileError({ name: 'long.mp3', size: 64 * 1024 * 1024 + 1 }));
let decoded, decodeFailure = false;
globalThis.OfflineAudioContext = class {
  constructor(channels, length, rate) { assert.equal(rate, 48000); }
  async decodeAudioData() { if (decodeFailure) throw new Error('Codec unsupported'); return decoded; }
};
const wavBytes = wave.buffer.slice(wave.byteOffset, wave.byteOffset + wave.byteLength);
assert.equal(await audioInput({ name: 'tone.wav', size: wavBytes.byteLength, arrayBuffer: async () => wavBytes }), wavBytes, 'WAV stays unchanged');
for (const extension of ['mp3', 'm4a', 'aac', 'flac', 'ogg']) {
  decoded = { numberOfChannels: 2, length: 3, sampleRate: 48000,
    getChannelData: ch => ch ? Float32Array.of(-0.25, -0.5, -0.75) : Float32Array.of(0.5, 1, 1.5) };
  const bytes = Buffer.from(await audioInput({ name: `tone.${extension}`, size: 100, arrayBuffer: async () => new ArrayBuffer(100) }));
  assert.equal(bytes.readUInt32LE(24), 48000);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.deepEqual([0, 1, 2].map(i => bytes.readFloatLE(44 + i * 4)), [0.125, 0.25, 0.375]);
}
const compressed = { name: 'tone.mp3', size: 100, arrayBuffer: async () => new ArrayBuffer(100) };
decoded = { numberOfChannels: 3, length: 3 };
await assert.rejects(audioInput(compressed), /스테레오/);
decoded = { numberOfChannels: 1, length: 12000001 };
await assert.rejects(audioInput(compressed), /250초/);
decodeFailure = true;
await assert.rejects(audioInput(compressed), /코덱/);
console.log('PASS: extra formats, 48kHz decoding, stereo averaging, WAV passthrough, size/channel/length guards, codec failure.');
