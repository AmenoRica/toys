// SPDX-License-Identifier: AGPL-3.0-or-later
import { recordedWav, audioFileError, audioInput } from './wav.mjs';
const byId = id => document.getElementById(id);
const file = byId('file'), preset = byId('preset');
const convert = byId('convert'), status = byId('status'), result = byId('result');
const names = ['squid-girl', 'squid-boy', 'octopus-girl', 'octopus-boy'];
let selected, originalUrl, resultUrl, busy = false;
let worker, recording;
const record = byId('record');

function lock(value) {
  busy = value;
  file.disabled = preset.disabled = value;
  convert.disabled = value || !selected;
  record.disabled = value && (!recording?.node || Boolean(recording.stopping));
}
function clearResult() {
  byId('output').pause();
  byId('output').removeAttribute('src');
  byId('output').load();
  result.hidden = true;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = undefined;
}
function selectFile(next, recorded = false) {
  clearResult();
  byId('original').pause();
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  selected = undefined;
  byId('original').hidden = true;
  byId('filename').textContent = '';
  byId('original-download').hidden = true;
  const error = audioFileError(next);
  if (error) {
    status.textContent = error;
    lock(false);
    return;
  }
  selected = next;
  originalUrl = URL.createObjectURL(next);
  byId('filename').textContent = next.name;
  byId('original').src = originalUrl;
  byId('original').hidden = false;
  if (recorded) {
    byId('original-download').href = originalUrl;
    byId('original-download').download = next.name;
    byId('original-download').hidden = false;
  }
  status.textContent = '프리셋을 선택하고 변환하세요.';
  lock(false);
}
file.addEventListener('change', () => selectFile(file.files[0]));
preset.addEventListener('change', () => { clearResult(); status.textContent = selected ? '프리셋을 선택하고 변환하세요.' : '오디오 파일을 선택하세요.'; });
convert.addEventListener('click', convertSelected);
async function convertSelected() {
  if (busy || !selected) return;
  clearResult();
  lock(true);
  status.textContent = '변환 중…';
  const index = Number(preset.value);
  const sourceName = selected.name.replace(/\.[^.]+$/, '');
  try {
    status.textContent = '오디오를 읽는 중…';
    const input = await audioInput(selected);
    status.textContent = '변환 중…';
    if (!worker) worker = new Worker('./worker.mjs', { type: 'module' });
    const response = await new Promise((resolve, reject) => {
      worker.onmessage = event => resolve(event.data);
      worker.onerror = () => {
        worker.terminate(); worker = undefined;
        reject(new Error('변환 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'));
      };
      worker.postMessage({ input, preset: index }, [input]);
    });
    if (response.error) throw new Error(response.error);
    resultUrl = URL.createObjectURL(new Blob([response.output], { type: 'audio/wav' }));
    byId('output').src = resultUrl;
    byId('download').href = resultUrl;
    byId('download').download = `${sourceName}-${names[index]}.wav`;
    byId('result-label').textContent = preset.selectedOptions[0].textContent;
    const peakDb = response.peak ? 20 * Math.log10(response.peak) : -Infinity;
    byId('details').textContent = `${(response.frames / response.rate).toFixed(2)}초 · ${response.rate}Hz · 변환 ${(response.milliseconds / 1000).toFixed(2)}초 · 피크 ${Number.isFinite(peakDb) ? peakDb.toFixed(1) : '−∞'}dBFS`;
    status.textContent = response.peak > 1 ? '완료. 피크가 0dBFS를 넘습니다. 재생 음량을 낮춰 확인하세요.' : '변환 완료.';
    result.hidden = false;
  } catch (error) { status.textContent = error.message; }
  finally { lock(false); }
}

async function releaseRecording(session) {
  session.stream?.getTracks().forEach(track => track.stop());
  session.node?.disconnect();
  session.node?.port.close();
  if (session.context && session.context.state !== 'closed') await session.context.close();
  if (recording === session) recording = undefined;
  record.textContent = '마이크 녹음 시작';
  byId('original').controls = byId('output').controls = true;
}
function stopRecording() {
  if (!recording?.node || Boolean(recording.stopping)) return;
  recording.stopping = true;
  lock(true);
  status.textContent = '녹음을 마무리하는 중…';
  recording.node.port.postMessage('stop');
  recording.stream.getTracks().forEach(track => track.stop());
}
record.addEventListener('click', async () => {
  if (recording?.node) { stopRecording(); return; }
  if (busy) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    status.textContent = '이 브라우저에서는 녹음을 지원하지 않습니다. HTTPS 또는 localhost에서 최신 브라우저를 사용하세요.';
    return;
  }
  const session = { chunks: [], frames: 0 };
  recording = session;
  lock(true);
  byId('original').pause(); byId('output').pause();
  byId('original').controls = byId('output').controls = false;
  byId('record-time').textContent = '';
  status.textContent = '마이크 권한을 기다리는 중…';
  try {
    session.context = new AudioContext({ sampleRate: 48000 });
    await session.context.resume();
    await session.context.audioWorklet.addModule('./capture.mjs');
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
    if (session.cancelled) throw new Error('녹음이 취소되었습니다.');
    session.node = new AudioWorkletNode(session.context, 'mollusk-capture', { outputChannelCount: [1] });
    session.node.port.onmessage = async ({ data }) => {
      if (data.chunk) {
        session.chunks.push(data.chunk);
        session.frames += data.chunk.length;
        byId('record-time').textContent = `${(session.frames / session.context.sampleRate).toFixed(1)} / 250초`;
      }
      if (!data.done) return;
      session.stopping = true;
      lock(true);
      const rate = session.context.sampleRate;
      try {
        await releaseRecording(session);
        const wave = recordedWav(session.chunks, rate);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        selectFile(new File([wave], `recording-${stamp}.wav`, { type: 'audio/wav' }), true);
        await convertSelected();
      } catch (error) { status.textContent = error.message; lock(false); }
    };
    session.node.onprocessorerror = async () => {
      await releaseRecording(session);
      status.textContent = '녹음 처리 중 오류가 발생했습니다. 다시 녹음하세요.';
      lock(false);
    };
    session.stream.getAudioTracks().forEach(track => track.addEventListener('ended', stopRecording));
    session.context.createMediaStreamSource(session.stream).connect(session.node);
    session.node.connect(session.context.destination);
    record.textContent = '녹음 종료 · 변환';
    status.textContent = '녹음 중… 종료 버튼을 누르면 선택한 프리셋으로 변환합니다.';
    lock(true);
  } catch (error) {
    await releaseRecording(session);
    status.textContent = error.name === 'NotAllowedError' ? '마이크 사용이 허용되지 않았습니다. 브라우저의 마이크 권한을 확인하세요.'
      : error.name === 'NotFoundError' ? '사용 가능한 마이크가 없습니다.' : `녹음을 시작하지 못했습니다: ${error.message}`;
    lock(false);
  }
});
window.addEventListener('pagehide', () => {
  if (recording) recording.cancelled = true;
  recording?.stream?.getTracks().forEach(track => track.stop());
  recording?.context?.close();
});
