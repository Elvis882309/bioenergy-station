/* Homepage presentation. Every numerical frame refers to a returned sample. */
"use strict";
const dashboard = (() => {
  const phases=["水解","酸化","产乙酸","产甲烷"];
  const phaseKeys=[["k_hyd_ch","k_hyd_pr","k_hyd_li"],["k_m_su","k_m_aa"],["k_m_fa","k_m_c4","k_m_pro"],["k_m_ac","k_m_h2"]];
  const fields=[
    ["平均沼气产量","avg_q_gas",1,"m³/d"],["平均甲烷占比","avg_ch4_pct",1,"%"],
    ["累计产气","total_gas_nm3",0,"Nm³"],["末态 pH","final_ph",2,""],
    ["水力停留时间","final_hrt",1,"d"],["VFA / TAC","final_vfa",2,"kg/m³"]
  ];
  const motion=matchMedia("(prefers-reduced-motion: reduce)");
  const mode=$("static-mode"), canvas=$("vessel"), ctx=canvas.getContext("2d");
  let data=null, previous=null, config=null, acceptedConfig=null, frame=0, selected=0, playing=false, pending=false;
  let gas=null, ph=null, rates=[], dirty=false, audio=null, clock=0, lastTime=0, lastAdvance=0, playbackPosition=0, lastPaint=0, pendingEvent=null;
  const stageButtons=phases.map((name,i)=>{
    const button=document.createElement("button");button.className="btn tiny ghost";button.textContent=name;
    button.onclick=()=>{selected=i;showStage();paint();};$("stage-buttons").append(button);return button;
  });
  const cards=fields.map(([label],i)=>{
    const card=document.createElement("div");card.className="kpi";
    card.innerHTML='<div class="k-label"></div><div class="k-value"><span class="number"></span><span class="k-unit"></span></div><small class="delta"></small>';
    card.firstChild.textContent=label;card.querySelector(".k-unit").textContent=fields[i][3];$("kpis").append(card);return card;
  });
  function showStage(){
    const max=Math.max(...rates.filter(Number.isFinite));
    stageButtons.forEach((b,i)=>{b.setAttribute("aria-pressed",String(i===selected));b.classList.toggle("dominant",Number.isFinite(rates[i]) && rates[i]===max && max>0);});
    $("stage-value").textContent=phases[selected]+"　"+fmt(rates[selected],3)+" kg COD/(m³·d)";
    const params=pending?null:data?.stage_params;
    $("stage-detail").textContent=phaseKeys[selected].map(k=>k+(params?" "+fmt(params[k],2):"")).join(" · ")+(params?" d⁻¹":"");
  }
  function setGas(value,acidity,stage){
    document.getElementById("plantViewport")?.dispatchEvent(new CustomEvent("gas-flow",{detail:value}));
    gas=value;ph=acidity;rates=stage||[];
    $("flow-now").textContent=fmt(gas,1);
    canvas.parentElement.classList.toggle("alert",Number.isFinite(ph)&&ph<6);showStage();
  }
  function sound(frequency,delay=0){
    if(!audio||$("sound").getAttribute("aria-pressed")!=="true"||mode.checked)return;
    const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();
    o.frequency.value=frequency;g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.065);
    o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.07);
  }
  $("sound").onclick=async()=>{
    const on=$("sound").getAttribute("aria-pressed")==="false";
    if(on){try{audio ||= new AudioContext();await audio.resume();}catch{return;}}
    $("sound").setAttribute("aria-pressed",String(on));$("sound").textContent=on?"音效开":"音效关";
  };
  function digits(node,value,settle=false,waiting=false){
    if(node.dataset.value===value && !settle && !waiting)return;
    const previousValue=node.dataset.value;
    node.dataset.value=value;node.setAttribute("aria-label",waiting?"求解中":value);node.replaceChildren();
    let column=0;
    for(const c of value){
      const outer=document.createElement("span");outer.setAttribute("aria-hidden","true");
      if(!/\d/.test(c)||mode.checked){outer.textContent=c;}
      else {
        outer.className="digit";const strip=document.createElement("span");strip.className="strip";strip.textContent="01234567890123456789".split("").join("\n");outer.append(strip);
        const end="translateY(-"+Number(c)+"em)";strip.style.transform=end;
        if(waiting)strip.animate([{transform:"translateY(0)"},{transform:"translateY(-10em)"}],{duration:390+column*31,iterations:Infinity});
        if(!waiting&&!settle&&previousValue?.length===value.length){
          const old=previousValue[node.childNodes.length];
          if(/\d/.test(old)&&old!==c)strip.animate([{transform:"translateY(-"+old+"em)"},{transform:end}],{duration:95,easing:"ease-out"});
        }
        if(settle)strip.animate([{transform:"translateY(-"+(Number(c)+10)+"em)",filter:"blur(1.5px)"},{transform:end,offset:.84},{transform:"translateY(calc(-"+c+"em - 1px))",offset:.92},{transform:end}],{duration:450,delay:column*70,fill:"backwards",easing:"ease-out"});
        column++;
      }
      node.append(outer);
    }
  }
  function stop(){playing=false;$("play").textContent="播放";}
  function sampleSummary(i){
    const s=data.series, mean=(v)=>{const a=v.slice(0,i+1).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
    let volume=0;
    for(let j=1;j<=i;j++){
      if(!Number.isFinite(s.q_gas[j])||!Number.isFinite(s.q_gas[j-1])){volume=null;break;}
      volume+=(s.time[j]-s.time[j-1])*(s.q_gas[j]+s.q_gas[j-1])/2;
    }
    return {avg_q_gas:mean(s.q_gas),avg_ch4_pct:mean(s.ch4_pct),total_gas_nm3:volume,final_ph:s.ph[i],final_hrt:s.hrt[i],final_vfa:s.vfa[i],final_tac:s.tac[i]};
  }
  function difference(a,b,n){
    if(!Number.isFinite(a)||!Number.isFinite(b))return "—";
    return (a>b?"▲ +":a<b?"▼ −":"")+fmt(Math.abs(a-b),n);
  }
  function showFrame(index,settle=false){
    if(!data)return;
    frame=index;const s=data.series,final=index===s.time.length-1,summary=final?data.summary:sampleSummary(index);
    $("seek").value=index;$("stamp").textContent=fmt(s.time[index],2)+" d";
    $("mode-label").textContent=final?"终局报表":playing?"结果回放":"回放暂停";
    const ratio=Number.isFinite(summary.final_vfa)&&summary.final_tac>0?summary.final_vfa/summary.final_tac:null;
    const limit=$("ratio-limit").valueAsNumber;
    fields.forEach(([label,key,n],i)=>{
      const c=cards[i],v=summary[key],value=fmt(v,n)+(i===5?" / "+fmt(summary.final_tac,n):"");
      c.firstChild.textContent=!final&&i===3?"当前 pH":label;
      digits(c.querySelector(".number"),value,final&&settle);
      const alarm=i===3&&Number.isFinite(v)&&v<6 || i===5&&limit>0&&ratio!==null&&ratio>limit;
      c.classList.toggle("alarm",alarm);
      const delta=c.querySelector(".delta"),b=previous?.summary;
      delta.className="delta"+(final&&b&&i<2?(v>b[key]?" plus":v<b[key]?" minus":""):"");
      delta.textContent=(alarm?"超限 · ":"")+(final&&b?"较上次 "+difference(v,b[key],n)+(i===5?" / "+difference(summary.final_tac,b.final_tac,n):i===1?" 个百分点":""):i===5?"比值 "+fmt(ratio,2):final?"首次运行":"截至当前采样点");
      if(i===5 && summary.final_tac==null)delta.textContent="模型碱度不可用，无法计算比值";
    });
    setGas(s.q_gas[index],s.ph[index],data.stage_rates[index]);
    const prefix=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,v.slice(0,index+1)]));drawCharts(prefix);
    let steady=final&&index>=3;
    for(let j=Math.max(1,index-2);steady&&j<=index;j++){
      const a=s.q_gas[j-1],b=s.q_gas[j],dt=s.time[j]-s.time[j-1];
      steady=a>0&&b>0&&dt>0&&Math.abs(b-a)/a/dt<.01;
    }
    $("steady").hidden=!steady;$("steady").title="末尾连续三个采样区间的日沼气流量相对变化均低于 1%/d";
    if(final&&settle&&!mode.checked){sound(460);sound(610,.14);sound(830,.35);}
    paint();
  }
  function startPlayback(){if(!data||mode.checked||pending)return;playing=true;lastAdvance=performance.now();playbackPosition=frame>=data.series.time.length-1?0:frame;$("play").textContent="暂停";showFrame(frame>=data.series.time.length-1?0:frame);}
  $("play").onclick=()=>{if(playing){stop();showFrame(frame);}else startPlayback();};
  $("seek").oninput=()=>{stop();showFrame(Number($("seek").value));};
  $("ratio-limit").oninput=()=>{if(!pending&&data)showFrame(frame);};
  function staticMode(){
    document.body.classList.toggle("static-report",mode.checked);stop();
    $("seek").disabled=$("play").disabled=mode.checked||pending||!data;
    if(pending){cards.forEach(c=>digits(c.querySelector(".number"),"—"));}else if(data)showFrame(data.series.time.length-1);
    paint();
  }
  let setting=localStorage.getItem("adm1.static");mode.checked=setting===null?motion.matches:setting==="1";
  mode.onchange=()=>{localStorage.setItem("adm1.static",mode.checked?"1":"0");staticMode();};
  motion.onchange=()=>{if(localStorage.getItem("adm1.static")===null){mode.checked=motion.matches;staticMode();}};
  function markInput(){
    if(!state.meta||pending)return;
    dirty=!!data&&JSON.stringify(buildRequest())!==JSON.stringify(acceptedConfig);
    $("origin").textContent=dirty?"输入预览 · 产气与曲线来自上次求解":"PyADM1ODE 模型仿真 · 非实测";
    paint();
  }
  document.querySelector(".sidebar").addEventListener("input",markInput);
  document.querySelector(".sidebar").addEventListener("change",markInput);
  document.querySelector(".sidebar").addEventListener("click",e=>{if(e.target.closest(".remove,#add-feed,#reset"))queueMicrotask(markInput);});
  async function stream(req,compare,onProgress){
    const response=await fetch("/api/dashboard-stream"+(compare?"?compare=true":""),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(req)});
    if(!response.ok)throw Error("HTTP "+response.status);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
    try{
      while(true){
        const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
        let pos;
        while((pos=buffer.indexOf("\n"))>=0){
          const event=JSON.parse(buffer.slice(0,pos));buffer=buffer.slice(pos+1);
          if(event.type==="error")throw Error(event.message);
          if(event.type==="result")return event.data;
          onProgress(event);
        }
        if(done)throw Error("连接中断，未收到完整结果");
      }
    }finally{reader.releaseLock();}
  }
  function begin(req){
    stop();config=req;pending=true;dirty=false;pendingEvent=null;
    $("export").disabled=true;$("play").disabled=$("seek").disabled=true;$("steady").hidden=true;
    $("mode-label").textContent="求解中";$("stamp").textContent="— d";$("origin").textContent="PyADM1ODE · 等待首个积分区间";
    for(const c of cards){digits(c.querySelector(".number"),mode.checked?"—":"000",false,!mode.checked);c.querySelector(".delta").textContent="等待求解结果";c.classList.remove("alarm");}
    setGas(null,null,[]);setStatus("求解中 · "+req.backend,"busy");paint();
  }
  function progress(event){pendingEvent=event;}
  function flushProgress(){
    const e=pendingEvent;if(!e)return;pendingEvent=null;
    setGas(e.gas,e.ph,e.rates);$("stamp").textContent=fmt(e.day,2)+" d";
    $("origin").textContent="已完成 "+e.outer+" 个工艺区间"+(e.steps!==null? " · "+(config.backend==="scipy"?"BDF":"Rodas4P")+" 接受步 "+e.steps+" · 最近 h "+e.h.toPrecision(3)+" d":" · 区间 dt "+fmt(e.dt,2)+" d");
    if(mode.checked)paint();
    setStatus("已积分 "+fmt(e.day,2)+" / "+config.duration+" d","busy");
  }
  function complete(result,req,prev){
    flushProgress();pending=false;data=result;previous=prev;config=acceptedConfig=req;frame=0;
    $("origin").textContent="PyADM1ODE 模型仿真 · 非实测 · "+req.backend+" · "+req.temperature_c+" °C";
    $("seek").max=result.series.time.length-1;$("seek").disabled=$("play").disabled=mode.checked;
    if(mode.checked||result.series.time.length===1)showFrame(result.series.time.length-1,true);else startPlayback();
  }
  function failed(){pending=false;pendingEvent=null;config=acceptedConfig;staticMode();markInput();$("export").disabled=!data;
    if(!data){setGas(null,null,[]);cards.forEach(c=>{digits(c.querySelector(".number"),"—");c.querySelector(".delta").textContent="无结果";});$("mode-label").textContent="求解失败";}}
  let raceTimer=0;
  function startRace(req){cancelAnimationFrame(raceTimer);stop();$("compare-panel").hidden=false;$("compare-body").replaceChildren();
    $("race").innerHTML='<strong>预热后依次实测</strong>'+["scipy · BDF","ADM1jl · Rodas4P"].map(n=>'<label>'+n+' <output>等待</output><progress value="0" max="1"></progress></label>').join("");
  }
  function raceProgress(e,req){
    const row=$("race").querySelectorAll("label")[e.backend==="scipy"?0:1];
    row.querySelector("progress").value=e.elapsed!==undefined?1:e.day/req.duration;
    row.querySelector("output").textContent=e.elapsed!==undefined?"完成 · "+fmt(e.elapsed,3)+" s":fmt(e.day,2)+" d";
  }
  function finishRace(d){
    for(const k of ["scipy","adm1jl"])raceProgress({backend:k,elapsed:d[k].elapsed_s},{});
    $("race").firstChild.textContent="BDF / Rodas4P 耗时比　"+fmt(d.speedup,2)+"×";
    if(mode.checked)return;
    const lanes=[...$("race").querySelectorAll("label")];
    const seconds=[d.scipy.elapsed_s,d.adm1jl.elapsed_s];
    const start=performance.now(),slow=Math.max(...seconds);
    function replay(now){
      const fraction=mode.checked?1:Math.min(1,(now-start)/2600);
      lanes.forEach((row,i)=>{
        const done=Math.min(1,slow*fraction/Math.max(.00001,seconds[i]));
        row.querySelector("progress").value=done;
        row.querySelector("output").textContent=(done>=1?"完成 · ":"耗时回放 · ")+fmt(seconds[i],3)+" s";
        row.classList.toggle("arrived",done>=1);
      });
      if(fraction<1)raceTimer=requestAnimationFrame(replay);
    }
    raceTimer=requestAnimationFrame(replay);
  }
  function raceError(){$("race").firstChild.textContent="对比未完成 · 无耗时比";}
  const stageColor=["#8dd9b1","#e5b467","#c19de9","#62d6ed"];
  function paint(){
    if(!ctx)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cx=w/2,cy=h*.49,R=Math.min(h*.405,w*.28),tau=Math.PI*2;
    const request=dirty?buildRequest():config,feed=request?.feed||[],total=feed.reduce((a,f)=>a+f.q,0);
    const temp=request?.temperature_c??42, strength=Number.isFinite(gas)&&gas>0?gas/(gas+700):0;
    const red=Number.isFinite(ph)&&ph<6, tint=red?"#fa9184":"#70dfd1";
    const dot=(x,y,r,c)=>{ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fillStyle=c;ctx.fill();};
    const feedColor=id=>"hsl("+([...id].reduce((h,c)=>(h*33+c.charCodeAt(0))>>>0,7)%360)+" 55% 65%)";
    const choose=q=>{let sum=0;return feed.find(f=>(sum+=f.q)>=q*total)?.substrate_id||"feed";};
    ctx.strokeStyle="#314251";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(8,cy+11);ctx.lineTo(cx-R,cy+11);ctx.moveTo(cx+R,cy-11);ctx.lineTo(w-8,cy-11);ctx.stroke();
    const span=Math.max(1,cx-R-12);
    for(let i=0;total>0&&i<15;i++){const p=(i/15+clock*(total/(total+28))*.38)%1;dot(10+p*span,cy+11,2.2,feedColor(choose((i+.5)/15)));}
    for(let i=0;i<Math.ceil(13*strength);i++){const p=(i/13+clock*strength*.44)%1;dot(cx+R+p*span,cy-11,2,"#82d8ef");}
    const max=Math.max(...rates.filter(Number.isFinite));
    for(let i=0;i<4;i++){
      ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2+i*tau/4+.035,-Math.PI/2+(i+1)*tau/4-.035);
      ctx.strokeStyle=stageColor[i];ctx.lineWidth=i===selected?5:3;ctx.globalAlpha=max>0&&rates[i]===max?1:.42;ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.save();ctx.beginPath();ctx.roundRect(cx-R*.75,cy-R*.79,R*1.50,R*1.6,R*.36);ctx.clip();
    const liquid=ctx.createLinearGradient(0,cy-R*.4,0,cy+R);liquid.addColorStop(0,red?"#532e32":"#174b50");liquid.addColorStop(1,"#0d202a");ctx.fillStyle=liquid;
    ctx.beginPath();for(let j=0;j<=48;j++){const x=cx-R+2*R*j/48,y=cy-R*.40+Math.sin(j*.23+clock)*2;if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.lineTo(cx+R,cy+R);ctx.lineTo(cx-R,cy+R);ctx.fill();
    for(let i=0;i<58;i++){
      const a=2.4*i+clock*(.10+temp/200),r=R*(.1+.74*((i*.618)%1));
      const x=cx+Math.cos(a)*r,y=cy+R*.18+Math.sin(a)*r*.66;
      if(y<cy-R*.39)continue;
      ctx.globalAlpha=red?.38:.78;dot(x,y,i%5?1.25:3.3,i%5?tint:feedColor(choose((i*.47)%1)));
    }
    ctx.globalAlpha=.8;
    for(let i=0;i<Math.round(52*strength*(red?.5:1));i++){
      const p=(i*.618+clock*(.10+strength*.23))%1;
      ctx.beginPath();ctx.arc(cx+R*(Math.sin(i*7)*.65+.035*Math.sin(p*7+i)),cy+R*(.76-1.14*p),1.5+i%4,0,tau);ctx.strokeStyle=tint;ctx.lineWidth=.85;ctx.stroke();
    }
    ctx.restore();ctx.beginPath();ctx.roundRect(cx-R*.75,cy-R*.79,R*1.50,R*1.6,R*.36);ctx.strokeStyle=red?"#f07571":"#497578";ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="#bbcecc";ctx.font="12px 'Microsoft YaHei',sans-serif";ctx.textAlign="left";ctx.fillText("进料",8,cy-2);ctx.textAlign="right";ctx.fillText("集气",w-8,cy-24);
    ctx.textAlign="left";ctx.fillText(fmt(total,1)+" m³/d",8,cy+32);
  }
  canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height*.49;
    const radius=Math.min(r.height*.405,r.width*.28);if(Math.abs(Math.hypot(x,y)-radius)>15)return;
    selected=Math.floor(((Math.atan2(y,x)+2.5*Math.PI)%(2*Math.PI))/(Math.PI/2));showStage();paint();};
  function loop(now){
    if(!document.hidden){
      if(pending&&pendingEvent)flushProgress();
      if(playing&&now-lastAdvance>=95){
        const seconds=(now-lastAdvance)/1000;
        playbackPosition+=seconds*(data.series.time.length-1)/12*parseFloat($("speed").value);
        const next=Math.min(Math.floor(playbackPosition),data.series.time.length-1);lastAdvance=now;
        if(next===data.series.time.length-1)stop();
        if(next!==frame)showFrame(next,next===data.series.time.length-1);
      }
      if(!mode.checked&&now-lastPaint>31){clock+=Math.min((now-lastTime)/1000,.08);paint();lastPaint=now;}
    }
    lastTime=now;requestAnimationFrame(loop);
  }
  new ResizeObserver(paint).observe(canvas);
  staticMode();showStage();requestAnimationFrame(loop);
  return {begin,progress,complete,failed,stream,startRace,raceProgress,finishRace,raceError};
})();
