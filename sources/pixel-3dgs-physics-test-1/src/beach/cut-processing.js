import {partition,finishSurface} from '../push-lab/model.js';
export function prepareCut(points,contacts){
 const split=partition(points),groups=[split.attached,...split.detached];
 // A grazing hit needs no global surface relaxation or resampling.
 const finished=split.detached.length?groups.map((p,i)=>finishSurface(p,contacts,groups.filter((_,j)=>i!==j).flat()).points):groups;
 return {groups:finished,discarded:split.discarded};
}
