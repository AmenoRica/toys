// SPDX-License-Identifier: AGPL-3.0-or-later
// Run: node tests/check.mjs
import assert from 'node:assert/strict';
import createMollusk from '../../docs/webmollusk/mollusk.mjs';

const engine = await createMollusk();
function convert(bytes, preset) {
  const pointer = engine._malloc(bytes.length);
  assert(pointer);
  try {
    engine.HEAPU8.set(bytes, pointer);
    const code = engine._mollusk_convert(pointer, bytes.length, preset);
    const start = engine._mollusk_output_data();
    return { code, wave: Buffer.from(engine.HEAPU8.slice(start, start + engine._mollusk_output_size())),
      peak: engine._mollusk_output_peak(), frames: engine._mollusk_output_frames(), rate: engine._mollusk_output_rate() };
  } finally { engine._free(pointer); }
}
function wav(channels, rate = 48000) {
  const frames = channels[0].length, count = channels.length;
  const result = Buffer.alloc(44 + frames * count * 4);
  result.write('RIFF'); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(3, 20); result.writeUInt16LE(count, 22);
  result.writeUInt32LE(rate, 24); result.writeUInt32LE(rate * count * 4, 28);
  result.writeUInt16LE(count * 4, 32); result.writeUInt16LE(32, 34);
  result.write('data', 36); result.writeUInt32LE(result.length - 44, 40);
  for (let i = 0; i < frames; i++) for (let ch = 0; ch < count; ch++)
    result.writeFloatLE(channels[ch][i], 44 + (i * count + ch) * 4);
  return result;
}
function samples(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let format, data;
  for (let position = 12; position + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(position + 4);
    assert(position + 8 + length <= bytes.length, 'Truncated output chunk');
    const tag = bytes.toString('ascii', position, position + 4);
    if (tag === 'fmt ') format = bytes.subarray(position + 8, position + 8 + length);
    if (tag === 'data') data = bytes.subarray(position + 8, position + 8 + length);
    position += 8 + length + (length & 1);
  }
  assert(format && data);
  assert.equal(format.readUInt16LE(0), 3, 'Float32 output');
  assert.equal(format.readUInt16LE(2), 1, 'Mono output');
  assert.equal(format.readUInt16LE(14), 32);
  const result = new Float32Array(data.length / 4);
  for (let i = 0; i < result.length; ++i) {
    result[i] = data.readFloatLE(i * 4);
    assert(Number.isFinite(result[i]));
  }
  return result;
}
function error(bytes, preset, expected) {
  const converted = convert(bytes, preset);
  assert.equal(converted.code, expected);
  assert.equal(converted.wave.length, 0, 'Failed conversion must not expose partial output');
}
const tone = Float32Array.from({ length: 24000 }, (_, i) => 0.12 * Math.sin(2 * Math.PI * 220 * i / 48000));
const input = wav([tone]);
const outputs = [0, 1, 2, 3].map(preset => {
  const output = convert(input, preset);
  assert.equal(output.code, 0);
  assert.equal(output.frames, 48000);
  assert.equal(samples(output.wave).length, output.frames);
  assert(output.peak > 0.001 && output.peak < 10);
  return output.wave;
});
for (let preset = 3; preset >= 0; --preset)
  assert.deepEqual(convert(input, preset).wave, outputs[preset], 'Fresh instances must repeat after other presets');
const left = Float32Array.from(tone, x => x * 0.75), right = Float32Array.from(tone, x => x * 0.25);
assert.deepEqual(convert(wav([left, right]), 0).wave, convert(wav([Float32Array.from(tone, x => x * 0.5)]), 0).wave);
assert.equal(convert(wav([tone, Float32Array.from(tone, x => -x)]), 0).peak, 0, 'Opposite stereo channels average to silence');
error(Buffer.from('invalid file'), 0, 1);
error(input, 4, 1);
error(wav([tone], 22050), 0, 2);
error(wav([tone, tone, tone]), 0, 2);
error(wav([Float32Array.of(NaN)]), 0, 4);
error(input.subarray(0, 20), 0, 1);
console.log('PASS: four presets, repeated instances, stereo averaging, silence, invalid inputs, float32 WAV.');
