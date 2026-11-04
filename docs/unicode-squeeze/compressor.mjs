const fold = text => text.replace(/[A-Z]/g, c => c.toLowerCase());

export function createCompressor(rules, ignoreCase = false) {
  const root = { children: new Map(), rules: [] };
  for (const rule of rules) {
    if (rule.source.length < 2 || !/^[\x20-\x7e]+$/.test(rule.source) ||
        Array.from(rule.replacement).length !== 1 || /[\uD800-\uDFFF]/u.test(rule.replacement)) {
      throw new Error('Invalid replacement rule');
    }
    let node = root;
    for (const c of ignoreCase ? fold(rule.source) : rule.source) {
      if (!node.children.has(c)) node.children.set(c, { children: new Map(), rules: [] });
      node = node.children.get(c);
    }
    if (!node.rules.some(r => r.replacement === rule.replacement)) node.rules.push(rule);
    else {
      const previous = node.rules.find(r => r.replacement === rule.replacement);
      if (rank(rule) < rank(previous)) node.rules[node.rules.indexOf(previous)] = rule;
    }
  }
  function rank(rule) { return rule.evidence.some(e => e.kind === 'normalization') ? 0 :
    rule.evidence.some(e => e.kind === 'visual') ? 2 : 1; }
  function compare(a, b) {
    return rank(a) - rank(b) || a.replacement.codePointAt(0) - b.replacement.codePointAt(0);
  }
  return function compress(text, random = false, rng = Math.random) {
    const chars = Array.from(text);
    const match = ignoreCase ? chars.map(fold) : chars;
    const cost = new Uint32Array(chars.length + 1);
    const next = new Uint32Array(chars.length);
    const replacements = new Array(chars.length);
    for (let i = chars.length - 1; i >= 0; i--) {
      cost[i] = 1 + cost[i + 1];
      next[i] = i + 1;
      let chosen = null;
      let ties = 1;
      let node = root;
      for (let j = i; j < chars.length; j++) {
        node = node.children.get(match[j]);
        if (!node) break;
        for (const rule of node.rules) {
          const candidate = 1 + cost[j + 1];
          if (candidate > cost[i]) continue;
          const better = candidate < cost[i];
          ties = better ? 1 : ties + 1;
          const pick = better || (random ? rng() < 1 / ties :
            chosen === null || compare(rule, chosen) < 0 ||
            (compare(rule, chosen) === 0 && j + 1 > next[i]));
          if (pick) {
            cost[i] = candidate;
            next[i] = j + 1;
            chosen = rule;
          }
        }
      }
      replacements[i] = chosen?.replacement ?? chars[i];
    }
    const output = [];
    const changes = [];
    let inputOffset = 0;
    let outputOffset = 0;
    for (let i = 0; i < chars.length; i = next[i]) {
      const consumed = next[i] - i;
      const inputEnd = inputOffset + (consumed === 1 ? chars[i].length : consumed);
      const outputEnd = outputOffset + replacements[i].length;
      if (consumed > 1) {
        const previous = changes.at(-1);
        if (previous?.inputEnd === inputOffset) {
          previous.inputEnd = inputEnd;
          previous.outputEnd = outputEnd;
        } else changes.push({ inputStart: inputOffset, inputEnd, outputStart: outputOffset, outputEnd });
      }
      output.push(replacements[i]);
      inputOffset = inputEnd;
      outputOffset = outputEnd;
    }
    return { text: output.join(''), changes, inputCodepoints: chars.length, outputCodepoints: cost[0] };
  };
}
