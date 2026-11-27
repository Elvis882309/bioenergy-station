// Run against the local solver: node tools/check_stationmaster.cjs [base URL].
const assert=require("node:assert/strict");
const analyze=require("../webdemo/static/station/acid-watch.js");
const base=process.argv[2]||"http://127.0.0.1:8848";
const feed=["maize_silage_milk_ripeness","swine_manure","cattle_manure"].map((substrate_id,i)=>({substrate_id,q:[11.4,6.1,5][i]}));
async function solve(extra){
  const res=await fetch(base+"/api/trace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({duration:30,max_points:1000,feed,...extra})});
  assert.equal(res.status,200);return res.json();
}
(async()=>{
  const std=await solve({}), a=await solve({realism_seed:42}), b=await solve({realism_seed:42});
  assert.deepEqual(std.events,[]);assert.equal(a.events.length,3);
  for(const k of ["t","ph","gas","y","events"])assert.deepEqual(a[k],b[k]);
  assert.notDeepEqual(std.gas,a.gas);
  const changed=await solve({realism_seed:43});assert.notDeepEqual(changed.events,a.events);
  const stressed=await solve({realism_seed:42,temperature_c:22,feed:[{...feed[0],q:80}]});
  const alerts=analyze(stressed),normal=analyze(a);
  assert.equal(normal.history[0].level,"unknown");
  assert.equal(normal.history.at(-1).level,"quiet");
  assert(alerts.history.some(x=>x.level==="risk"));
  assert(alerts.history.some(x=>x.level==="watch"));
  const i=alerts.episodes[0];assert(i>0);assert.equal(alerts.history[i-1].count,0);
  assert.equal(alerts.history[i].count,1);
  console.log(JSON.stringify({events:a.events,standardFinal:std.final,seed42Final:a.final,firstWarning:alerts.history[i],stressedFinal:stressed.final},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
