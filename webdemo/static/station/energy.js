(()=>{
  const names={g1:"储气一",g2:"储气二",chp:"热电联产机组",h1:"水解罐加热",h2:"主罐加热"};
  const paths={g1:"水解罐 → 储气一 → CHP",g2:"主发酵罐 → 储气二 → CHP",chp:"两路供气 → CHP → 电力与余热",h1:"CHP 余热 → 水解罐换热器",h2:"CHP 余热 → 主发酵罐换热器"};
  const base="75-150-35";
  let key=base,selected="g1",day=0,records,loadPromise,unmount,visible=false,mountedKey;
  let inspecting=false, flowDays=0;
  function caption(){
    vp.dataset.inspecting=String(inspecting);
    const heat=selected.startsWith("h");
    $("shotIndex").textContent=inspecting?(heat?"余热回用":selected==="chp"?"热电转换":"沼气收集"):"工段全景";
    $("shotTitle").textContent=inspecting?paths[selected]:"两路储气汇入热电联产机组";
    $("shotText").textContent=!inspecting?"选择一台设备查看管路。":heat?"橙色管线输送回收热；辅助加热量见右侧读数。":selected==="chp"?"黄色管线为电力输出，橙色管线为余热输出。":$("cutSkin").checked?"透视外膜与侧壁，观察柜内汇气管。":"打开透视气柜，观察汇气管和支管。";
    $("shotTitle").parentElement.style.setProperty("--cue",heat?"#ff9e7a":selected==="chp"?"#ffd98a":"#c8e6b0");
  }
  const api={onPlaying:playing=>$("energyPlay").textContent=playing?"暂停":"播放"};
  const scenario=()=>[$("cap1").value,$("cap2").value,$("heatSetting").value].join("-");
  const val=(c,k)=>records[key][c][k][day];
  const reduced=()=>$("static-mode").checked||matchMedia("(prefers-reduced-motion:reduce)").matches;
  function settings(){
    $("cap1Label").hidden=selected!=="g1";$("cap2Label").hidden=selected!=="g2";$("heatLabel").hidden=selected!=="h2";
    $("cutLabel").hidden=!["g1","g2"].includes(selected);
    $("applyEnergy").disabled=!records || scenario()===key;
  }
  function show(){
    $("energyTitle").textContent=names[selected];$("energyPath").textContent=paths[selected];
    for(const b of document.querySelectorAll("[data-pin]"))b.setAttribute("aria-pressed",b.dataset.pin===selected);
    settings();caption();
    if(!records)return;
    const gkey=selected==="g1"?"hydrolysis_storage":"main_digester_storage";
    const heater=selected==="h1"?"heating_hydro":"heating_main";
    const gas=selected==="g1"||selected==="g2";
    const values=gas?[
      ["柜体容积",+key.split("-")[selected==="g1"?0:1],"m³"],
      ["进气",val(selected==="g1"?"hydrolysis":"main_digester","Q_gas"),"m³/d"],
      ["向 CHP 供气",val(gkey,"Q_gas_supplied_m3_per_day"),"m³/d"],
      ["期末库存",val(gkey,"stored_volume_m3"),"m³"],
      ["当日放散",val(gkey,"vented_volume_m3"),"m³"]
    ]:selected==="chp"?[
      ["耗气",val("chp_1","Q_gas_consumed"),"m³/d"],["发电功率",val("chp_1","P_el"),"kW"],["热功率",val("chp_1","P_th"),"kW"]
    ]:[
      ["目标温度",selected==="h1"?45:+key.split("-")[2],"°C"],
      ["使用 CHP 余热",val(heater,"P_th_used"),"kW"],["辅助加热",val(heater,"P_aux_heat"),"kW"],["合计供热",val(heater,"Q_heat_supplied"),"kW"]
    ];
    $("deviceValues").innerHTML=values.map(([name,v,u])=>"<div><dt>"+name+"</dt><dd>"+fmt(v,2)+" "+u+"</dd></div>").join("");
    const delta=(component,field)=>{
      const difference=val(component,field)-records[base][component][field][day];
      return (difference>0?"+":"")+fmt(difference,2);
    };
    const draft=scenario()!==key?"有待应用的设置。 ":"";
    $("energyDifference").textContent=draft+(key===base?"当前为基线工况。":"较同日基线：发电 "+delta("chp_1","P_el")+" kW，主罐辅助加热 "+delta("heating_main","P_aux_heat")+" kW。");
    $("energyDate").textContent="第 "+records[key].days[day]+" / 30 天";
    $("energyDay").value=day;$("energyPlay").disabled=reduced();
    signal("energy-display",{selected,inspecting,flowDays,transparent:$("cutSkin").checked,particles:$("flowDots").checked,values:{
      g1:val("hydrolysis_storage","Q_gas_supplied_m3_per_day"),g2:val("main_digester_storage","Q_gas_supplied_m3_per_day"),chp:val("chp_1","P_el"),h1:val("heating_hydro","P_th_used"),h2:val("heating_main","P_th_used")
    }});
  }
  function load(){
    if(!loadPromise){
      loadPromise=Promise.all([
        fetch("energy-records.json").then(r=>{if(!r.ok)throw Error("未能读取工况记录");return r.json()}),
        window.mountEnergyFilm?Promise.resolve():new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="film.min.js";script.onload=resolve;script.onerror=()=>reject(Error("未能加载回放器"));document.head.append(script)})
      ]).then(([data])=>records=data).catch(e=>{loadPromise=null;throw e});
    }
    return loadPromise;
  }
  function mount(){
    if(!visible||!records)return;
    if(mountedKey!==key){
      unmount?.();mountedKey=key;
      unmount=window.mountEnergyFilm($("film"),{api,day,record:records[key],baseline:records[base],onFrame:(frame,i,fraction)=>{
        if(!visible)return;
        flowDays=i+fraction;
        signal("energy-clock",flowDays);
        if(i!==day){day=i;show()}
      }});
      api.onPlaying(false);
    }
    show();
  }
  async function changeView(v){
    visible=v==="energy";
    if(!visible){inspecting=false;vp.dataset.inspecting="false";unmount?.();mountedKey=unmount=null;return;}
    show();
    try{await load();mount()}catch(e){$("energyDifference").textContent=e.message+"，请返回全景后重试。"}
  }
  window.addEventListener("station-view",e=>changeView(e.detail));
  function select(id){inspecting=true;selected=id;if(!visible)view("energy");else show();}
  vp.addEventListener("energy-pick",e=>select(e.detail));
  document.querySelectorAll("[data-pin]").forEach(b=>b.onclick=()=>select(b.dataset.pin));
  $("resetView").addEventListener("click",()=>{if(visible){inspecting=false;show()}});
  window.addEventListener("workbench-leave",()=>api.pause?.());
  $("energySettings").onchange=show;
  $("applyEnergy").onclick=()=>{if(!records?.[scenario()])return;key=scenario();flowDays=day;mount()};
  $("energyDay").oninput=()=>{day=Number($("energyDay").value);flowDays=day;api.seek?.(day);show()};
  $("energyPlay").onclick=()=>{if(day===29)api.seek?.(0);api.toggle?.()};
  for(const id of ["cutSkin","flowDots","static-mode"])$(id).addEventListener("change",()=>{if(visible){if(reduced())api.pause?.();show()}});
  if(location.hash==="#energy")view("energy");
})();
