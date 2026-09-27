const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const stage = document.querySelector('.paper');
  const paper = document.createElement('canvas');
  const ink = paper.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const color = '#777777';
  let width, height, ratio, frame = 0;
  let shots = [];
  let drips = [];
  let revealImage = null;
  const random = (min, max) => min + Math.random() * (max - min);

  for (const kind of ['background', 'reveal']) {
    const input = document.querySelector('#' + kind + '-file');
    let version = 0;
    document.querySelector('#choose-' + kind).addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const selected = ++version;
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      const status = document.querySelector('#image-status');
      try {
        await image.decode();
        if (selected !== version) return;
        if (kind === 'background') {
          const background = document.querySelector('#background');
          const previous = background.getAttribute('src');
          background.src = url;
          if (previous) URL.revokeObjectURL(previous);
        } else {
          if (revealImage) URL.revokeObjectURL(revealImage.src);
          revealImage = image;
        }
        status.textContent = '';
        document.querySelector('#choose-' + kind).title = file.name;
        render(performance.now());
      } catch {
        if (selected === version) status.textContent = '이미지를 불러오지 못했습니다. PNG·JPEG·WebP 등의 이미지로 다시 선택해 주세요.';
      } finally {
        if (selected !== version || (kind === 'background' ? document.querySelector('#background').src !== url : revealImage !== image)) URL.revokeObjectURL(url);
        if (selected === version) input.value = '';
      }
    });
  }

  function resize() {
    const copy = document.createElement('canvas');
    copy.width = paper.width; copy.height = paper.height;
    copy.getContext('2d').drawImage(paper, 0, 0);
    const oldRatio = ratio || 1;
    width = stage.clientWidth; height = stage.clientHeight; ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = paper.width = Math.round(width * ratio);
    canvas.height = paper.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (copy.width && copy.height) ink.drawImage(copy, 0, 0, copy.width / oldRatio, copy.height / oldRatio);
    render(performance.now());
  }

  function makeSplat(x, y) {
    const radius = random(64, 82);
    const points = [];
    const count = 120;
    const phase = random(0, Math.PI * 2);
    const edge = a => radius * (1 + .07 * Math.sin(a * 3 + phase) + .045 * Math.cos(a * 5 - phase));
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      points.push([Math.cos(a) * edge(a), Math.sin(a) * edge(a)]);
    }
    const path = new Path2D();
    const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    path.moveTo(...midpoint(points[count - 1], points[0]));
    points.forEach((p, i) => path.quadraticCurveTo(...p, ...midpoint(p, points[(i + 1) % count])));
    path.closePath();
    // Broad body with short, round-ended fingers, drawn from independent curves.
    const fingers = 13;
    for (let i = 0; i < fingers; i++) {
      if (Math.random() < .12) continue;
      const a = phase + i / fingers * Math.PI * 2 + random(-.08, .08);
      const base = edge(a) - 5;
      const length = radius * random(.14, .45);
      const bulb = random(6, 12);
      const neck = bulb * random(.4, .65);
      const root = random(12, 18);
      const tip = base + length;
      const p = (r, side) => [Math.cos(a) * r - Math.sin(a) * side, Math.sin(a) * r + Math.cos(a) * side];
      path.moveTo(...p(base - 10, -root));
      path.bezierCurveTo(...p(base + 5, -root), ...p(tip - bulb * 1.4, -neck), ...p(tip - bulb * .4, -bulb * .85));
      path.bezierCurveTo(...p(tip + bulb * .65, -bulb * 1.3), ...p(tip + bulb * 1.2, -bulb * .55), ...p(tip + bulb, 0));
      path.bezierCurveTo(...p(tip + bulb * .9, bulb), ...p(tip, bulb * 1.3), ...p(tip - bulb * .5, bulb * .8));
      path.bezierCurveTo(...p(tip - bulb * 1.5, neck), ...p(base + 4, root), ...p(base - 10, root));
      path.closePath();
    }
    const drops = Array.from({length: 7}, (_, i) => {
      const angle = phase + (i + .5) / 7 * Math.PI * 2 + random(-.12, .12);
      const distance = edge(angle) + random(15, 31);
      return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance,
        r: random(2.5, 6.5), stretch: random(1, 1.35), angle };
    });
    const trails = Array.from({length: Math.floor(random(1, 4))}, (_, i) => ({
      x: x + (i - 1) * radius * .28 + random(-4, 4), y: y + radius * .35,
      length: random(65, 130), r: random(6, 13), duration: random(1800, 3000), delay: random(100, 400)
    }));
    return { x, y, path, drops, trails, fromX: Math.max(0, Math.min(width, x + random(-width * .35, width * .35))),
      fromY: height + 65, start: performance.now() };
  }

  function paint(context, shot) {
    context.save();
    context.translate(shot.x, shot.y);
    context.scale(.75, .75);
    context.fillStyle = color;
    context.fill(shot.path);
    for (const drop of shot.drops) {
      context.beginPath();
      context.ellipse(drop.x, drop.y, drop.r * drop.stretch, drop.r, drop.angle, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function paintDrip(context, drip, progress) {
    const end = drip.y + drip.length * (1 - Math.pow(1 - progress, 2));
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(drip.x - drip.r, drip.y);
    context.bezierCurveTo(drip.x - drip.r, drip.y + 12, drip.x - drip.r * .7, end - 8, drip.x - drip.r * .75, end);
    context.lineTo(drip.x + drip.r * .75, end);
    context.bezierCurveTo(drip.x + drip.r * .7, end - 8, drip.x + drip.r, drip.y + 12, drip.x + drip.r, drip.y);
    context.closePath(); context.fill();
    context.beginPath();
    context.ellipse(drip.x, end, drip.r, drip.r * 1.4, 0, 0, Math.PI * 2);
    context.fill();
  }

  function render(now) {
    cancelAnimationFrame(frame); frame = 0;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(paper, 0, 0, width, height);
    drips = drips.filter(drip => {
      const progress = Math.min(1, Math.max(0, (now - drip.start - drip.delay) / drip.duration));
      if (progress > 0) paintDrip(ctx, drip, progress);
      if (progress === 1) paintDrip(ink, drip, 1);
      return progress < 1;
    });
    shots = shots.filter(shot => {
      const elapsed = now - shot.start;
      if (elapsed < 500) {
        return true;
      }
      // The full stain appears on contact and remains still.
      paint(ctx, shot);
      paint(ink, shot);
      drips.push(...shot.trails.map(drip => ({...drip, start: now})));
      return false;
    });
    if (revealImage) {
      const scale = Math.max(width / revealImage.naturalWidth, height / revealImage.naturalHeight);
      const w = revealImage.naturalWidth * scale, h = revealImage.naturalHeight * scale;
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(revealImage, (width - w) / 2, (height - h) / 2, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Flying ink stays gray; only settled ink and flowing trails reveal the image.
    for (const shot of shots) {
      const t = Math.max(0, (now - shot.start) / 500);
      ctx.fillStyle = color;
      for (let i = 8; i >= 0; i--) {
        const behind = Math.max(0, t - i * .009);
        const travel = 1 - Math.pow(1 - behind, 3);
        const x = shot.fromX + (shot.x - shot.fromX) * travel;
        const y = shot.fromY + (shot.y - shot.fromY) * travel;
        const radius = (52 - 42 * t) * (1 - i / 10);
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (shots.length || drips.length) frame = requestAnimationFrame(render);
  }

  function shoot(x, y) {
    const shot = makeSplat(x, y);
    if (reducedMotion.matches) {
      paint(ink, shot);
      shot.trails.forEach(drip => paintDrip(ink, drip, 1));
    }
    else shots.push(shot);
    if (!frame) render(performance.now());
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    shoot(event.clientX - bounds.left, event.clientY - bounds.top);
  });
  canvas.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault(); shoot(width / 2, height / 2);
    }
  });
  document.querySelector('#reset').addEventListener('click', () => {
    shots = []; drips = []; ink.clearRect(0, 0, width, height); render(performance.now());
  });
  const help = document.querySelector('#help');
  document.querySelector('#help-open').addEventListener('click', () => help.showModal());
  document.querySelector('#help-close').addEventListener('click', () => help.close());
  new ResizeObserver(resize).observe(stage);
  resize();
