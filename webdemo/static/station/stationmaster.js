(()=>{
  const toggle=$("realism"), seed=$("realismSeed"), desk=$("masterDesk");
  const notice=$("masterNotice"),close=$("masterClose"),bar=desk.querySelector(".masterBar");
  function show(open){
    desk.hidden=!open;notice.hidden=open;notice.setAttribute("aria-expanded",String(open));
    if(open){stop();close.focus({preventScroll:true});}else notice.focus({preventScroll:true});
  }
  notice.onclick=()=>show(true);close.onclick=()=>show(false);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!desk.hidden&&document.body.dataset.module==="station"&&!document.querySelector("dialog[open]"))show(false);});
  let drag;
  function place(x,y){desk.style.left=Math.max(0,Math.min(x,innerWidth-desk.offsetWidth))+"px";desk.style.top=Math.max(0,Math.min(y,innerHeight-desk.offsetHeight))+"px";desk.style.bottom="auto";}
  bar.onpointerdown=e=>{if(innerWidth<=760||e.target.closest("button")||e.button!==0)return;const r=desk.getBoundingClientRect();drag=[e.clientX-r.left,e.clientY-r.top];bar.setPointerCapture(e.pointerId);};
  bar.onpointermove=e=>{if(drag)place(e.clientX-drag[0],e.clientY-drag[1]);};
  bar.onlostpointercapture=()=>{drag=null;};
  window.addEventListener("resize",()=>{if(innerWidth<=760)for(const k of ["left","top","bottom"])desk.style[k]="";else if(!desk.hidden&&desk.style.left){const r=desk.getBoundingClientRect();place(r.left,r.top);}});
  let model=false, run=null, watch=null, answering=false, previous=[];
  const label={risk:"低 pH 预警",watch:"酸化趋势提醒",quiet:"未触发场景预警",unknown:"趋势证据不足"};
  const signed=(n,d)=>Number.isFinite(n)?(n>0?"+":"")+fmt(n,d):"未知";
  const rand=()=>seed.value=crypto.getRandomValues(new Uint32Array(1))[0]>>>1;
  rand(); $("reroll").onclick=()=>{rand();edit();};
  toggle.onchange=()=>{$("seedRow").hidden=!toggle.checked;};
  stationMeta.then(m=>{
    const live=Boolean(m.stationmaster?.feed_pulses);
    toggle.dataset.ready=live?"yes":"no";toggle.disabled=!live||busy;
    $("realismHint").textContent=live?"每次偏差为总进料率的 ±2–5%，持续 1 天。同一种子可复算。":"当前服务没有实时扰动求解；已存记录仍可判读。";
    model=m.stationmaster?.cloud_model?"云端模型":m.stationmaster?.local_model?"本机模型":null;
    $("masterMode").textContent=model==="云端模型"?"云端问答 · 提问时发送问题、仿真摘要与最近对话":model?"本机模型问答":"规则问答 · 未连接语言模型";
  }).catch(()=>{$("realismHint").textContent="未连接实时求解服务。";});
  const point=()=>watch?.history[frame];
  const events=()=>current.trace.events.filter(e=>e.t<=point().day);
  const eventText=e=>e.kind==="feed_pulse"?"第 "+fmt(e.t,1)+"–"+fmt(e.end,1)+" 天进料 "+signed(e.percent,0)+"%（"+fmt(e.total_m3_d,2)+" m³/d）":
    e.kind==="temp_step"?"第 "+fmt(e.t,1)+" 天温度阶跃 "+signed(e.delta_c,1)+" °C":"第 "+fmt(e.t,1)+" 天："+e.kind;
  function evidence(p){
    return "方案 "+current.id+" · 第 "+fmt(p.day,2)+" 天：pH "+fmt(p.ph,3)+"；四酸合计 "+fmt(p.acids,3)+" kg COD/m³。"+
      (p.dp===null?"暂无可比的一日前 pH。":"较 "+fmt(p.span,2)+" 天前，pH "+signed(p.dp,3)+"，四酸 "+signed(p.da,3)+" kg COD/m³。");
  }
  function advice(p){
    if(p.level==="risk" || p.level==="watch")return "请查看本次预警的 72 小时分支结果：各组从同一罐内状态计算，不会改写进料。";
    if(p.level==="unknown")return "先移到一天后的记录，检查是否已有足够数据。";
    return "当前没有触发阈值。可保持原配方，比较有无扰动时的 pH、四酸和产气。";
  }
  const set=(id,s)=>{if($(id).textContent!==s)$(id).textContent=s;};
  function refresh(){
    if(!current)return;
    if(run!==current){run=current;watch=acidWatch(run.trace);}
    const p=point(), recent=events().at(-1), alertIndex=watch.episodes[p.count-1];
    set("masterLevel",label[p.level]);$("masterLevel").dataset.level=p.level;
    set("masterEvidence",evidence(p));
    set("masterPrompt",p.level==="risk"||p.level==="watch"?advice(p)+" 值班提问：四酸和 pH 的变化方向一致吗？":
      recent?"值班提问："+eventText(recent)+"。事件前后，四酸和 pH 是同时变化的吗？":
      "值班提问：同配方下，进料微扰会不会改变 pH 与四酸的趋势？");
    set("masterEvents",(current.config.realism_seed===undefined?"标准模式":"拟真种子 "+current.config.realism_seed)+" · 截至游标："+(events().map(eventText).join("；")||"暂无已发生事件。"));
    $("masterJump").hidden=alertIndex===undefined;
    if(alertIndex!==undefined)set("masterJump","定位最近预警 · 第 "+fmt(run.trace.t[alertIndex],2)+" 天");
    const alarm=p.level==="risk"||p.level==="watch";
    notice.dataset.level=alarm?p.level:"";
    const title="站长 · "+(alarm?label[p.level]:p.count?"已记录 "+p.count+" 次提醒":"值班观察");
    if(notice.textContent!==title)notice.textContent=title;
    if(recoveryRun!==run){recoveryRun=run;reports=new Map();manual=null;}
    const index=manual?.frame===frame?frame:alertIndex;
    $("masterTrial").disabled=!run.trace.branch_id;
    if(index!==undefined)trialAt(index);else set("trialResult","当前游标之前没有酸化预警。");
  }
  window.addEventListener("station-frame",refresh);
  let reports=new Map(),recoveryRun=null,manual=null;
  async function trialAt(index){
    const cache=reports,source=run, stamp="方案 "+run.id+" · 第 "+fmt(run.trace.t[index],2)+" 天";
    if(!run.trace.branch_id){set("trialResult","缺少实时模型状态，无法推演补救措施。");return;}
    if(cache.has(index)){set("trialResult",cache.get(index));return;}
    cache.set(index,stamp+" · 正在计算四种进料量的 72 小时结果…");set("trialResult",cache.get(index));
    try{
      const res=await fetch("/api/stationmaster/trial",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({run_id:source.trace.branch_id,index})});
      const data=await res.json();if(!res.ok)throw Error(typeof data.detail==="string"?data.detail:"推演失败");
      if(!Array.isArray(data.trials))throw Error("请连接新版实时服务");
      const pick=data.trials[data.chosen];
      const lead=pick?(pick.factor===1?"模型支持维持原进料。":"建议模拟料量："+feedText(pick.feed)+"。")+" 72 小时少处理 "+fmt(pick.deferred,2)+" m³。":
        "四档均未满足恢复条件。没有经本模型验证的补救料量；建议复核进料台账、实测 pH 和挥发酸／碱度，再由工艺负责人判定。";
      cache.set(index,stamp+" 起 72 小时 · "+lead+"\n各组固定该时刻温度，不追加扰动，以台账进料为 100%。\n"+
        data.trials.map(v=>Math.round(100*v.factor)+"%：期末 pH "+fmt(v.ph,3)+"，四酸 "+fmt(v.acids,3)+" kg COD/m³").join("\n")+
        "\n场景筛选：末 24 小时记录 pH 均 ≥ 6.5、末值不低于该日起点、四酸不净增。取达标档中处理量最高者。");
    }catch(e){cache.set(index,stamp+" · 补救推演未完成："+e.message+"。没有可采用的建议。");}
    if(run===source)refresh();
  }
  $("masterTrial").onclick=()=>{
    if(!current)return;stop();manual={frame};reports.delete(frame);refresh();
  };
  $("masterJump").onclick=()=>{stop();const i=watch.episodes[point().count-1];if(i!==undefined)setFrame(i);};
  function feedText(feed){return feed.map(f=>feedName(f.substrate_id)+" "+fmt(f.q,1)).join("、")+" m³/d";}
  function context(){
    const draft="当前草稿（尚不代表结果）："+feedText(config().feed)+"，温度 "+$("temp").value+" °C。";
    const check=checkedDraft?"\n进料前："+preflight.textContent:"\n此草稿尚无有效预检。";
    if(!current)return draft+check+" 尚无正式运行记录。";
    const p=point();
    return [draft,"已运行配方："+feedText(current.config.feed)+"，设定温度 "+current.config.temperature_c+" °C。",
      evidence(p),label[p.level],advice(p),$("masterEvents").textContent,$("trialResult").textContent,check,"产气 "+fmt(current.trace.gas[frame],2)+" m³/d，甲烷气量占比 "+$("methane").textContent+"。"].join("\n");
  }
  function local(q){
    if(/进料前|预检|料量合适|能否进料/.test(q))return checkedDraft?preflight.textContent:"请在进料罐点击「站长检查进料量」，先复算当前草稿。";
    if(current && /补救|措施|对策|怎么调|建议|减料/.test(q))return evidence(point())+" "+$("trialResult").textContent;
    if(/草稿|配方|温度|进料率/.test(q) && !/怎么调|建议|风险/.test(q))
      return context().split("\n").slice(0,2).join("\n");
    if(/拟真|扰动|种子/.test(q))return "拟真模式在少数控制周期按相同比例改变三种原料进料率，随后恢复。种子相同且其他条件相同可复算。"+(current?$("masterEvents").textContent:"尚无运行记录。");
    if(/碱度|TAC/i.test(q))return "单罐轨迹提供四酸的 COD 浓度合计，这不是 VFA/TAC。这里没有可供判读的碱度比值。";
    if(/水解|产甲烷|阶段/.test(q))return "水解把大分子转成可利用的小分子；产酸和产乙酸提供中间产物；产甲烷过程利用乙酸或氢等底物。各过程相互耦合，可在罐内观察切换相关状态。";
    if(!current)return "还没有已完成的仿真。先锁定配方并运行，我才能引用这次实验的 pH、四酸和产气记录。";
    const p=point();
    if(/风险|酸|pH|稳定|趋势|依据|原因|为什么|建议|对策|怎么调|下一轮/i.test(q))return label[p.level]+"。"+evidence(p)+" "+advice(p);
    if(/产气|甲烷|气量/.test(q))return "第 "+fmt(p.day,2)+" 天，模型产气速率 "+fmt(current.trace.gas[frame],2)+" m³/d，甲烷占比 "+$("methane").textContent+"。这是游标时刻读数，累计量请看方案对比。";
    if(/对比|基线/.test(q))return "基线是方案 "+baseline.id+"，当前是方案 "+current.id+"。可在方案对比中检查进料、窗口、累计产气和最低 pH。";
    return "本机规则问答暂不能判读这个问题。可以问本轮进料、扰动、pH 趋势、产气或下一轮对照条件。";
  }
  function message(who,s){
    const row=document.createElement("p");row.textContent=who+"："+s;
    const log=$("masterChat");log.append(row);log.scrollTop=log.scrollHeight;
  }
  async function ask(q){
    q=q.trim();if(!q||answering)return;
    stop();const stamp=current?"方案 "+current.id+" · "+fmt(point().day,2)+" d":"未运行";
    const reference=context(), fallback=local(q);
    message("你 · "+stamp,q);$("masterQuestion").value="";
    let answer=fallback, source="站长 · 规则判读";
    if(model){
      answering=true;$("masterForm").querySelector("button").disabled=true;
      try{
        const r=await fetch("/api/stationmaster",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,context:(reference+"\n最近对话："+previous.join("\n")).slice(0,6000)})});
        if(!r.ok)throw Error();const data=await r.json();answer=data.answer;source="站长 · "+model;
      }catch{source="站长 · "+model+"不可用，规则判读";}
      finally{answering=false;$("masterForm").querySelector("button").disabled=false;}
    }
    message(source+" · "+stamp,answer);
    previous=[...previous,stamp+" 问："+q+" 答："+answer].slice(-3);
  }
  $("masterForm").onsubmit=e=>{e.preventDefault();ask($("masterQuestion").value);};
  $("masterQuick").onclick=e=>{if(e.target.tagName==="BUTTON")ask(e.target.textContent);};
})();
