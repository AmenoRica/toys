export const ROOTS = [
 {name:'C',letter:0},{name:'D♭',letter:1},{name:'D',letter:1},{name:'E♭',letter:2},
 {name:'E',letter:2},{name:'F',letter:3},{name:'F♯',letter:3},{name:'G',letter:4},
 {name:'A♭',letter:5},{name:'A',letter:5},{name:'B♭',letter:6},{name:'B',letter:6}
];
export const CHORDS = [
 {id:'major',symbol:'',name:'메이저',intervals:[0,4,7],degrees:[1,3,5],formula:'1 · 3 · 5',explanation:'근음에 장3도와 완전5도를 쌓은 메이저 코드입니다.',group:'triads'},
 {id:'minor',symbol:'m',name:'마이너',intervals:[0,3,7],degrees:[1,3,5],formula:'1 · ♭3 · 5',explanation:'메이저 코드의 3도를 반음 낮춘 코드입니다. 근음·단3도·완전5도로 구성됩니다.',group:'triads'},
 {id:'diminished',symbol:'dim',name:'디미니시드',intervals:[0,3,6],degrees:[1,3,5],formula:'1 · ♭3 · ♭5',explanation:'마이너 코드의 5도를 반음 낮춘 코드입니다. 근음·단3도·감5도로 구성됩니다.',group:'triads'},
 {id:'augmented',symbol:'aug',name:'어그먼티드',intervals:[0,4,8],degrees:[1,3,5],formula:'1 · 3 · ♯5',explanation:'메이저 코드의 5도를 반음 높인 코드입니다. 근음·장3도·증5도로 구성됩니다.',group:'triads'},
 {id:'sus2',symbol:'sus2',name:'서스펜디드 세컨드',intervals:[0,2,7],degrees:[1,2,5],formula:'1 · 2 · 5',explanation:'메이저 코드의 3도를 장2도로 바꾼 코드입니다. 3도가 없어 메이저·마이너를 구분하지 않습니다.',group:'triads'},
 {id:'sus4',symbol:'sus4',name:'서스펜디드 포스',intervals:[0,5,7],degrees:[1,4,5],formula:'1 · 4 · 5',explanation:'메이저 코드의 3도를 완전4도로 바꾼 코드입니다. 3도가 없어 메이저·마이너를 구분하지 않습니다.',group:'triads'},
 {id:'maj7',symbol:'maj7',name:'메이저 세븐스',intervals:[0,4,7,11],degrees:[1,3,5,7],formula:'1 · 3 · 5 · 7',explanation:'메이저 3화음에 장7도를 더한 코드입니다. 도미넌트 세븐스(7)보다 7도가 반음 높습니다.',group:'sevenths'},
 {id:'min7',symbol:'m7',name:'마이너 세븐스',intervals:[0,3,7,10],degrees:[1,3,5,7],formula:'1 · ♭3 · 5 · ♭7',explanation:'마이너 3화음에 단7도를 더한 코드입니다. 근음·단3도·완전5도·단7도로 구성됩니다.',group:'sevenths'},
 {id:'dom7',symbol:'7',name:'도미넌트 세븐스',intervals:[0,4,7,10],degrees:[1,3,5,7],formula:'1 · 3 · 5 · ♭7',explanation:'메이저 3화음에 단7도를 더한 코드입니다. maj7보다 7도가 반음 낮습니다.',group:'sevenths'},
 {id:'halfDim7',symbol:'m7♭5',name:'하프 디미니시드',intervals:[0,3,6,10],degrees:[1,3,5,7],formula:'1 · ♭3 · ♭5 · ♭7',explanation:'마이너 세븐스 코드의 5도를 반음 낮춘 코드입니다. 디미니시드 3화음에 단7도를 더한 형태입니다.',group:'sevenths'},
 {id:'dim7',symbol:'dim7',name:'디미니시드 세븐스',intervals:[0,3,6,9],degrees:[1,3,5,7],formula:'1 · ♭3 · ♭5 · ♭♭7',explanation:'디미니시드 3화음에 감7도를 더한 코드입니다. 단3도(3반음) 간격으로 음을 쌓으며, 감7도는 ♭♭7로 표기합니다.',group:'sevenths'}
];
const pitchNames=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const flatNames={1:'D♭',3:'E♭',6:'G♭',8:'A♭',10:'B♭'};
export const midiName = midi => pitchNames[midi%12]+(Math.floor(midi/12)-1);
export const alternateName = midi => flatNames[midi%12] || '';
export const isBlack = midi => [1,3,6,8,10].includes(midi%12);
export function spellChord(root,chord) {
 const letters=['C','D','E','F','G','A','B'], naturals=[0,2,4,5,7,9,11];
 return chord.intervals.map((interval,i)=>{
  const letterIndex=(ROOTS[root].letter+chord.degrees[i]-1)%7;
  let diff=((root+interval-naturals[letterIndex])%12+12)%12;
  if(diff>6)diff-=12;
  return letters[letterIndex]+(diff>0?'♯'.repeat(diff):'♭'.repeat(-diff));
 });
}
export function grade(selected,expected){
 const unique=[...new Set(selected)];
 const missing=expected.filter(n=>!unique.includes(n));
 const extra=unique.filter(n=>!expected.includes(n));
 return {correct:missing.length===0&&extra.length===0,missing,extra};
}
