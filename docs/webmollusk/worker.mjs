// SPDX-License-Identifier: AGPL-3.0-or-later
import createMollusk from './mollusk.mjs';

const ready = createMollusk();
const errors = {
  1: '올바른 WAV 파일이 아닙니다.',
  2: '모노·스테레오 WAV, 44.1~192kHz 입력만 지원합니다.',
  3: '파일은 64MiB 이하, 오디오 길이는 1,200만 샘플 이하여야 합니다.',
  4: '오디오를 읽을 수 없거나 유효하지 않은 샘플이 있습니다.',
  5: '유효한 출력 오디오를 만들지 못했습니다.',
};
self.onmessage = async ({ data }) => {
  let pointer = 0;
  let engine;
  try {
    engine = await ready;
    const start = performance.now();
    pointer = engine._malloc(data.input.byteLength);
    if (!pointer) throw new Error('처리할 메모리가 부족합니다.');
    engine.HEAPU8.set(new Uint8Array(data.input), pointer);
    const code = engine._mollusk_convert(pointer, data.input.byteLength, data.preset);
    if (code) throw new Error(errors[code] || '변환에 실패했습니다.');
    const begin = engine._mollusk_output_data();
    const output = engine.HEAPU8.slice(begin, begin + engine._mollusk_output_size()).buffer;
    self.postMessage({ output, milliseconds: performance.now() - start,
      peak: engine._mollusk_output_peak(), rate: engine._mollusk_output_rate(),
      frames: engine._mollusk_output_frames() }, [output]);
  } catch (error) {
    self.postMessage({ error: error.message });
  } finally {
    if (pointer) engine._free(pointer);
  }
};
