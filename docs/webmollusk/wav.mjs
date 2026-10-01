// SPDX-License-Identifier: AGPL-3.0-or-later
export function recordedWav(chunks, rate) {
  const frames = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!frames || frames > 12000000 || !Number.isInteger(rate) || rate < 44100 || rate > 192000)
    throw new Error('오디오 길이 또는 샘플레이트를 확인하세요.');
  const bytes = new ArrayBuffer(44 + frames * 4), view = new DataView(bytes);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 32, true);
  text(36, 'data'); view.setUint32(40, frames * 4, true);
  let offset = 44;
  for (const chunk of chunks) for (const value of chunk) {
    if (!Number.isFinite(value)) throw new Error('유효하지 않은 오디오 샘플이 있습니다.');
    view.setFloat32(offset, value, true); offset += 4;
  }
  return bytes;
}

export function audioFileError(file) {
  if (!file || !/\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(file.name))
    return 'WAV·MP3·M4A/AAC·FLAC·OGG 파일을 선택하세요.';
  if (file.size < 12 || file.size > 64 * 1024 * 1024)
    return '오디오 파일은 64MiB 이하여야 합니다.';
}

export async function audioInput(file) {
  const error = audioFileError(file);
  if (error) throw new Error(error);
  const bytes = await file.arrayBuffer();
  if (/\.wav$/i.test(file.name)) return bytes;
  let audio;
  try {
    // Browser codecs vary; no decoder library or audio upload is needed.
    audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(bytes);
  } catch {
    throw new Error('이 브라우저에서 파일을 읽을 수 없습니다. 지원하지 않는 코덱이거나 손상된 파일입니다. WAV로 바꾸어 다시 시도하세요.');
  }
  if (audio.numberOfChannels < 1 || audio.numberOfChannels > 2)
    throw new Error('모노 또는 스테레오 오디오만 지원합니다.');
  if (!audio.length || audio.length > 12000000)
    throw new Error('추가 형식의 오디오 길이는 250초 이하여야 합니다.');
  const mono = audio.getChannelData(0);
  if (audio.numberOfChannels === 2) {
    const right = audio.getChannelData(1);
    for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] + right[i]) / 2;
  }
  return recordedWav([mono], audio.sampleRate);
}
