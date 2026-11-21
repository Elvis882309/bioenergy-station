(() => {
  const base = new URL("../",document.currentScript.src);
  const direct = window.fetch.bind(window);
  const catalog = direct(new URL("records/index.json",base)).then(r=>r.json());
  function canonical(v) {
    if(Array.isArray(v))return v.map(canonical);
    if(v && typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
    return v;
  }
  window.fetch=async(input,opts={})=>{
    if(typeof input!=="string" || !input.startsWith("/api/"))return direct(input,opts);
    const query=opts.body?JSON.parse(opts.body):null;
    const key=JSON.stringify(canonical(query));
    const row=(await catalog).find(record=>record.url===input&&JSON.stringify(canonical(record.body))===key);
    if(!row) return Response.json({ok:false,detail:"此工况未收录。公开版可选青贮 11.4、12.4、13.4 m³/d，猪粪 6.1、牛粪 5.0，42 °C，30/150/300 天。自定义工况可运行仓库中的求解服务。"}, {status:422});
    const r=await direct(new URL("records/"+row.file,base));
    if(!r.ok)throw Error("未能加载求解记录");
    const bytes=new Uint8Array(await r.arrayBuffer());
    const payload=(bytes[0]===31 && bytes[1]===139)?new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")):bytes;
    return new Response(payload,{headers:{"Content-Type":input.includes("dashboard-stream")?"application/x-ndjson":"application/json"}});
  };
})();
