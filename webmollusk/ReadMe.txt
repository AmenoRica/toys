WebMollusk

Local preview:
  From the repository or extracted source root:
  python3 -m http.server 8767 --bind 127.0.0.1
  Open http://127.0.0.1:8767/docs/webmollusk/ in a browser.
  Do not open index.html as file://; ES modules and WASM need HTTP serving.

Use:
  Choose a WAV, MP3, M4A/AAC, FLAC or OGG file, choose one of the four presets,
  convert, compare the two audio players, and download the WAV result.
  Or choose a preset, press the microphone recording button, allow microphone
  access, speak, and press stop. The recording is converted automatically;
  playback is manual. Both original and converted WAVs can be downloaded.
  Recording uses Web Audio PCM capture at 48 kHz, without compressed codecs.
  It stops automatically at 12,000,000 frames (250 s). HTTPS or localhost and
  microphone permission are required. The microphone is not monitored.
  Audio stays in the browser. There is no upload or conversion server.

Formats and prototype limits:
  WAV: JUCE's RIFF/WAVE reader, 44,100 through 192,000 Hz.
  MP3, M4A/AAC, FLAC, OGG: browser-native decodeAudioData, resampled to 48 kHz.
  Codec/container combinations depend on the browser. Unsupported or damaged
  files show an error; convert those to WAV before importing. No decoder library.
  All input: one or two channels, at most 64 MiB and 12,000,000 decoded frames.
  The extra input formats are limited to 250 seconds at 48 kHz.
  Stereo is averaged as (left + right) / 2 before the mono effect chain.
  Output: mono 32-bit IEEE float WAV at the input processing rate.
  No automatic normalization, limiting or clipping. Peak values above 0 dBFS
  are reported; reduce playback volume for those results.
  The original leading DSP delay is retained and 0.5 s of zero input is flushed
  at the end to preserve the last word. Output duration is input + 0.5 s.
  LFO rates are fixed to the Advanced-mode preset values for reproducibility.
  No live filtered monitoring, desktop routing, custom knobs or XML preset import/export.

Build:
  Install and activate Emscripten 6.0.10 from its official emsdk repository.
  With em++ on PATH: python3 webmollusk/build.py
  Or: CXX=/absolute/path/to/em++ python3 webmollusk/build.py
  This generates docs/webmollusk/mollusk.mjs, mollusk.wasm and source.tar.gz.
  Use --source-only to refresh the source archive after frontend-only edits.
  python3 webmollusk/build.py --native builds a macOS comparison executable with the same DSP.
  The source archive contains the source and JUCE modules needed to rebuild.

Checks:
  node webmollusk/tests/check.mjs
  node webmollusk/tests/capture-check.mjs
  Open webmollusk/tests/capture.html on the local server for a microphone-free browser
  check of AudioWorklet capture -> WAV -> WASM -> manual playback.

Licensing and credits: docs/webmollusk/LICENSE, docs/webmollusk/NOTICE.txt,
webmollusk/vendor/JUCE/LICENSE.md. AGPL applies to WebMollusk and its included DSP;
this addition does not change the licensing of the other Toys.
