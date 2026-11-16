// Development-only whole-frame timing. GPU results are polled without blocking.
export function createFrameProfile(renderer){
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
 const samples=[],gpu=[];let stamp=0,row=null,query=null,label=null,lastReport=performance.now();
 return {
  begin(now,phase,paused){row=paused?null:{phase,frame:now-stamp};stamp=now;if(row)row.start=performance.now();},
  mark(name){if(row){const now=performance.now();row[name]=now-row.start;row.start=now;}},
  renderStart(name='scene'){label=name;if(row&&ext&&pending.length<8){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}},
  renderEnd(){if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,phase:row.phase,label});query=null;}},
  end(state=null){
   this.renderEnd();
   while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
    const item=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push({phase:item.phase,label:item.label,ms:gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6});gl.deleteQuery(item.query);
   }
   if(row){delete row.start;samples.push(row);}
   if(performance.now()-lastReport<3000)return;lastReport=performance.now();
   if(samples.length){const summary={};for(const phase of [...new Set(samples.map(s=>s.phase))]){const rows=samples.filter(s=>s.phase===phase),result={frames:rows.length};for(const key of Object.keys(rows[0]).filter(k=>k!=='phase')){const values=rows.map(r=>r[key]||0).sort((a,b)=>a-b);result[key]=[values[Math.floor(values.length*.5)],values[Math.floor(values.length*.95)],values.at(-1)].map(v=>+v.toFixed(2));}for(const label of ['scene','post']){const times=gpu.filter(g=>g.phase===phase&&g.label===label).map(g=>g.ms).sort((a,b)=>a-b);if(times.length)result['gpu_'+label]=[times[Math.floor(times.length*.5)],times[Math.floor(times.length*.95)],times.at(-1)].map(v=>+v.toFixed(2));}summary[phase]=result;}if(state)summary.state=state;console.log('FRAME_PROFILE '+JSON.stringify(summary));}
   samples.length=0;gpu.length=0;
  },
 };
}
