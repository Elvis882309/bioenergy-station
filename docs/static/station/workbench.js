(()=>{
  const routes={trace:"/bioenergy-station/static/trace.html",engine:"/bioenergy-station/static/engine.html",system:"/bioenergy-station/static/system.html",calibration:"/bioenergy-station/static/calibration.html",estimation:"/bioenergy-station/static/estimation.html",dashboard:"/bioenergy-station/static/index.html#plant"};
  const tabs=[...document.querySelectorAll("#moduleTabs [role=tab]")];
  const station=document.getElementById("panel-station");
  let current="station";
  const panel=key=>document.getElementById("panel-"+key);
  const tab=key=>document.getElementById("tab-"+key);
  const frame=key=>panel(key)?.querySelector("iframe");

  function pauseModule(key){
    if(key==="station"){
      stop();
      window.dispatchEvent(new Event("workbench-leave"));
      return;
    }
    const doc=frame(key)?.contentDocument;
    const button=doc?.querySelector(key==="engine"?"#playBtn":"#play");
    const loading=doc?.getElementById("loading");
    if(loading && !loading.classList.contains("hide") && loading.style.display!=="none"){
      if(!loading.dataset.pauseWatch){
        loading.dataset.pauseWatch="1";
        const watcher=new MutationObserver(()=>{
          if(!loading.classList.contains("hide") && loading.style.display!=="none")return;
          watcher.disconnect();delete loading.dataset.pauseWatch;
          if(current!==key || document.getElementById("static-mode").checked)pauseModule(key);
        });
        watcher.observe(loading,{attributes:true,attributeFilter:["class","style"]});
      }
      return;
    }
    if(button && ["❚❚","暂停"].includes(button.textContent.trim()))button.click();
  }

  function mount(key){
    const pane=panel(key);
    if(frame(key))return;
    const status=document.createElement("span");
    status.className="moduleStatus";status.setAttribute("role","status");
    status.textContent="正在打开"+tab(key).textContent+"…";
    const child=document.createElement("iframe");
    child.title=tab(key).textContent;
    child.dataset.uiEmbed="workbench";
    child.addEventListener("load",()=>{
      const doc=child.contentDocument;
      if(!doc?.querySelector("script[src]")){
        status.textContent="界面加载失败。";
        const retry=document.createElement("button");
        retry.textContent="重试";retry.onclick=()=>child.src=routes[key];status.append(retry);return;
      }
      status.remove();
      doc.addEventListener("click",event=>{
        const link=event.target.closest("a[href]");
        if(link){
          const url=new URL(link.href);
          if(url.origin!==location.origin)return;
          const dest=url.pathname==="/bioenergy-station/static/index.html"?(url.hash==="#plant"?"station":"dashboard"):url.pathname.split("/").pop().replace(/\.html$/,"");
          if(dest==="station" || Object.hasOwn(routes,dest)){
            event.preventDefault();activate(dest,true);tab(dest).focus();
          }
          return;
        }
        const button=event.target.closest("button");
        if(current===key && button && event.isTrusted)stationCue(button.id==="run"?"start":"switch");
      },true);
      if(current!==key || document.getElementById("static-mode").checked)pauseModule(key);
    });
    child.src=routes[key];pane.append(status,child);
  }

  function activate(key,push){
    if(key!=="station"&&!Object.hasOwn(routes,key))key="station";
    if(key===current)return;
    pauseModule(current);current=key;
    document.body.dataset.module=key;
    station.classList.toggle("inactiveStation",key!=="station");
    station.inert=key!=="station";station.setAttribute("aria-hidden",String(station.inert));
    for(const button of tabs){
      const selected=button.dataset.module===key;
      button.setAttribute("aria-selected",String(selected));button.tabIndex=selected?0:-1;
      if(button.dataset.module!=="station")panel(button.dataset.module).hidden=!selected;
    }
    if(key!=="station")mount(key);
    if(push){
      const url=new URL(location.href);
      if(key==="station")url.searchParams.delete("view");else url.searchParams.set("view",key);
      history.pushState(null,"",url);
      stationCue("tab");
    }
    window.scrollTo(0,0);
    requestAnimationFrame(()=>frame(key)?.contentWindow?.dispatchEvent(new Event("resize")));
  }

  for(const [i,button] of tabs.entries()){
    button.onclick=()=>activate(button.dataset.module,true);
    button.onkeydown=e=>{
      const indices={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};
      if(!(e.key in indices))return;
      e.preventDefault();const target=tabs[indices[e.key]];target.focus();activate(target.dataset.module,true);
    };
  }
  document.getElementById("static-mode").addEventListener("change",e=>{if(e.target.checked && current!=="station")pauseModule(current)});
  const restore=()=>activate(new URL(location.href).searchParams.get("view")||"station",false);
  document.body.dataset.module=current;
  window.addEventListener("popstate",restore);restore();
})();

/* UI shell adapter (DESIGN.md). Presentation only: reads existing DOM state and window.stationSnapshot(),
   writes data-* attributes / summary text. Never calls station.js functions, never changes values,
   timeline, routes or requests. */
(()=>{
  const root=document.documentElement, $=id=>document.getElementById(id);
  const still=$("static-mode"), reduce=matchMedia("(prefers-reduced-motion: reduce)");
  const syncStill=()=>{root.dataset.uiStill=String(still.checked||reduce.matches);};
  still.addEventListener("change",syncStill);reduce.addEventListener?.("change",syncStill);syncStill();

  const restart=(el,cls)=>{if(root.dataset.uiStill==="true")return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);};

  // Keep the selected module tab inside the horizontally scrollable tab strip.
  const strip=$("moduleTabs");
  const reveal=()=>{
    const t=strip.querySelector("[aria-selected=true]");if(!t)return;
    const l=t.offsetLeft-strip.offsetLeft, r=l+t.offsetWidth;
    if(l<strip.scrollLeft)strip.scrollLeft=Math.max(0,l-12);
    else if(r>strip.scrollLeft+strip.clientWidth)strip.scrollLeft=r-strip.clientWidth+12;
  };
  new MutationObserver(reveal).observe(strip,{subtree:true,attributes:true,attributeFilter:["aria-selected"]});reveal();

  // Readings empty state, playback lock reason and total window, all from the completed run only.
  const aside=document.querySelector("#panel-station aside"), readings=aside.querySelector(".readings"), actions=aside.querySelector(".actions");
  const time=document.querySelector("#panel-station .time"), total=$("timeTotal");
  const syncRun=()=>{
    const snap=window.stationSnapshot?.();
    readings.dataset.uiEmpty=String(!snap);
    time.dataset.uiLocked=String(!snap);
    total.textContent=snap&&Number.isFinite(snap.trace?.days)?" / "+snap.trace.days+" d":"";
    // With a result, readings (no focusable children) move above the operating panel; focus is untouched.
    if(snap&&readings.nextElementSibling!==actions)aside.insertBefore(readings,actions);
  };
  new MutationObserver(syncRun).observe($("record"),{childList:true,characterData:true,subtree:true});
  new MutationObserver(syncRun).observe($("date"),{childList:true,characterData:true,subtree:true});
  syncRun();

  // Status tone from the existing message text (text itself unchanged; tone is presentation only).
  const status=$("status");
  const tone=text=>/^(本次运行未完成|未导入|请至少|阶跃后温度)/.test(text)?"error":/^配方已锁定/.test(text)?"busy":
    /^方案 \d+ 已/.test(text)||/^已导入/.test(text)?"success":/^草稿已修改/.test(text)?"draft":"";
  const syncStatus=()=>{const t=tone(status.textContent.trim());if(t)status.dataset.tone=t;else delete status.dataset.tone;};
  new MutationObserver(syncStatus).observe(status,{childList:true,characterData:true,subtree:true});syncStatus();

  // Draft field cues: changed-from-default marker + one flash when a value is accepted.
  const feed=$("feed"), seen=new Map();
  const fields=()=>[...feed.querySelectorAll("input[type=number]")];
  const scanFields=flash=>{
    for(const el of fields()){
      const label=el.closest("label");if(!label)continue;
      const valid=el.value!==""&&el.checkValidity();
      label.dataset.uiChanged=String(valid&&el.value!==el.defaultValue);
      if(flash&&valid&&seen.has(el)&&seen.get(el)!==el.value)restart(label,"ui-flash");
      seen.set(el,el.value);
    }
  };
  // Advanced conditions summary while collapsed.
  const summary=$("condSummary"), adv=["liq","head","kla"].map($), step=$("eventCase");
  const syncSummary=()=>{
    const changed=adv.some(el=>el.value!==el.defaultValue)||step.checked!==step.defaultChecked;
    summary.textContent="液相 "+adv[0].value+" m³ · 气相 "+adv[1].value+" m³ · kLa "+adv[2].value+" d⁻¹"+(step.checked?" · 第 10 天降温 5 °C":"")+(changed?" · 已改动":" · 默认");
    summary.dataset.changed=String(changed);
  };
  feed.addEventListener("input",()=>{scanFields(true);syncSummary();});
  feed.addEventListener("change",syncSummary);
  $("plantViewport").addEventListener("feed-mixture",()=>scanFields(true));
  scanFields(false);syncSummary();

  // Observation text swap: local fade only, the scene is not replayed.
  const obs=$("observation");let lastObs=obs.textContent;
  new MutationObserver(()=>{const k=obs.textContent.split("　")[0];if(k!==lastObs){lastObs=k;restart(obs,"ui-swap");}}).observe(obs,{childList:true,characterData:true,subtree:true});
})();
