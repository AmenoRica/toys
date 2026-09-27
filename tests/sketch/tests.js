/* Browser-native regression checks; the production app does not load this file. */
document.getElementById('run').onclick = async () => {
  const list=document.getElementById('results'), summary=document.getElementById('summary'), frame=document.getElementById('app');
  list.replaceChildren(); summary.textContent='검증 중'; document.getElementById('run').disabled=true;
  let passed=0, failed=0;
  const check=(name,ok)=>{const li=document.createElement('li');li.className=ok?'pass':'fail';li.textContent=(ok?'PASS · ':'FAIL · ')+name;list.append(li);ok?passed++:failed++;};
  try {
    // Fresh document, with no possibility of touching another tab's artwork.
    await new Promise(resolve=>{frame.onload=resolve;frame.src='../../docs/sketch/index.html?test='+Date.now();});
    const win=frame.contentWindow, doc=win.document, $=id=>doc.getElementById(id), canvas=$('canvas'), ctx=canvas.getContext('2d');
    const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data), rgb=(x,y,v)=>pixel(x,y).join(',')===v.concat(255).join(',');
    const white=(x,y)=>rgb(x,y,[255,255,255]);
    const press=(key,extra={})=>canvas.dispatchEvent(new win.KeyboardEvent('keydown',{key,bubbles:true,...extra}));
    const tool=name=>doc.querySelector('[data-tool="'+name+'"]').click();
    const color=(name,button=0)=>{
      const b=doc.querySelector('.swatch[aria-label="'+name+'"]');
      b.dispatchEvent(new win.PointerEvent('pointerdown',{button,pointerType:'mouse',bubbles:true}));
      if(button===0)b.click();
    };
    const setSize=n=>{$('size').value=n;$('size').dispatchEvent(new win.Event('input'));};
    // Synthetic events have no OS pointer, so only capture calls are stubbed in this test iframe.
    let captured=null;
    canvas.setPointerCapture=id=>{captured=id;};canvas.hasPointerCapture=id=>captured===id;canvas.releasePointerCapture=()=>{captured=null;};
    function pointer(type,x,y,{button=0,pressure=.5,pointerType='mouse',id=1,isPrimary=true}={}) {
      const rect=canvas.getBoundingClientRect();
      canvas.dispatchEvent(new win.PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,isPrimary,pointerType,button,buttons:type==='pointerup'?0:button===2?2:1,pressure:type==='pointerup'?0:pressure,clientX:rect.left+x*rect.width/800,clientY:rect.top+y*rect.height/600}));
    }
    function stroke(points,options={}) {pointer('pointerdown',...points[0],options);points.slice(1).forEach(p=>pointer('pointermove',...p,options));pointer('pointerup',...points.at(-1),options);}
    const reset=()=>{$('clear').click();tool('brush');color('검정');setSize(12);};
    const settingsKey=(action,value)=>{const input=doc.querySelector('input[aria-label="'+action+' 단축키"]');input.value=value;input.dispatchEvent(new win.Event('change'));};
    const originalSettings=win.localStorage.getItem('local-sketch-settings');
    $('settings-open').click();$('keys-reset').click();$('settings-close').click();
    check('초기 800×600 흰 캔버스 및 undo 비활성화',canvas.width===800 && canvas.height===600 && white(50,50) && $('undo').disabled);
    stroke([[50,60],[250,60]]);check('왼쪽 마우스: 연속 검정 브러시',rgb(150,60,[32,36,38]));
    stroke([[350,60],[485,117],[600,70]]);
    const raster=ctx.getImageData(0,0,800,600).data;let clean=true;
    for(let i=0;i<raster.length;i+=4)if(!((raster[i]===255&&raster[i+1]===255&&raster[i+2]===255)||(raster[i]===32&&raster[i+1]===36&&raster[i+2]===38))||raster[i+3]!==255){clean=false;break;}
    check('AA 제거: 대각선·곡선 근처에 중간색/반투명 픽셀 없음',clean);
    color('빨강',2);stroke([[50,100],[250,100]],{button:2});check('오른쪽 팔레트 선택 및 오른쪽 그리기',rgb(150,100,[239,57,57]));
    stroke([[50,140],[250,140]]);check('오른쪽 색 선택 후 왼쪽 색 유지',rgb(150,140,[32,36,38]));
    press('u');check('U undo',white(150,140));press('r');check('R redo',rgb(150,140,[32,36,38]));
    press('z',{ctrlKey:true});check('Ctrl+Z undo',white(150,140));press('z',{metaKey:true,shiftKey:true});check('⌘+Shift+Z redo',rgb(150,140,[32,36,38]));
    press('z',{metaKey:true});press('y',{ctrlKey:true});check('Ctrl+Y redo',rgb(150,140,[32,36,38]));
    tool('eraser');setSize(40);stroke([[150,40],[150,160]]);check('흰 종이 지우개',white(150,60)&&white(150,100));
    $('undo').click();check('지우개 undo 복원',rgb(150,60,[32,36,38])&&rgb(150,100,[239,57,57]));
    $('clear').click();check('clear 흰색',white(60,60));$('undo').click();check('clear undo 복원',rgb(60,60,[32,36,38]));
    $('undo').click();tool('brush');stroke([[350,300],[450,300]]);check('undo 후 새 획은 redo 분기 제거',$('redo').disabled);
    reset();stroke([[200,150],[500,150],[500,450],[200,450],[200,150]]);tool('fill');color('노랑');stroke([[300,300]]);
    check('닫힌 영역 채우기: 안쪽 노랑 / 바깥 흰색 / 경계 유지',rgb(300,300,[255,227,76])&&white(100,100)&&rgb(200,300,[32,36,38]));
    $('undo').click();check('채우기 undo',white(300,300));$('redo').click();check('채우기 redo',rgb(300,300,[255,227,76]));
    color('파랑',2);stroke([[100,100]],{button:2});check('오른쪽 색으로 외부 영역 채우기',rgb(100,100,[68,139,222])&&rgb(300,300,[255,227,76]));
    reset();setSize(40);$('pressure').checked=true;
    stroke([[100,100],[300,100]],{pointerType:'pen',pressure:.2});stroke([[100,200],[300,200]],{pointerType:'pen',pressure:.9});
    const count=(y)=>{let n=0;for(let j=y-35;j<=y+35;j++)if(!white(200,j))n++;return n;};
    const thin=count(100),thick=count(200);check('펜 pressure 0.2 → 0.9: 선 굵기 증가',thin<thick && thick>30);
    $('pressure').checked=false;stroke([[100,300],[300,300]],{pointerType:'pen',pressure:.2});stroke([[100,400],[300,400]],{pointerType:'pen',pressure:.9});check('필압 끄기: 동일한 굵기',count(300)===count(400));
    $('pressure').checked=true;stroke([[400,300],[600,300]],{pointerType:'mouse',pressure:.5});check('마우스는 pressure 0.5여도 설정한 굵기 유지',!white(500,318));
    reset();setSize(1);stroke([[100,50],[200,50]]);check('1 px 브러시가 끊기지 않고 단일 행을 그림',rgb(150,50,[32,36,38])&&white(150,49)&&white(150,51));setSize(12);
    pointer('pointerdown',100,100);pointer('pointermove',200,100);pointer('pointercancel',200,100);check('pointercancel은 진행 중 획만 복원',white(150,100)&&rgb(150,50,[32,36,38]));
    pointer('pointerdown',100,200);pointer('pointermove',200,200);pointer('pointerdown',500,500,{id:2,isPrimary:false});pointer('pointerup',200,200);check('보조 터치 입력 무시',white(500,500)&&rgb(150,200,[32,36,38]));
    stroke([[600,350],[850,350]]);check('캔버스 밖으로 드래그해도 가장자리까지 그림',rgb(799,350,[32,36,38]));
    reset();color('빨강');color('파랑',2);press('s');stroke([[100,100]]);check('S 색 교환',rgb(100,100,[68,139,222]));
    press('e');check('E 지우개 선택',doc.querySelector('[data-tool="eraser"]').getAttribute('aria-pressed')==='true');press('f');check('F 채우기 선택',doc.querySelector('[data-tool="fill"]').getAttribute('aria-pressed')==='true');press('b');check('B 브러시 선택',doc.querySelector('[data-tool="brush"]').getAttribute('aria-pressed')==='true');
    press(']');check('] 브러시 크기 증가',$('size').value==='13');press('[');check('[ 브러시 크기 감소',$('size').value==='12');
    $('settings-open').click();settingsKey('브러시','q');$('settings-close').click();press('e');press('q');check('사용자 지정 단축키 적용',doc.querySelector('[data-tool="brush"]').getAttribute('aria-pressed')==='true');
    $('settings-open').click();settingsKey('지우개','q');check('중복 단축키 차단',$('key-error').textContent.includes('중복'));$('settings-close').click();
    const png=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('PNG timeout')),5000);
      const create=win.URL.createObjectURL.bind(win.URL), click=win.HTMLAnchorElement.prototype.click;
      let result=null;
      win.URL.createObjectURL=blob=>{result=blob;return create(blob);};
      win.HTMLAnchorElement.prototype.click=function(){clearTimeout(timeout);win.URL.createObjectURL=create;win.HTMLAnchorElement.prototype.click=click;resolve({blob:result,name:this.download});};
      $('save').click();
    });
    const bitmap=await createImageBitmap(png.blob);const output=document.createElement('canvas');output.width=800;output.height=600;const out=output.getContext('2d');out.drawImage(bitmap,0,0);
    check('PNG 형식, 800×600 크기, 다운로드 파일명',png.blob.type==='image/png'&&bitmap.width===800&&bitmap.height===600&&png.name.endsWith('.png'));
    const pngPixels=out.getImageData(0,0,800,600).data;check('PNG 배경 및 전체 픽셀 불투명',pngPixels.every((v,i)=>i%4!==3||v===255));check('PNG 그림 내용 보존',out.getImageData(100,100,1,1).data[2]===222);bitmap.close();
    reset();for(let i=0;i<35;i++)stroke([[20+i*20,100]]);for(let i=0;i<35;i++)$('undo').click();check('최근 30작업 제한 및 이전 상태 보존',$('undo').disabled&&rgb(20,100,[32,36,38])&&white(700,100));
    $('settings-open').click();$('keys-reset').click();$('settings-close').click();
    if(originalSettings===null)win.localStorage.removeItem('local-sketch-settings');else win.localStorage.setItem('local-sketch-settings',originalSettings);
  } catch(e) {check('검증 실행 오류: '+e.message,false);}
  summary.textContent=`${passed}개 통과 / ${failed}개 실패`;
  document.getElementById('run').disabled=false;
};
