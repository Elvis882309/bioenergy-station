(() => {
  const yard = $("plant"), viewport = $("plantViewport");
  const names = ["玉米青贮", "猪粪", "牛粪"];
  const ids = ["maize_silage_milk_ripeness", "swine_manure", "cattle_manure"];
  let station = "", shotFrame = 0, flow = null;
  const emit = (type, detail) => viewport.dispatchEvent(new CustomEvent(type, {detail}));
  function mixture() {
    const total = state.feeds.reduce((sum, row) => sum + Math.max(0,row.q), 0);
    const shares = ids.map(id => total ? state.feeds.reduce((sum, row) => sum + (row.substrate_id===id ? Math.max(0,row.q):0),0)/total : 0);
    emit("feed-mixture",shares);
    if(station==="feed") {
      const labels = names.map((name,i)=>name+" "+fmt(shares[i]*100,1)+"%");
      const rest=1-shares.reduce((a,b)=>a+b,0);
      if(total && rest>.00001)labels.push("其他 "+fmt(rest*100,1)+"%");
      $("plant-reading").textContent=labels.join(" · ");
    }
  }
  function meter(){
    if(station==="gas") $("plant-reading").textContent="当前沼气 "+fmt(flow,1)+" m³/d · "+$("stamp").textContent;
  }
  function focus(where) {
    cancelAnimationFrame(shotFrame);
    station=where;
    document.body.dataset.station=where;
    yard.dataset.phase=where==="feed"?"feed":where==="gas"&&state.last?"complete":"ready";
    $("overview").hidden=!where;
    const action=$("plant-action");
    action.hidden=!where;
    action.disabled=where==="dig" && $("run").disabled;
    $("plant-status").textContent=({feed:"进料罐 · 点击料仓增加 1 m³/d",dig:"消化罐 · 工艺剖面",gas:"产气计量 · 模型输出"})[where]||"点击设备查看内部";
    $("plant-reading").textContent=where==="dig"?"入料 → 桨叶搅拌与浆液环流 → 气泡上浮与集气":"进料 → 消化 → 集气";
    action.textContent=({feed:"确认配方，进入消化罐",dig:"按当前参数开始仿真",gas:"查看产气曲线"})[where]||"";
    mixture();meter();
  }
  ["feed","dig","gas"].forEach(key=>$(key+"Node").onclick=()=>focus(key));
  $("overview").onclick=()=>focus("");
  $("plant-action").onclick=()=>{
    if(station==="feed")focus("dig");
    else if(station==="dig")$("run").click();
    else $("chart-gas").scrollIntoView({block:"center"});
  };
  viewport.addEventListener("material-pick",event=>{
    if(state.busy||!state.meta)return;
    const id=ids[event.detail];
    if(!id)return;
    let row=state.feeds.find(item=>item.substrate_id===id);
    if(!row){row={substrate_id:id,q:0};state.feeds.push(row);}
    row.q=Math.min(500,(Math.round(row.q*10)+10)/10);
    renderFeeds();
    document.querySelector(".sidebar").dispatchEvent(new Event("input",{bubbles:true}));
  });
  viewport.addEventListener("gas-flow",event=>{flow=event.detail;meter();});
  document.addEventListener("plant-feeds",mixture);
  $("feed-rows").addEventListener("change",mixture);
  document.addEventListener("plant-run",event=>{
    if(!event.detail.manual)return;
    focus("dig");
    if($("static-mode").checked||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
    yard.dataset.phase="running";
    const start=performance.now();
    function advance(now){
      if($("static-mode").checked){focus("dig");return;}
      const t=Math.min(1,(now-start)/7500);
      emit("process-shot",t);
      $("plant-reading").textContent=t<.23?"混合进料进入消化罐":t<.68?"桨叶带动浆液形成环流":"沼气脱离液面，沿集气管进入计量端";
      if(t<1)shotFrame=requestAnimationFrame(advance);
      else focus("gas");
    }
    shotFrame=requestAnimationFrame(advance);
  });
  document.addEventListener("plant-failed",()=>focus("dig"));
  $("static-mode").addEventListener("change",()=>{focus(station);emit("plant-redraw");});
  new MutationObserver(()=>{if(station==="dig")$("plant-action").disabled=$("run").disabled;}).observe($("run"),{attributes:true,attributeFilter:["disabled"]});
  focus("");
})();
