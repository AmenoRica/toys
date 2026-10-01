// SPDX-License-Identifier: AGPL-3.0-or-later
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(4096);
    this.used = this.frames = 0;
    this.done = false;
    this.port.onmessage = () => this.finish();
  }
  flush() {
    if (!this.used) return;
    const chunk = this.chunk.slice(0, this.used);
    this.port.postMessage({ chunk }, [chunk.buffer]);
    this.used = 0;
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.flush();
    this.port.postMessage({ done: true });
  }
  process(inputs) {
    if (this.done) return false;
    const channels = inputs[0];
    if (!channels.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      this.chunk[this.used++] = channels.length > 1 ? (channels[0][i] + channels[1][i]) / 2 : channels[0][i];
      this.frames++;
      if (this.used === this.chunk.length) this.flush();
      if (this.frames === 12000000) { this.finish(); return false; }
    }
    // Output remains silent: the microphone is never monitored through speakers.
    return true;
  }
}
registerProcessor('mollusk-capture', Capture);
