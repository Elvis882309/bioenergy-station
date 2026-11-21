(()=>{
  const routes={trace:"/trace",engine:"/engine",system:"/system",calibration:"/calibration",estimation:"/estimation",dashboard:"/#plant"};
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
          const dest=url.pathname==="/"?(url.hash==="#plant"?"station":"dashboard"):url.pathname.slice(1);
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
