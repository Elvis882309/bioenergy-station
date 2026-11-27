"use strict";
// Trace state slots 3..6 are valerate, butyrate, propionate and acetate, in COD units.
function acidWatch(trace) {
  const history = [], episodes = [];
  let prev = 0, last = "";
  const vfa = i => {
    const offset = i * trace.state_size + 3;
    const acids = trace.y?.slice(offset, offset + 4);
    return acids?.length === 4 && acids.every(Number.isFinite) ? acids.reduce((a,b)=>a+b,0) : null;
  };
  for (let i=0; i<trace.t.length; i++) {
    const day=trace.t[i], ph=trace.ph?.[i], acids=vfa(i), target=day-1;
    while (prev+1<i && trace.t[prev+1]<=target) prev++;
    const span=day-trace.t[prev], prior=vfa(prev);
    const enough=span>=1 && span<=1.5 && Number.isFinite(trace.ph?.[prev]);
    const dp=enough && Number.isFinite(ph) ? ph-trace.ph[prev] : null;
    const da=enough && acids!==null && prior!==null ? acids-prior : null;
    const level=!Number.isFinite(ph)?"unknown":ph<6.5?"risk":
      dp!==null && dp<=-0.15 && da!==null && da>=0.05?"watch":
      dp===null || da===null?"unknown":"quiet";
    if ((level==="risk" || level==="watch") && level!==last) episodes.push(i);
    history.push({day,ph,acids,span,dp,da,level,count:episodes.length});
    last=level;
  }
  return {history,episodes};
}
if(typeof module!=="undefined" && module.exports) module.exports=acidWatch;
