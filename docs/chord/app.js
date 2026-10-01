import {ROOTS,CHORDS,midiName,alternateName,isBlack,spellChord,grade} from './music.js';
const $=id=>document.getElementById(id);
let state={root:0,chord:CHORDS.find(c=>c.id==='maj7'),mode:'sevenths',selected:new Set([0]),stage:'editing',counted:false,attempts:0,correct:0,streak:0,number:1,result:null};
let context=null,master=null,voices=[],playTimer=null,playGeneration=0;
const rootMidi=()=>48+state.root;
function setFeedback(kind,title,description){$('feedback').className='feedback '+kind;$('feedback').innerHTML=`<span class="feedback-icon">${kind==='success'?'✓':kind==='error'?'!':'i'}</span><div><strong>${title}</strong><p>${description}</p></div>`;}
function renderRows(){
 const focus=document.activeElement?.dataset?.offset;
 $('noteRows').innerHTML=Array.from({length:13},(_,i)=>12-i).map(offset=>{
 const midi=rootMidi()+offset,selected=state.selected.has(offset),root=offset===0;
 const extra=state.result?.extra.includes(offset),missing=state.result?.missing.includes(offset);
 const correct=selected&&!root&&state.stage!=='editing'&&!extra;
 const name=midiName(midi),alt=alternateName(midi);
 return `<button class="note-row ${isBlack(midi)?'black':''} ${root?'root-note':''} ${extra?'incorrect':''} ${missing?'missing':''} ${correct?'correct':''}" data-offset="${offset}" aria-label="${name}${alt?' 또는 '+alt+(Math.floor(midi/12)-1):''}${root?' 근음 듣기':selected?' 삭제':' 추가'}" aria-pressed="${selected}"><span class="key">${name}${alt?`<small>${alt}</small>`:''}</span><span class="grid-lane"><span class="beat-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${selected?`<span class="midi-note">${root?ROOTS[state.root].name+(Math.floor(midi/12)-1):name}${root?'<span>근음</span>':''}</span>`:''}</span></button>`;
 }).join('');
 if(focus!==undefined)document.querySelector(`[data-offset="${focus}"]`)?.focus({preventScroll:true});
 $('noteCount').textContent=`${state.selected.size} / ${state.chord.intervals.length}음`;
 $('selectedSummary').textContent=[...state.selected].sort((a,b)=>a-b).map(o=>midiName(rootMidi()+o)).join(' · ');
 $('check').disabled=state.stage==='success'||state.stage==='revealed';
 $('reveal').disabled=state.stage==='success'||state.stage==='revealed';
}
function renderPrompt(){
 $('rootName').textContent=ROOTS[state.root].name;
 $('chordSymbol').textContent=state.chord.symbol;
 $('chordName').textContent=state.chord.name;
 $('questionNumber').textContent=String(state.number).padStart(2,'0');
 $('rootListenLabel').textContent=`근음 ${ROOTS[state.root].name}3 듣기`;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
 $('rangeInfo').textContent=state.mode==='triads'?'메이저 · 마이너 · dim · aug · sus2 · sus4':state.mode==='sevenths'?'maj7 · m7 · 7 · m7♭5 · dim7':'3화음과 7화음을 함께 연습';
 renderStats();renderRows();
}
function renderStats(){ $('correctCount').textContent=state.correct;$('attemptCount').textContent=state.attempts;$('streakCount').innerHTML=`${state.streak}<small>회</small>`; }
async function audio(){
 try{
 if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('unsupported');context=new Audio();master=context.createGain();master.gain.value=Number($('volume').value)/100*.45;master.connect(context.destination);}
 if(context.state!=='running')await context.resume();
 return context.state==='running';
 }catch{setFeedback('error','소리를 켤 수 없어요','이 브라우저의 오디오 설정을 확인해주세요. 음 선택과 채점은 계속할 수 있어요.');return false;}
}
function stop(){ playGeneration++;voices.forEach(v=>{try{v.stop();}catch{}});voices=[];clearTimeout(playTimer);$('playhead').hidden=true;$('audioState').textContent='SYNTH';$('audioState').classList.remove('playing');$('play').setAttribute('aria-label','선택한 화음 듣기');}
async function play(offsets,full=false){
 stop();const generation=playGeneration;if(!await audio()||generation!==playGeneration)return;
 const t=context.currentTime,duration=full?1.45:.6;
 const voiceGain=.2/Math.sqrt(Math.max(1,offsets.length));
 offsets.forEach(offset=>{
 const freq=440*Math.pow(2,(rootMidi()+offset-69)/12);
 const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(3000,t);filter.frequency.exponentialRampToValueAtTime(900,t+duration);
 const gain=context.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(voiceGain,t+.012);gain.gain.exponentialRampToValueAtTime(Math.max(.001,voiceGain*.52),t+.2);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
 filter.connect(gain);gain.connect(master);
 for(const detune of [-3,3]){const osc=context.createOscillator();osc.type='triangle';osc.frequency.value=freq;osc.detune.value=detune;osc.connect(filter);osc.start(t);osc.stop(t+duration+.04);voices.push(osc);}
 });
 $('audioState').textContent='PLAYING';$('audioState').classList.add('playing');
 if(full){const head=$('playhead');head.hidden=true;void head.offsetWidth;head.hidden=false;}
 playTimer=setTimeout(stop,(duration+.08)*1000);
}
function initialFeedback(){setFeedback('','구성음을 선택하세요',`${state.chord.intervals.length-1}개를 더 선택하세요.`);}
function toggleNote(offset,withSound=true){
 if(!Number.isInteger(offset)||offset<0||offset>12)throw new Error('음은 근음 기준 0~12 반음이어야 합니다.');
 if(offset===0){if(withSound)void play([0]);return;}
 if(state.stage==='success'||state.stage==='revealed'){if(withSound)void play([offset]);return;}
 const adding=!state.selected.has(offset);
 adding?state.selected.add(offset):state.selected.delete(offset);
 state.stage='editing';state.result=null;initialFeedback();renderRows();
 if(withSound&&adding)void play([offset]);
}
function check(){
 if(state.stage==='success'||state.stage==='revealed')return snapshot();
 const result=grade([...state.selected],state.chord.intervals);state.result=result;
 const first=!state.counted;
 if(first){state.attempts++;state.counted=true;if(result.correct){state.correct++;state.streak++;}else state.streak=0;}
 const spellings=spellChord(state.root,state.chord);
 if(result.correct){state.stage='success';setFeedback('success',first?'정답이에요. 정확히 쌓았어요!':'화음 완성! 정확하게 수정했어요',`${spellings.join(' · ')}  /  ${state.chord.formula}${first?'':' · 첫 시도 점수는 그대로예요.'}`);}
 else{state.stage='error';const missing=result.missing.map(o=>spellings[state.chord.intervals.indexOf(o)]);const extra=result.extra.map(o=>midiName(rootMidi()+o));const notes=[missing.length?`더 필요한 음: ${missing.join(', ')}`:'',extra.length?`빼야 할 음: ${extra.join(', ')}`:''].filter(Boolean).join(' · ');setFeedback('error','조금만 고쳐볼까요?',notes);}
 renderStats();renderRows();return snapshot();
}
function reset(){stop();state.selected=new Set([0]);state.stage='editing';state.result=null;if(state.counted)setFeedback('','다시 쌓아보세요','첫 시도 점수는 그대로입니다.');else initialFeedback();renderRows();}
function reveal(){
 if(state.stage==='success'||state.stage==='revealed')return;
 if(!state.counted){state.attempts++;state.counted=true;}state.streak=0;
 state.selected=new Set(state.chord.intervals);state.stage='revealed';state.result=grade([...state.selected],state.chord.intervals);
 setFeedback('revealed','정답 화음을 확인해보세요',`${spellChord(state.root,state.chord).join(' · ')}  /  ${state.chord.formula}`);renderStats();renderRows();
}
function next(){
 stop();const pool=CHORDS.filter(c=>state.mode==='all'||c.group===state.mode);
 const fixed=$('rootSelect').value;let root,chord;
 do{root=fixed==='random'?Math.floor(Math.random()*12):Number(fixed);chord=pool[Math.floor(Math.random()*pool.length)];}while(root===state.root&&chord.id===state.chord.id);
 state={...state,root,chord,number:state.number+1,selected:new Set([0]),stage:'editing',counted:false,result:null};renderPrompt();initialFeedback();return snapshot();
}
function snapshot(){return {question:state.number,root:ROOTS[state.root].name,rootMidi:rootMidi(),chord:state.chord.id,chordName:state.chord.name,mode:state.mode,selectedSemitones:[...state.selected].sort((a,b)=>a-b),stage:state.stage,result:state.result,score:{correct:state.correct,attempts:state.attempts,streak:state.streak}};}
$('noteRows').addEventListener('click',e=>{const row=e.target.closest('[data-offset]');if(row)toggleNote(Number(row.dataset.offset));});
$('play').onclick=()=>void play([...state.selected],true);$('stop').onclick=stop;$('playRoot').onclick=()=>void play([0]);
$('volume').oninput=e=>{$('volumeLabel').textContent=e.target.value+'%';if(master&&context)master.gain.setTargetAtTime(Number(e.target.value)/100*.45,context.currentTime,.02);};
$('check').onclick=check;$('reset').onclick=reset;$('reveal').onclick=reveal;$('next').onclick=next;
$('rootSelect').onchange=next;
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{if(state.mode===b.dataset.mode)return;state.mode=b.dataset.mode;next();};
document.addEventListener('keydown',e=>{
 if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.matches('input,select,textarea')||e.target.isContentEditable)return;
 if(e.code==='Space'&&!e.target.closest('button,summary,a')){e.preventDefault();void play([...state.selected],true);}
 if(e.code==='Enter'&&!e.target.closest('button,summary,a')){e.preventDefault();check();}
 if(e.key.toLowerCase()==='n'){e.preventDefault();next();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
renderPrompt();initialFeedback();
const mcp=document.modelContext;
if(mcp?.registerTool){
 const lifecycle=new AbortController();
 const register=tool=>{try{Promise.resolve(mcp.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'get_chord_practice_state',title:'현재 화음 문제 읽기',description:'Read the current root, chord prompt, selected semitones and session score. This does not reveal the answer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>snapshot()});
 register({name:'stage_chord_notes',title:'화음 음 선택',description:'Replace selected notes with semitone offsets above the fixed root in the current exercise, without grading or playing audio. Root 0 is always included.',inputSchema:{type:'object',properties:{semitones:{type:'array',items:{type:'integer',minimum:0,maximum:12},uniqueItems:true,maxItems:13}},required:['semitones'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!Array.isArray(input.semitones)||input.semitones.length>13||input.semitones.some(n=>!Number.isInteger(n)||n<0||n>12)||Object.keys(input).some(k=>k!=='semitones'))throw new Error('semitones must be an array of integers from 0 to 12.');if(['success','revealed'].includes(state.stage))throw new Error('Start the next exercise before staging notes.');state.selected=new Set([0,...input.semitones]);state.stage='editing';state.result=null;renderRows();initialFeedback();return snapshot();}});
 register({name:'check_chord_answer',title:'화음 정답 확인',description:'Grade selected notes and record the first attempt in session score, just like the visible check button.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>check()});
 register({name:'start_next_chord_exercise',title:'다음 화음 시작',description:'Start a new random exercise within the current visible root and chord-range settings. Unchecked exercises are skipped without changing score.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>next()});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
