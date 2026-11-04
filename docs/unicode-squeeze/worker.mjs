import { createCompressor } from './compressor.mjs?v=4';
self.onmessage = ({ data }) => {
  try {
    const result = createCompressor(data.rules, data.ignoreCase)(data.text, data.random);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
