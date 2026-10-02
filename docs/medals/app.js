const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const rows = [...document.querySelectorAll('#editor label')];
const save = document.querySelector('#save');
const status = document.querySelector('#status');
const images = {};
let ready = false;
function render() {
  if (!ready) return;
  ctx.fillStyle = '#282b31';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '700 34px Medal';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('획득한 표창', 450, 60);
  const descriptions = ['획득한 표창'];
  rows.forEach((row, i) => {
    const text = row.querySelector('input').value;
    const grade = row.querySelector('select').value;
    if (grade === 'none') return;
    ctx.save();
    ctx.translate(400 + i * 48, 160 + i * 112);
    ctx.rotate(-2.5 * Math.PI / 180);
    ctx.drawImage(images.paper, -275, -68.75, 550, 137.5);
    ctx.save();
    ctx.translate(-205, 4);
    ctx.rotate(5 * Math.PI / 180);
    ctx.drawImage(images[grade], -57.6, -57.6, 115.2, 115.2);
    ctx.restore();
    let size = 32;
    ctx.font = `700 ${size}px Medal`;
    while (ctx.measureText(text).width > 375 && size > 8) ctx.font = `700 ${--size}px Medal`;
    ctx.fillStyle = '#252525';
    ctx.fillText(text, 40, 0, 375);
    ctx.restore();
    descriptions.push(`${grade === 'gold' ? '금' : '은'} 표창: ${text}`);
  });
  canvas.setAttribute('aria-label', descriptions.join(', '));
}
document.querySelector('#editor').addEventListener('input', render);
save.addEventListener('click', () => {
  render();
  canvas.toBlob(blob => {
    if (!blob) { status.textContent = 'PNG 생성에 실패했습니다. 다시 시도해 주세요.'; return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'medals.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');
});
try {
  await Promise.all([
    ...['paper', 'gold', 'silver'].map(async name => {
      const image = new Image(); image.src = `assets/${name}.png`;
      await image.decode(); images[name] = image;
    }),
    document.fonts.load('700 32px Medal', '한글 가나다 ABC No.123 あ')
  ]);
  if (!document.fonts.check('700 32px Medal', '한글 ABC')) throw new Error('Font unavailable');
  ready = true; render(); save.disabled = false;
  status.textContent = '';
} catch (error) {
  status.textContent = '이미지 또는 글꼴을 불러오지 못했습니다. 새로고침해 주세요.';
  console.error(error);
}
