"use strict";
const $ = id => document.getElementById(id);
const vp = $("plantViewport"), yard = vp.closest(".yard"), dialog = $("coreDialog");
const names = ["玉米青贮","猪粪","牛粪"], ids = ["maize_silage_milk_ripeness","swine_manure","cattle_manure"];
const colors = ["#dac578","#ab8168","#746445"], initial = [11.4,6.1,5];
let current=null, baseline=null, frame=0, playing=false, busy=false, runCount=0, shot=1;
let tour=false, animationId=0;
const signal=(name,detail)=>vp.dispatchEvent(new CustomEvent(name,{detail}));
const fmt=(x,n=2)=>Number.isFinite(x)?x.toLocaleString("zh-CN",{minimumFractionDigits:n,maximumFractionDigits:n}):"—";
const pct=(x,y)=>y>0?100*x/y:null;
function flows(){return ids.map((_,i)=>$("q"+i).valueAsNumber);}
function fractions(q){const total=q.reduce((a,b)=>a+b,0);return q.map(v=>total>0?v/total:0);}
function addMaterial(i){if(busy || !Number.isInteger(i)||i<0||i>2)return;const el=$("q"+i);el.value=Number(((el.valueAsNumber||0)+1).toFixed(1));edit();stationCue("feed");}
ids.forEach((id,i)=>{
  const card=document.createElement("button");card.textContent=names[i]+" +";card.draggable=true;card.onclick=()=>addMaterial(i);
  card.ondragstart=e=>e.dataTransfer.setData("application/x-feed-slot",String(i));$("cards").append(card);
  const line=document.createElement("label");line.innerHTML='<span>'+names[i]+'<small>'+id+'</small></span><input type="number" aria-label="'+names[i]+'流量 m³/d" id="q'+i+'" min="0" max="500" step="0.1" value="'+initial[i]+'">';$("feedRows").append(line);
});
$("drop").ondragover=e=>{e.preventDefault();$("drop").classList.add("over")};
$("drop").ondragleave=()=>$("drop").classList.remove("over");
$("drop").ondrop=e=>{e.preventDefault();$("drop").classList.remove("over");const data=e.dataTransfer.getData("application/x-feed-slot");if(/^[012]$/.test(data))addMaterial(Number(data))};
vp.addEventListener("material-pick",e=>addMaterial(e.detail));
function edit(announce=true){
  const q=flows(), f=fractions(q);
  $("mix").innerHTML=f.map((x,i)=>'<i style="width:'+100*x+'%;background:'+colors[i]+'"></i>').join("");
  $("total").textContent="合计 "+fmt(q.reduce((a,b)=>a+b,0),1)+" m³/d　·　"+f.map(v=>fmt(v*100,0)+"%").join(" / ");
  signal("feed-mixture",f);
  if(announce)$("status").textContent=current?"草稿已修改。读数仍来自已完成的方案 "+current.id+"。":"草稿已修改，等待锁定运行。";
}
$("feed").oninput=()=>edit();
$("ledger").onchange=async event=>{
  const file=event.target.files[0];
  if(!file || busy)return;
  try{
    if(file.size>65536)throw Error("台账大小超过 64 KB");
    const rows=(await file.text()).trim().split(/\r?\n/).filter(line=>line.trim()).map(line=>line.split(",").map(cell=>cell.trim().replace(/^"([^"]*)"$/,"$1")));
    if(rows.shift()?.join(",")!=="substrate_id,q_m3_d")throw Error("请使用模板表头 substrate_id,q_m3_d，并先将原始计量换算为实际体积流量");
    const imported=new Map();
    for(const [pos,cells] of rows.entries()){
      const [name,value]=cells, slot=ids.indexOf(name), q=Number(value);
      if(cells.length!==2 || slot<0 || imported.has(slot) || !value || !Number.isFinite(q) || q<0 || q>500 || Math.abs(q*10-Math.round(q*10))>1e-8)
        throw Error("第 "+(pos+2)+" 行请核对原料标识和流量（0–500，最多一位小数，原料不可重复）");
      imported.set(slot,q);
    }
    if(![...imported.values()].some(q=>q>0))throw Error("请至少列出一种流量大于零的原料");
    if(busy)return;
    ids.forEach((_,i)=>$("q"+i).value=imported.get(i)??0);
    edit();$("status").textContent="已导入 "+file.name+" 的配方草稿，核对无误后可锁定运行。";
  }catch(error){$("status").textContent="未导入："+error.message;}
  finally{event.target.value="";}
};
const observations=["入料","搅拌","气体生成","反应阶段"], poses=[.12,.46,.86,.57];
const phases=[["可水解碳水化合物","X_S_ch",18],["溶解单糖","S_su",0],["总丙酸","S_pro",5],["溶解甲烷","S_ch4",8]];
function observe(){
  const s=phases[$("phase").selectedIndex];
  $("phaseBox").hidden=shot!==3;
  $("observation").textContent=shot===3?s[0]+" · "+s[1]+"　"+(current?fmt(current.trace.y[41*frame+s[2]],5)+" kg COD/m³":"等待求解")+"。这里显示相关状态浓度。":
    ["观察原料落入浆液的位置。","观察搅拌轴、桨叶和浆液环流。","观察气泡上升与集气管道。"][shot];
  [...$("shots").children].forEach((b,i)=>b.setAttribute("aria-pressed",i===shot));
  signal("process-shot",poses[shot]);signal("plant-redraw");
}
observations.forEach((s,i)=>{const b=document.createElement("button");b.textContent=s;b.onclick=()=>{tour=false;shot=i;observe()};$("shots").append(b)});
$("phase").onchange=observe;
function view(v){
  if(v==="energy")stop();
  document.body.dataset.station=v;
  window.dispatchEvent(new CustomEvent("station-view",{detail:v}));
  const panels={overview:"overview",feed:"feed",dig:"dig",gas:"gasPanel"};
  Object.entries(panels).forEach(([key,id])=>$(id).hidden=key!==v);
  yard.dataset.phase=v==="feed"?"feed":v==="dig"?"running":current?"complete":"idle";
  document.querySelectorAll(".dock [data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===v));
  if(v==="feed")edit(false);
  if(v==="dig"){signal("feed-mixture",fractions(current?current.config.feed.map(x=>x.q):initial));observe();}
  if(v==="gas")compare();
}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>view(b.dataset.view));
["feed","dig","gas"].forEach(v=>$(v+"Node").onclick=()=>view(v));
function config(){
  return {backend:"scipy",dt:1,duration:Number($("days").value),temperature_c:$("temp").valueAsNumber,v_liq:$("liq").valueAsNumber,v_gas:$("head").valueAsNumber,k_l_a:$("kla").valueAsNumber,feed:ids.map((id,i)=>({substrate_id:id,q:flows()[i]})),temp_step_day:$("eventCase").checked?10:null,temp_step_delta_c:-5,max_points:3000};
}
function summary(t){
  let gas=0,ch4=0;
  for(let i=1;i<t.t.length;i++){
    const dt=(t.t[i]-t.t[i-1])/2;gas+=dt*(t.gas[i]+t.gas[i-1]);ch4+=dt*(t.ch4[i]+t.ch4[i-1]);
  }
  const tail=t.gas.filter((_,i)=>t.t[i]>=t.days-7), hi=Math.max(...tail),lo=Math.min(...tail);
  return {avg:gas/(t.t.at(-1)-t.t[0]),share:pct(ch4,gas),volume:gas,ph:Math.min(...t.ph),swing:pct(hi-lo,hi)};
}
const rules=["全窗口记录的最低 pH ≥ 6.5，末 7 天产气波幅 ≤ 5%。","猪粪进料 ≥ 8 m³/d，且全窗口记录的最低 pH ≥ 6.5。","保留首次基线，改变至少一个运行条件，在相同天数内完成第二次计算。"];
function task(){
  const t=$("task").selectedIndex;
  const pass=current&&[current.stats.ph>=6.5&&current.stats.swing!==null&&current.stats.swing<=5,current.config.feed[1].q>=8&&current.stats.ph>=6.5,current!==baseline&&current.config.duration===baseline.config.duration&&JSON.stringify(current.config)!==JSON.stringify(baseline.config)][t];
  $("rule").textContent=(current?(pass?"已达成 · ":"尚未达成 · "):"")+"场景设定："+rules[t];
  $("rule").className=current?(pass?"ok":"attention"):"";
}
$("task").onchange=task;
function setFrame(i){
  if(!current)return;const t=current.trace;frame=Math.min(t.n_steps-1,Math.max(0,Math.round(i)));
  $("timeline").value=frame;$("date").textContent=fmt(t.t[frame],2)+" d";$("gas").textContent=fmt(t.gas[frame],1);$("ph").textContent=fmt(t.ph[frame]);const share=pct(t.ch4[frame],t.gas[frame]);$("methane").textContent=share===null?"—":fmt(share,1)+"%";
  signal("gas-flow",t.gas[frame]);
  if(document.body.dataset.station==="dig"){
    const fraction=t.t[frame]/t.days;
    const nextShot=fraction<.23?0:fraction<.68?1:2;
    if(tour && nextShot!==shot){shot=nextShot;observe();}
    else if(shot===3)observe();
  }
}
function stop(){playing=false;cancelAnimationFrame(animationId);$("play").textContent="播放";}
let playbackClock=0,prev=0;
function tick(stamp){if(!playing)return;const t=current.trace;playbackClock+=Math.min(.5,(stamp-prev)/1000)*t.days/15*parseFloat($("speed").value);prev=stamp;let i=frame;while(i+1<t.n_steps&&t.t[i+1]<=playbackClock)i++;if(i!==frame)setFrame(i);if(i===t.n_steps-1)stop();else animationId=requestAnimationFrame(tick);}
function start(){if(document.body.dataset.module && document.body.dataset.module!=="station")return;if(!current||playing||$("static-mode").checked||busy)return;if(frame===current.trace.n_steps-1)setFrame(0);playing=true;$("play").textContent="暂停";playbackClock=current.trace.t[frame];prev=performance.now();animationId=requestAnimationFrame(tick);}
$("play").onclick=()=>playing?stop():start();$("timeline").oninput=()=>{stop();setFrame(+$("timeline").value)};
$("static-mode").checked=matchMedia("(prefers-reduced-motion:reduce)").matches;
$("static-mode").onchange=()=>{stop();signal("plant-redraw");$("play").disabled=!current||busy||$("static-mode").checked;};
const metrics=[["平均产气 m³/d","avg"],["甲烷气量占比 %","share"],["累计产气 m³","volume"],["最低 pH","ph"],["末周产气波幅 %","swing"]];
function compare(){
  if(!current){$("comparison").textContent="完成首次运行后，这里将保存基线。";return;}
  const a=baseline,b=current,same=a.config.duration===b.config.duration;
  let html='<p>基线 '+a.id+' · '+a.config.duration+' d　/　本轮 '+b.id+' · '+b.config.duration+' d</p><table><tr><th>全窗指标</th><th>基线</th><th>本轮</th></tr>';
  for(const [title,key] of metrics)html+='<tr><td>'+title+'</td><td>'+fmt(a.stats[key])+'</td><td>'+fmt(b.stats[key])+'</td></tr>';
  const fields=[["温度","temperature_c","°C"],["液相","v_liq","m³"],["气相","v_gas","m³"],["kLa","k_l_a","d⁻¹"],["窗口","duration","d"]];
  const changes=fields.filter(([,k])=>a.config[k]!==b.config[k]).map(([n,k,u])=>n+" "+a.config[k]+" → "+b.config[k]+" "+u);
  names.forEach((n,i)=>{const x=a.config.feed[i].q,y=b.config.feed[i].q;if(x!==y)changes.push(n+" "+x+" → "+y+" m³/d")});
  if(a.config.temp_step_day!==b.config.temp_step_day)changes.push(b.config.temp_step_day?"加入第 10 天降温":"取消第 10 天降温");
  html+='</table><p>'+(!same?"窗口不同，累计量不宜直接比较。 ":"")+(changes.length?changes.join("；"):"与基线使用相同配置。")+'</p><details><summary>指标口径</summary><p>气量按返回轨迹首末样本间梯形积分估算。占比为累计甲烷 / 累计沼气。末周波幅为（最高−最低）/ 最高。分母为零显示未知。</p></details>';
  $("comparison").innerHTML=html;
  const windows=document.createElement("details");
  windows.innerHTML="<summary>30 / 150 / 300 天产气记录</summary>";
  for(const day of [30,150,300]){
    const t=b.trace;
    const caption="前 "+day+" 天";
    if(day>t.t.at(-1)){windows.insertAdjacentHTML("beforeend","<p>"+caption+" · 超出本轮仿真窗口</p>");continue;}
    let gas=0,ch4=0;
    for(let i=1;i<t.t.length && t.t[i-1]<day;i++){
      const span=t.t[i]-t.t[i-1],dt=Math.min(day,t.t[i])-t.t[i-1];
      if(span<=0)continue;
      const area=series=>dt*(series[i-1]+(series[i]-series[i-1])*dt/(2*span));
      gas+=area(t.gas);ch4+=area(t.ch4);
    }
    windows.insertAdjacentHTML("beforeend","<table><caption>"+caption+"</caption><tr><th>累计沼气 m³</th><th>累计甲烷 m³</th></tr><tr><td>"+fmt(gas)+"</td><td>"+fmt(ch4)+"</td></tr></table>");
  }
  $("comparison").append(windows);
}
function controls(){
  $("feed").querySelectorAll("input,select,button").forEach(el=>el.disabled=busy);
  $("timeline").disabled=$("core").disabled=busy||!current;$("play").disabled=busy||!current||$("static-mode").checked;
  $("run").textContent=busy?"读取记录中…":"锁定配方并读取记录 →";
}
$("run").onclick=async()=>{
  if(busy)return;
  for(const el of $("feed").querySelectorAll("input[type=number]")){if(el.value===""||!el.checkValidity()){el.required=true;el.reportValidity();return}}
  if(flows().every(q=>q===0)){ $("status").textContent="请至少加入一种原料。";return;}
  const settings=config();
  if(settings.temp_step_day!==null&&settings.temperature_c<20){$("status").textContent="阶跃后温度须在本场景的 15–65 °C 范围内。";return;}
  stationCue("start");stop();busy=true;controls();$("status").textContent="配方已锁定，正在读取匹配的求解记录。";
  try{
    const res=await fetch("/api/trace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});
    const t=await res.json();if(!res.ok||!t.ok)throw Error(typeof t.detail==="string"?t.detail:"求解请求失败");
    if(t.state_size!==41||!t.n_steps||t.y.length!==41*t.n_steps)throw Error("返回的状态轨迹不完整");
    current={id:++runCount,trace:t,config:settings,stats:summary(t)};if(!baseline)baseline=current;
    $("timeline").max=t.n_steps-1;$("record").textContent="方案 "+current.id+" · 回放时刻读数";
    const d=current.stats.avg-baseline.stats.avg;
    $("delta").textContent=current===baseline?"首次方案已存为基线":current.config.duration===baseline.config.duration?"全窗平均产气较基线 "+(d>=0?"+":"")+fmt(d,1)+" m³/d":"窗口不同 · 详见方案对比";
    $("status").textContent="方案 "+current.id+" 已载入 · 原运行耗时 "+fmt(t.elapsed_s,3)+" s · "+t.n_raw_steps+" 个接受步，保留 "+t.n_steps+" 帧。";
    tour=!$("static-mode").checked;stationCue("done");task();compare();view("dig");setFrame($("static-mode").checked?t.n_steps-1:0);
  }catch(err){stationCue("error");$("status").textContent="本次运行未完成："+err.message+"。可调整草稿后重试。";return;}
  finally{busy=false;controls();}
  start();
};
window.stationSnapshot=()=>current&&({trace:current.trace,index:frame,id:current.id,still:$("static-mode").checked});
$("core").onclick=()=>{if(!current)return;stop();$("coreMeta").textContent="方案 "+current.id+" · "+$("date").textContent+" 进入";dialog.showModal();dialog.querySelector("iframe").src="core.html";};
$("back").onclick=()=>dialog.close();
dialog.onclose=()=>{const iframe=dialog.querySelector("iframe");const i=iframe.contentWindow.stationIndex?.();if(Number.isInteger(i))setFrame(i);iframe.removeAttribute("src");$("core").focus();};
edit(false);task();view("overview");controls();
