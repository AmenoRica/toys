/* Original implementation. No skribbl.io source code or assets are included. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d', {willReadFrequently: true});
  const W = canvas.width, H = canvas.height, HISTORY_LIMIT = 30;
  const palette = [
    ['흰색','#ffffff'],['밝은 회색','#c8c8c8'],['빨강','#ef3939'],['주황','#f99b32'],['노랑','#ffe34c'],['연두','#91ce47'],['초록','#39ae67'],['하늘','#51cde0'],['파랑','#448bde'],['보라','#885cce'],['분홍','#ed8cbb'],['살구','#f5c5a2'],['갈색','#aa7554'],
    ['검정','#202426'],['회색','#727a7d'],['진한 빨강','#a62336'],['진한 주황','#be6324'],['황토','#b49b27'],['올리브','#617a2d'],['진한 초록','#21794c'],['청록','#227a88'],['남색','#2b477e'],['진한 보라','#533476'],['자주','#a94375'],['황갈색','#cf9b72'],['진한 갈색','#624634']
  ];
  const defaults = {brush:'b',eraser:'e',fill:'f',undo:'u',redo:'r',clear:'c',swap:'s'};
  const labels = {brush:'브러시',eraser:'지우개',fill:'채우기',undo:'실행 취소',redo:'다시 실행',clear:'비우기',swap:'색 교환'};
  let keys = {...defaults}, tool = 'brush', size = 12, colors = ['#202426','#ffffff'], slot = 0;
  let stroke = null, states = [], position = -1, dirty = false;
  try {
    const saved = JSON.parse(localStorage.getItem('local-sketch-settings') || 'null');
    if (saved && saved.keys && Object.keys(defaults).every(k => /^[a-z0-9]$/.test(saved.keys[k])) && new Set(Object.values(saved.keys)).size === 7) keys = {...saved.keys};
    if (saved && typeof saved.pressure === 'boolean') $('pressure').checked = saved.pressure;
  } catch (_) { /* Private/file browsing may deny storage. Drawing still works. */ }
  const announce = text => { $('status').textContent = text; };
  function saveSettings() {
    try {localStorage.setItem('local-sketch-settings', JSON.stringify({keys,pressure:$('pressure').checked}));} catch (_) { /* Optional persistence. */ }
  }
  function blank() {ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);}
  function updateHistory() {$('undo').disabled = position <= 0; $('redo').disabled = position >= states.length - 1;}
  function commit() {
    const next = ctx.getImageData(0,0,W,H);
    const previous = states[position];
    if (previous && next.data.every((v,i) => v === previous.data[i])) return false;
    states.splice(position + 1); states.push(next);
    if (states.length > HISTORY_LIMIT + 1) states.shift();
    position = states.length - 1; dirty = true; updateHistory(); return true;
  }
  function undo() {
    if (stroke || position <= 0) return;
    ctx.putImageData(states[--position],0,0); dirty = true; updateHistory(); announce('실행 취소했어요.');
  }
  function redo() {
    if (stroke || position >= states.length - 1) return;
    ctx.putImageData(states[++position],0,0); dirty = true; updateHistory(); announce('다시 실행했어요.');
  }
  function clear() {if (stroke) return; blank(); if (commit()) announce('종이를 비웠어요. 실행 취소로 되돌릴 수 있어요.');}
  function setTool(value) {
    if (stroke) return;
    tool = value;
    document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === value)));
    $('cursor').style.display = 'none'; announce(labels[value] + ' 도구를 선택했어요.');
  }
  function updateColors() {
    ['primary-color','secondary-color'].forEach((id,i) => {
      $(id).querySelector('.color-preview').style.background = colors[i];
      $(id).setAttribute('aria-pressed',String(slot === i));
      $(id).title = (i ? '오른쪽' : '왼쪽') + ' 색 ' + colors[i];
    });
    document.querySelectorAll('.swatch').forEach(b => {
      b.dataset.marker = colors[0] === b.dataset.color ? (colors[1] === b.dataset.color ? 'L·R' : 'L') : colors[1] === b.dataset.color ? 'R' : '';
    });
  }
  function chooseColor(color, index) {colors[index] = color; updateColors(); announce((index ? '오른쪽' : '왼쪽') + ' 색을 선택했어요.');}
  function swap() {if (stroke) return; colors.reverse(); updateColors(); announce('왼쪽과 오른쪽 색을 바꿨어요.');}
  function setSize(value) {
    size = Math.max(1,Math.min(64,Number(value))); $('size').value = size; $('size-value').textContent = size + ' px';
    document.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed',String(Number(b.dataset.size) === size)));
  }
  palette.forEach(([name,color]) => {
    const b = document.createElement('button'); b.className = 'swatch'; b.dataset.color = color;
    b.style.background = color; b.style.setProperty('--color',color);
    const rgb = color.match(/[a-f0-9]{2}/gi).map(v => parseInt(v,16));
    b.style.setProperty('--label-color',rgb[0]*.299+rgb[1]*.587+rgb[2]*.114 > 150 ? '#202426' : '#ffffff');
    b.setAttribute('aria-label',name); b.title = name + ' · 좌클릭: 왼쪽 색 / 우클릭: 오른쪽 색';
    b.addEventListener('click',() => chooseColor(color,slot));
    b.addEventListener('pointerdown',e => {
      if (e.pointerType === 'mouse' && e.button === 0) slot = 0;
      if (e.button === 2) {e.preventDefault(); chooseColor(color,1);}
    });
    b.addEventListener('contextmenu',e => e.preventDefault()); $('palette').append(b);
  });
  [4,12,24,40].forEach(value => {
    const b = document.createElement('button'); b.dataset.size = value; b.title = value + ' px'; b.setAttribute('aria-label',value + ' px');
    const dot = document.createElement('i'); dot.style.width = dot.style.height = Math.max(4,value/2) + 'px'; b.append(dot);
    b.addEventListener('click',() => setSize(value)); $('sizes').append(b);
  });
  $('primary-color').onclick = () => {slot = 0; updateColors();};
  $('secondary-color').onclick = () => {slot = 1; updateColors();};
  $('swap').onclick = swap;
  $('size').oninput = e => setSize(e.target.value);
  $('pressure').onchange = saveSettings;
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('undo').onclick = undo; $('redo').onclick = redo; $('clear').onclick = clear;

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*W/r.width, y:(e.clientY-r.top)*H/r.height};
  }
  function width(e) {
    const base = stroke ? stroke.size : size;
    // Mouse pressure is a synthetic 0.5. Do not halve mouse strokes.
    const enabled = stroke ? stroke.pressure : $('pressure').checked;
    return enabled && e.pointerType !== 'mouse' && e.pressure > 0 ? base * (.15 + .85*Math.min(1,e.pressure)) : base;
  }
  function dot(p,d,color) {
    // Rasterize an opaque disk in whole pixels. Canvas arcs introduce AA edge colors.
    const diameter=Math.max(1,Math.round(d)), radius=diameter/2;
    const cx=Math.floor(p.x)+(diameter%2 ? .5 : 0), cy=Math.floor(p.y)+(diameter%2 ? .5 : 0);
    ctx.fillStyle=color;
    const top=Math.max(0,Math.ceil(cy-radius-.5)), bottom=Math.min(H-1,Math.floor(cy+radius-.5));
    for(let y=top;y<=bottom;y++) {
      const dy=y+.5-cy, span=Math.sqrt(Math.max(0,radius*radius-dy*dy));
      const left=Math.max(0,Math.ceil(cx-span-.5)), right=Math.min(W-1,Math.floor(cx+span-.5));
      if(right>=left) ctx.fillRect(left,y,right-left+1,1);
    }
  }
  function segment(from,to,d0,d1,color) {
    const distance = Math.hypot(to.x-from.x,to.y-from.y);
    const steps = Math.max(1,Math.ceil(distance/Math.max(.5,Math.min(d0,d1)/4)));
    for (let i=1;i<=steps;i++) {const t=i/steps; dot({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},d0+(d1-d0)*t,color);}
  }
  function fill(p,color) {
    const x=Math.floor(p.x), y=Math.floor(p.y); if(x<0 || x>=W || y<0 || y>=H) return;
    const image=ctx.getImageData(0,0,W,H), data=image.data, seed=y*W+x, start=seed*4;
    const target=Array.from(data.slice(start,start+3));
    const replacement=color.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16));
    if(target.every((v,i)=>v===replacement[i])) return;
    // Iterative flood fill: bounded memory and no recursion overflow on empty paper.
    const queue=new Int32Array(W*H), visited=new Uint8Array(W*H); let head=0,tail=1;
    queue[0]=seed; visited[seed]=1;
    const matches=n => target.every((v,i)=>data[n*4+i]===v);
    function enqueue(n) {if (!visited[n]) {visited[n]=1;if(matches(n)) queue[tail++]=n;}}
    while(head<tail) {
      const n=queue[head++], i=n*4, col=n%W;
      data[i]=replacement[0];data[i+1]=replacement[1];data[i+2]=replacement[2];data[i+3]=255;
      if(col>0) enqueue(n-1); if(col<W-1) enqueue(n+1); if(n>=W) enqueue(n-W); if(n<W*(H-1)) enqueue(n+W);
    }
    ctx.putImageData(image,0,0);
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(stroke || !e.isPrimary || (e.button!==0 && e.button!==2)) return;
    e.preventDefault(); canvas.focus({preventScroll:true});
    const p=point(e), color=tool==='eraser' ? '#ffffff' : colors[e.button===2 ? 1 : 0];
    if(tool==='fill') {fill(p,color); if(commit()) announce('영역을 채웠어요.');return;}
    stroke={id:e.pointerId,last:p,width:width(e),color,size,pressure:$('pressure').checked};
    canvas.setPointerCapture(e.pointerId); dot(p,stroke.width,color);
  });
  function showCursor(e) {
    if(e.pointerType==='touch' || tool==='fill') {$('cursor').style.display='none';return;}
    const r=canvas.getBoundingClientRect(), d=size*r.width/W;
    Object.assign($('cursor').style,{display:'block',left:(e.clientX-r.left)+'px',top:(e.clientY-r.top)+'px',width:d+'px',height:d+'px'});
  }
  function move(e) {
    showCursor(e);
    if(!stroke || e.pointerId!==stroke.id) return;
    const events=e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for(const sample of events.length ? events : [e]) {
      const p=point(sample), d=width(sample); segment(stroke.last,p,stroke.width,d,stroke.color); stroke.last=p;stroke.width=d;
    }
  }
  function finish(e,cancel=false) {
    if(!stroke || (e && e.pointerId!==stroke.id)) return;
    if(e && !cancel && (e.clientX!==undefined)) {
      // pointerup has pressure 0; retain the last nonzero width for the endpoint.
      const p=point(e);segment(stroke.last,p,stroke.width,stroke.width,stroke.color);
    }
    const id=stroke.id; stroke=null;
    if(canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    if(cancel) {ctx.putImageData(states[position],0,0);announce('중단된 획을 취소했어요.');}
    else if(commit()) announce('획을 그렸어요.');
  }
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',e=>finish(e));
  canvas.addEventListener('pointercancel',e=>finish(e,true));
  canvas.addEventListener('lostpointercapture',e=>finish(e,true));
  canvas.addEventListener('pointerleave',()=>{$('cursor').style.display='none';});
  window.addEventListener('blur',()=>finish(null));
  document.addEventListener('visibilitychange',()=>{if(document.hidden) finish(null);});

  function savePNG() {
    if(stroke) finish(null);
    canvas.toBlob(blob=>{
      if(!blob) {announce('PNG를 만들지 못했어요. 다시 시도해 주세요.');return;}
      const a=document.createElement('a'), url=URL.createObjectURL(blob);
      a.href=url; a.download='local-sketch-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      dirty=false;announce('PNG 다운로드를 요청했어요.');
    },'image/png');
  }
  $('save').onclick=savePNG;
  const actions={brush:()=>setTool('brush'),eraser:()=>setTool('eraser'),fill:()=>setTool('fill'),undo,redo,clear,swap};
  function renderKeys() {
    $('hotkeys').replaceChildren();
    for(const [action,label] of Object.entries(labels)) {
      const field=document.createElement('label');field.textContent=label;
      const input=document.createElement('input');input.value=keys[action];input.maxLength=1;input.setAttribute('aria-label',label+' 단축키');input.autocomplete='off';input.spellcheck=false;
      input.addEventListener('change',()=>{
        const key=input.value.toLowerCase();
        if(!/^[a-z0-9]$/.test(key) || Object.entries(keys).some(([a,k])=>a!==action && k===key)) {
          $('key-error').textContent='중복되지 않는 영문자 또는 숫자 한 글자를 입력하세요.';input.value=keys[action];return;
        }
        keys[action]=key;input.value=key;$('key-error').textContent='저장했어요.';saveSettings();updateKeyLabels();
      });field.append(input);$('hotkeys').append(field);
    }
    updateKeyLabels();
  }
  function updateKeyLabels() {
    document.querySelectorAll('[data-tool]').forEach(b=>{b.querySelector('kbd').textContent=keys[b.dataset.tool].toUpperCase();});
    $('clear').querySelector('kbd').textContent=keys.clear.toUpperCase();
    $('undo').title='실행 취소 ('+keys.undo.toUpperCase()+' / Ctrl·⌘ Z)';
    $('redo').title='다시 실행 ('+keys.redo.toUpperCase()+' / Ctrl·⌘ Shift Z)';
    $('swap').title='색 교환 ('+keys.swap.toUpperCase()+')';
  }
  $('settings-open').onclick=()=>{if(stroke)return;renderKeys();$('key-error').textContent='';$('settings').showModal();};
  $('settings-close').onclick=()=>$('settings').close();
  $('keys-reset').onclick=()=>{keys={...defaults};saveSettings();renderKeys();$('key-error').textContent='기본 단축키로 되돌렸어요.';};
  document.addEventListener('keydown',e=>{
    if(e.isComposing || e.repeat || e.altKey || $('settings').open || e.target.matches('input,textarea,select,[contenteditable=true]')) return;
    const key=e.key.toLowerCase();
    if(e.ctrlKey || e.metaKey) {
      if(key==='s') {e.preventDefault();savePNG();}
      if(key==='z') {e.preventDefault();e.shiftKey ? redo() : undo();}
      if(key==='y' && e.ctrlKey) {e.preventDefault();redo();}
      return;
    }
    if(stroke) return;
    if(key==='[' || key===']') {e.preventDefault();setSize(size+(key==='['?-1:1));return;}
    const action=Object.keys(keys).find(a=>keys[a]===key);
    if(action) {e.preventDefault();actions[action]();}
  });
  window.addEventListener('beforeunload',e=>{if(dirty) {e.preventDefault();e.returnValue='';}});
  blank();commit();dirty=false;updateColors();setSize(size);renderKeys();
})();
