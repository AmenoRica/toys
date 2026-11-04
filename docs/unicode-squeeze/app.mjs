const input = document.querySelector('#input');
const output = document.querySelector('#output');
const inputHighlight = document.querySelector('#input-highlight');
const ignoreCase = document.querySelector('#ignore-case');
const random = document.querySelector('#random');
const chaos = document.querySelector('#chaos');
const chaosHint = document.querySelector('#chaos-hint');
let visualRules;
const shuffle = document.querySelector('#shuffle');
let rules;
let worker;

function highlight(element, text, changes, side) {
  const fragment = document.createDocumentFragment();
  let offset = 0;
  for (const change of changes) {
    const start = change[side + 'Start'];
    const end = change[side + 'End'];
    fragment.append(text.slice(offset, start));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, end);
    fragment.append(mark);
    offset = end;
  }
  fragment.append(text.slice(offset));
  element.replaceChildren(fragment);
}
function syncScroll() {
  inputHighlight.scrollTop = input.scrollTop;
  inputHighlight.scrollLeft = input.scrollLeft;
}
input.addEventListener('scroll', syncScroll);
output.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(output);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
});

function update() {
  shuffle.disabled = !random.checked || !rules;
  chaosHint.hidden = !chaos.checked && chaosHint.dataset.error !== 'true';
  worker?.terminate(); // Discard stale work immediately when input/options change.
  inputHighlight.textContent = input.value;
  syncScroll();
  if (!rules) return;
  output.textContent = '';
  output.dataset.placeholder = '변환 결과';
  if (!input.value) { output.removeAttribute('aria-busy'); return; }
  output.dataset.placeholder = '변환 중…';
  output.setAttribute('aria-busy', 'true');
  worker = new Worker('./worker.mjs?v=4', { type: 'module' });
  worker.onmessage = ({ data }) => {
    output.removeAttribute('aria-busy');
    if (data.result) {
      highlight(inputHighlight, input.value, data.result.changes, 'input');
      highlight(output, data.result.text, data.result.changes, 'output');
      syncScroll();
    }
    output.dataset.placeholder = data.error ? '변환 오류: ' + data.error : '변환 결과';
    worker.terminate();
  };
  worker.onerror = () => {
    output.removeAttribute('aria-busy');
    output.dataset.placeholder = '변환을 실행할 수 없습니다. 새로고침해 주세요.';
    worker.terminate();
  };
  worker.postMessage({ text: input.value, rules: chaos.checked && visualRules ? [...rules, ...visualRules] : rules, ignoreCase: ignoreCase.checked, random: random.checked });
}
input.addEventListener('input', update);
ignoreCase.addEventListener('change', update);
random.addEventListener('change', update);
chaos.addEventListener('change', update);
shuffle.addEventListener('click', update);
try {
  const response = await fetch('./rules.json?v=4');
  if (!response.ok) throw new Error('HTTP ' + response.status);
  rules = (await response.json()).rules;
  output.dataset.placeholder = '변환 결과';
  update();
} catch {
  output.dataset.placeholder = '규칙을 불러오지 못했습니다. 로컬 서버로 실행해 주세요.';
}

try {
  const response = await fetch('./visual-rules.json?v=4');
  if (!response.ok) throw new Error('HTTP ' + response.status);
  visualRules = (await response.json()).rules;
  chaos.disabled = false;
} catch {
  chaosHint.dataset.error = 'true';
  chaosHint.hidden = false;
  chaosHint.textContent = '카오스 모드 후보를 불러오지 못했습니다. 새로고침해 주세요.';
}
