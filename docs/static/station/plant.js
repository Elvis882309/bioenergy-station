/* Industrial scene for the offline anaerobic digestion workbench. */
(() => {
  const viewport = document.getElementById("plantViewport");
  const canvas = document.getElementById("vatScene");
  const reset = document.getElementById("resetView");
  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
  } catch {
    viewport.dataset.render = "preview";
    viewport.querySelector(".viewTools span").textContent = "工艺预览 · 点击设备标记";
    return;
  }
  const compact = matchMedia("(max-width:760px), (pointer:coarse)").matches;
  renderer.setPixelRatio(compact ? .75 : Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .91;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, .1, 100);
  const color = (hex, metalness = 0, roughness = .55) => new T.MeshStandardMaterial({color: hex, metalness, roughness});
  const vec = xyz => new T.Vector3(...xyz);
  const environment = new T.Scene();
  environment.background = new T.Color(0x0d1b27);
  for (const [position, size, intensity] of [
    [[-10, 11, 3], [9, 7], 1.85], [[10, 5, -6], [4, 9], 2.65], [[0, -3, 8], [12, 4], .21]
  ]) {
    const softbox = new T.Mesh(new T.PlaneGeometry(...size), new T.MeshBasicMaterial({color: new T.Color(intensity, intensity, intensity)}));
    softbox.position.set(...position);
    softbox.lookAt(0, 0, 0);
    environment.add(softbox);
  }
  const generator = new T.PMREMGenerator(renderer);
  scene.environment = generator.fromScene(environment, .08).texture;
  generator.dispose();
  scene.add(new T.HemisphereLight(0xbde7ff, 0x4c5361, .38));
  const light = new T.DirectionalLight(0xf7ead6, 1.75);
  light.position.set(-9, 16, 8);
  light.castShadow = true;
  Object.assign(light.shadow.camera, {left: -14, right: 14, top: 13, bottom: -13, near: .5, far: 42});
  light.shadow.mapSize.set(1536, 1536);
  light.shadow.normalBias = .02;
  scene.add(light);
  const rimLight = new T.PointLight(0x27b6e3, 1.4, 38);
  rimLight.position.set(7, 6, -8);
  scene.add(rimLight);

  function surface(kind) {
    const image = document.createElement("canvas");
    image.width = image.height = 256;
    const ctx = image.getContext("2d");
    const data = ctx.createImageData(256, 256);
    let seed = 121;
    function noise() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let y = 0; y < 256; y++) {
      const grain = (noise() - .5) * 30;
      for (let x = 0; x < 256; x++) {
        const n = kind === "metal" ? grain + noise()*11 - 6 : (noise() - .5)*50 + Math.sin(x*.09+y*.03)*9;
        const i = (y*256+x)*4;
        data.data.set([128+n, 128+n, 128+n, 255], i);
      }
    }
    ctx.putImageData(data, 0, 0);
    const tex = new T.CanvasTexture(image);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(kind === "metal" ? 4 : 5, 2);
    return tex;
  }
  const steel = color(0x9faeb3, .84, .30);
  steel.roughnessMap = surface("metal");
  const darkSteel = color(0x47565a, .72, .48);
  const painted = color(0x32666a, .50, .46);
  const membrane = color(0x38494a, .16, .77);
  const yellow = color(0xffbf45, .32, .46);
  const blueSteel = color(0x3a7c9c, .5, .35);
  const gasket = color(0x1b2226, .12, .82);
  const concrete = color(0x586467, .04, .9);
  const concreteScan = new T.TextureLoader().load("/bioenergy-station/static/plant/concrete-floor.jpg", () => render());
  concreteScan.wrapS = concreteScan.wrapT = T.RepeatWrapping;
  concreteScan.repeat.set(3, 2);
  concreteScan.encoding = T.sRGBEncoding;
  concrete.map = concreteScan;
  concrete.bumpMap = surface("concrete");
  concrete.bumpScale = .095;
  const screen = new T.MeshStandardMaterial({color: 0x62cdbd, emissive: 0x58eece, emissiveIntensity: .45});
  const flowMaterial = new T.MeshBasicMaterial({color: 0x8bffe4});
  const gasMaterial = new T.MeshBasicMaterial({color: 0xffd681});

  function mesh(geometry, material, position, parent = scene) {
    const obj = new T.Mesh(geometry, material);
    obj.position.set(...position);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  const box = (position, size, mat, parent) => mesh(new T.BoxGeometry(...size), mat, position, parent);
  const cylinder = (position, top, bottom, height, mat, parent, segments = 64) =>
    mesh(new T.CylinderGeometry(top, bottom, height, segments), mat, position, parent);
  function rod(from, to, radius, mat, parent = scene, segments = 12) {
    const a = vec(from), b = vec(to);
    const part = cylinder(a.clone().lerp(b, .5).toArray(), radius, radius, a.distanceTo(b), mat, parent, segments);
    part.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
    return part;
  }
  function ring(position, radius, tube, material, parent = scene) {
    const part = mesh(new T.TorusGeometry(radius, tube, 8, 64), material, position, parent);
    part.rotation.x = -Math.PI/2;
    return part;
  }
  function assembly(x, z) {
    const part = new T.Group();
    part.position.set(x, 0, z);
    scene.add(part);
    return part;
  }
  function flange(center, direction, radius, parent) {
    const part = new T.Group();
    part.position.set(...center);
    part.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vec(direction).normalize());
    parent.add(part);
    cylinder([0, 0, 0], radius, radius, .09, darkSteel, part);
    for (let i = 0; i < 8; i++) {
      const angle = i*Math.PI/4;
      cylinder([Math.cos(angle)*radius*.79, .06, Math.sin(angle)*radius*.79], .028, .028, .055, steel, part, 6);
    }
  }
  function ladder(x, z, height, parent) {
    for (const side of [-1, 1]) rod([x+side*.20, .25, z], [x+side*.20, height+.31, z], .036, yellow, parent);
    for (let y = .45; y < height; y += .27) rod([x-.2, y, z], [x+.2, y, z], .022, steel, parent);
  }
  function guard(radius, y, parent, skip = false) {
    for (let i = 0; i < 16; i++) {
      if (skip && i === 4) continue;
      const a = i*Math.PI/8;
      rod([radius*Math.cos(a), y-.54, radius*Math.sin(a)], [radius*Math.cos(a), y, radius*Math.sin(a)], .027, yellow, parent);
    }
    ring([0, y, 0], radius, .028, yellow, parent);
    ring([0, y-.24, 0], radius, .022, yellow, parent);
  }
  function plaque(text, position, parent, width) {
    const image = document.createElement("canvas");
    image.width = 384; image.height = 96;
    const ctx = image.getContext("2d");
    ctx.fillStyle = "#183037"; ctx.fillRect(0, 0, 384, 96);
    ctx.strokeStyle = "#6c9092"; ctx.lineWidth = 5; ctx.strokeRect(4, 4, 376, 88);
    ctx.fillStyle = "#e6f5ef"; ctx.font = "bold 42px monospace"; ctx.textAlign = "center";
    ctx.fillText(text, 192, 63);
    const map = new T.CanvasTexture(image); map.encoding = T.sRGBEncoding;
    mesh(new T.PlaneGeometry(width, width/4), new T.MeshBasicMaterial({map}), position, parent);
  }
  const pad = box([0, -.25, 0], [18.3, .5, 8.1], concrete);
  pad.castShadow = false;
  box([0,-.47,0], [18.65,.12,8.45], darkSteel);
  for (const z of [-3.93, 3.93]) {
    box([0, .009, z], [18.15, .015, .034], painted);
    for (let x = -8.6; x < 9; x += .65) box([x, .012, z*.95], [.22, .016, .035], steel);
  }
  for (const x of [-6.1, -3.2, 3.2, 6.1]) box([x, .009, 0], [.021, .016, 7.7], gasket);
  const grid = new T.GridHelper(52, 52, 0x315e6d, 0x1d3946);
  grid.position.y = -.54;
  grid.material.transparent = true;
  grid.material.opacity = .35;
  scene.add(grid);

  const feed = assembly(-5.8, .12);
  cylinder([0, .15, 0], 1.51, 1.6, .30, concrete, feed);
  for (const x of [-.8,.8]) for (const z of [-.61,.61]) box([x,.49,z],[.25,.53,.25],darkSteel,feed);
  cylinder([0, .91, 0], 1.24, .63, .64, darkSteel, feed);
  const feedShell = steel.clone();
  const feedSkin = cylinder([0, 1.98, 0], 1.24, 1.24, 1.52, feedShell, feed);
  const feedLid = cylinder([0, 2.78, 0], .97, 1.25, .23, feedShell, feed);
  for (const y of [1.21, 1.41, 2.14, 2.71]) ring([0, y, 0], 1.246, .032, darkSteel, feed);
  cylinder([0, 3.05, 0], .22, .22, .39, blueSteel, feed, 32);
  cylinder([0, 3.28, 0], .25, .25, .14, darkSteel, feed, 32);
  for (let a = 0; a < 6.27; a += Math.PI/8) {
    const x = .227*Math.cos(a), z = .227*Math.sin(a);
    rod([x, 2.94, z], [x, 3.19, z], .027, darkSteel, feed);
  }
  ladder(.68, 1.13, 2.73, feed);
  guard(1.20, 3.13, feed, true);
  plaque("F  /  01", [-.26, 1.86, 1.23], feed, .72);

  const digester = assembly(.03, -.35);
  cylinder([0, .17, 0], 2.6, 2.7, .34, concrete, digester);
  const digSkin = cylinder([0, 1.49, 0], 2.39, 2.39, 2.48, painted, digester);
  const dome = mesh(new T.SphereGeometry(2.39, 72, 28, 0, 2*Math.PI, 0, Math.PI/2), membrane, [0,2.73,0], digester);
  dome.scale.y = .42;
  for (const y of [.36, .64, 1.23, 1.9, 2.72]) ring([0, y, 0], 2.40, y === 2.72 ? .075 : .038, darkSteel, digester);
  for (let i = 0; i < 12; i++) {
    const az = i*Math.PI/6, x = Math.cos(az), z = Math.sin(az);
    rod([x*2.4,.42,z*2.4],[x*2.4,2.71,z*2.4],.027,darkSteel,digester);
    const points = [];
    for (let s = 0; s <= 12; s++) {
      const t = s*Math.PI/24;
      points.push(new T.Vector3(x*2.404*Math.cos(t), 2.734+1.015*Math.sin(t), z*2.404*Math.cos(t)));
    }
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 16, .018, 6, false), darkSteel, [0,0,0], digester);
  }
  cylinder([0,3.81,0], .41,.46,.16,darkSteel,digester);
  cylinder([0,3.97,0], .19,.19,.23,blueSteel,digester);
  ladder(1.12, 2.19, 2.74, digester);
  box([1.4, 2.71, 1.92], [1.7,.1, .75], darkSteel, digester);
  for (const x of [.69,1.41,2.13]) rod([x,2.76,2.29],[x,3.33,2.29],.027,yellow,digester);
  for (const y of [3.07,3.33]) rod([.66,y,2.29],[2.16,y,2.29],.026,yellow,digester);
  plaque("R  /  01", [-.49,1.6,2.35],digester,1.13);
  for (const x of [-1.02, -.64]) {
    const z = Math.sqrt(2.39**2-x*x);
    flange([x,.8,z],[0,0,1],.18,digester);
    rod([x,.8,z],[x,.8,z+.21],.075,steel,digester);
  }

  function inspectionShell(position, radius, height, parent) {
    const glass = new T.MeshStandardMaterial({color:0x73ddd9, metalness:.23, roughness:.18, transparent:true, opacity:.15, side:T.DoubleSide, depthWrite:false});
    const skin = mesh(new T.CylinderGeometry(radius,radius,height,64,1,true),glass,position,parent);
    skin.castShadow=false;
    return skin;
  }
  const feedInside = new T.Group();
  feed.add(feedInside);
  const feedGlass = inspectionShell([0,1.98,0],1.24,1.52,feedInside);
  const binColors = [0xd0a751,0x885a46,0x75944e];
  const grain = surface("concrete");
  const sectorWidth = Math.PI*2/3;
  const binLabels = ["玉米青贮", "猪粪", "牛粪"];
  const bins = binColors.map((hex,index)=>{
    const startAngle = .45 + index*sectorWidth;
    const sample = new T.Group();
    sample.userData.materialIndex = index;
    feedInside.add(sample);
    const material = color(hex,.02,.94);
    material.bumpMap = grain;
    material.bumpScale = index===0 ? .23 : .1;
    material.emissive.setHex(hex).multiplyScalar(.1);
    const floor = mesh(new T.CylinderGeometry(1.09,1.09,.10,48,1,false,startAngle+.03,sectorWidth-.06),darkSteel,[0,1.29,0],sample);
    floor.castShadow = false;
    const fill = mesh(new T.CylinderGeometry(1.04,1.04,1,48,1,false,startAngle+.055,sectorWidth-.11),material,[0,0,0],sample);
    const fragments = new T.InstancedMesh(new T.DodecahedronGeometry(.065,0),color(new T.Color(hex).multiplyScalar(1.22),.03,.88),45);
    const placement = new T.Object3D();
    for (let i=0;i<45;i++) {
      const angle=startAngle+.12+(sectorWidth-.24)*((i*.6180339)%1);
      const radius=.2+.76*((i*.7548777)%1);
      placement.position.set(Math.sin(angle)*radius,0,Math.cos(angle)*radius);
      placement.rotation.set(i*.51,i*.68,i*.21);
      placement.scale.set(index===0 ? 1.9 : 1,index===0 ? .34 : .61,.7);
      placement.updateMatrix();
      fragments.setMatrixAt(i,placement.matrix);
    }
    fragments.computeBoundingSphere?.();
    sample.add(fragments);
    const divider = box([Math.sin(startAngle)*.56,1.78,Math.cos(startAngle)*.56],[.035,.9,1.12],steel,feedInside);
    divider.rotation.y=startAngle;
    const label=document.createElement("button");
    label.type="button";
    label.className="bin-label";
    label.textContent=binLabels[index];
    label.title="点击加料";
    label.style.borderColor="#"+hex.toString(16);
    label.hidden=true;
    label.onclick=()=>viewport.dispatchEvent(new CustomEvent("material-pick",{detail:index}));
    viewport.append(label);
    return {sample,fill,fragments,label,angle:startAngle+sectorWidth/2};
  });
  let recipe=[1/3,1/3,1/3];
  viewport.addEventListener("feed-mixture",event=>{
    recipe=event.detail;
    bins.forEach(({fill,fragments},index)=>{
      const fraction=event.detail[index];
      const level=fraction*.96;
      fill.scale.y=Math.max(.001,level);
      fill.position.y=1.34+level/2;
      fragments.position.y=1.34+level;
      fragments.visible=fraction>0;
    });
    render(performance.now());
  });
  feedInside.visible=false;

  const housing=new T.Group();
  for(const part of digester.children.slice(1))housing.add(part);
  digester.add(housing);
  const chamber=new T.Group();digester.add(chamber);
  const updateChamber=createReactorSection(T,chamber,{mesh,rod,cylinder,steel,darkSteel,grain,compact});
  const renderLens=reactorLens(T,renderer,compact);
  chamber.visible=false;

  const meter = assembly(5.93, .45);
  box([0,.14,0],[3.7,.28,2.85],concrete,meter);
  for (const x of [-1.61,1.61]) {
    box([x,.34,0],[.125,.14,2.34],darkSteel,meter);
    for (const z of [-1.1,1.1]) box([x,.65,z],[.11,.56,.11],darkSteel,meter);
  }
  cylinder([-.52,1.33,-.23],.63,.63,1.56,steel,meter);
  for (const y of [.56,2.1]) ring([-.52,y,-.23],.635,.05,darkSteel,meter);
  for (const y of [.77,.95,1.83]) ring([-.52,y,-.23],.635,.024,steel,meter);
  cylinder([-.52,2.16,-.23],.51,.63,.18,darkSteel,meter);
  box([.83,1.24,.44],[1.08,1.57,.55],blueSteel,meter);
  box([.83,1.24,.726],[.93,1.39,.055],darkSteel,meter);
  box([.82,1.52,.765],[.61,.32,.033],gasket,meter);
  box([.82,1.52,.788],[.53,.25,.012],screen,meter);
  plaque("CH4", [.83,1.11,.762],meter,.49);
  for (const x of [.61,.82,1.03]) {
    const button = cylinder([x,1.26,.77], .038,.038,.035,x === .61 ? screen : yellow,meter,12);
    button.rotation.x = Math.PI/2;
  }
  rod([-.52,2.22,-.23],[-.52,2.57,-.23],.1,steel,meter);
  rod([-.52,2.57,-.23],[.69,2.57,-.23],.09,steel,meter);
  rod([.69,2.57,-.23],[.69,2.02,-.23],.09,steel,meter);
  flange([-.52,2.31,-.23],[0,1,0],.19,meter);
  flange([.23,2.57,-.23],[1,0,0],.15,meter);

  function conduit(coordinates, casing, lightMat) {
    const curve = new T.CatmullRomCurve3(coordinates.map(vec), false, "centripetal");
    mesh(new T.TubeGeometry(curve, 96, .15, 14, false), casing, [0,0,0]);
    const uniforms={offset:{value:0},strength:{value:.7},tint:{value:lightMat.color}};
    const mat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
      vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 v;uniform float offset,strength;uniform vec3 tint;void main(){float band=smoothstep(.68,.98,fract(v.x*5.-offset));gl_FragColor=vec4(tint*(.65+strength*.45),band*strength);}'});
    const signal=mesh(new T.TubeGeometry(curve,96,.155,12,false),mat,[0,0,0]);
    signal.castShadow=false;signal.renderOrder=5;
    return {signal,uniforms};
  }
  const conduits = [
    conduit([[-4.9,.88,.48],[-4.47,.88,.49],[-4.11,.58,.52],[-3.42,.58,.52],[-2.92,.58,.45],[-2.59,.89,.40],[-2.27,.89,.4]], blueSteel, flowMaterial),
    conduit([[1.79,2.88,-.49],[2.52,2.88,-.49],[2.90,2.69,-.56],[3.86,2.69,-.56],[4.61,2.69,-.48],[5.23,2.16,-.29]], steel, gasMaterial)
  ];
  for (const x of [-3.71,3.92]) {
    const y = x < 0 ? .58 : 2.69;
    box([x,y*.42,-.03],[.14,y*.84,.16],darkSteel);
    flange([x,y,x < 0 ? .52 : -.56],[1,0,0],.206,scene);
  }

  batchPlantHardware(T,housing);
  batchPlantHardware(T,feed,[feedSkin,feedLid]);
  batchPlantHardware(T,meter);
  batchPlantHardware(T,scene);
  const inspectionLight=new T.PointLight(0xffe2b5,1.2,9);
  inspectionLight.position.set(-1.4,3.5,2);scene.add(inspectionLight);inspectionLight.visible=false;
  const labels = [
    ["feedNode", [-5.8,3.79,1.12]],
    ["digNode", [.03,4.47,1.77]],
    ["gasNode", [6.75,2.97,1.19]]
  ];
  const utility=buildEnergyDeck({T,mesh,box,cylinder,rod,ring,plaque,ladder,steel,darkSteel,blueSteel,painted,concrete,yellow});
  const energyScene=new T.Scene();energyScene.environment=scene.environment;
  energyScene.add(new T.HemisphereLight(0xc5e7f3,0x6e695f,1));
  const keyLight=light.clone();energyScene.add(keyLight);energyScene.add(rimLight.clone());
  scene.add(utility.deck);utility.deck.position.set(0,0,-8.2);
  const energyState={selected:"g1",transparent:false,particles:true,values:null,active:false};
  viewport.addEventListener("energy-display",e=>{Object.assign(energyState,e.detail);render(performance.now())});
  const shotPose={x:0,z:0,zoom:0}, poseStart={...shotPose}, poseEnd={...shotPose};
  let poseChangedAt=0, targetKey="";
  viewport.addEventListener("energy-clock",e=>energyState.flowDays=e.detail);
  const energyLabels=[...document.querySelectorAll("[data-pin]")];
  const start = {azimuth: .21, tilt: .42};
  const view = {...start};
  let dragging = null, gestureOrigin = null, width = 1, height = 1;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motion.matches || document.getElementById("static-mode").checked;
  viewport.addEventListener("plant-redraw",()=>render(performance.now()));
  const focus = {x:0,y:1.04,distance:19.6,overview:1};
  const shotTools=document.getElementById("inspectionTools"), shotButton=document.getElementById("previewShot");
  const shotLabel=document.getElementById("shotLabel");
  const yard=viewport.closest(".yard");
  let focusedStation, focusMotion, previewAt=null, playhead=0, gasRate=null, prevTime=0, pipeClock=0;
  const orbit=new T.CatmullRomCurve3([
    new T.Vector3(-.33,-.08,1.03),new T.Vector3(-.20,-.17,.93),
    new T.Vector3(.06,.12,.96),new T.Vector3(.25,-.07,.96),new T.Vector3(.30,-.10,1.27)
  ]);
  const lensPose=new T.Vector3(0,0,1), wanted=new T.Vector3();
  viewport.addEventListener("process-shot",e=>{playhead=e.detail;previewAt=null;});
  viewport.addEventListener("gas-flow",e=>{gasRate=e.detail;});
  shotButton.onclick=()=>{previewAt=previewAt===null?performance.now():null;render(performance.now());};
  motion.addEventListener("change",()=>{previewAt=null;render(performance.now());});
  function refocus() {
    const station=document.body.dataset.station;
    if(station===focusedStation) return;
    focusedStation=station;
    energyState.active=station==="energy";
    (energyState.active?energyScene:scene).add(utility.deck);
    utility.deck.position.z=energyState.active?0:-8.2;
    if(!energyState.active){targetKey="";Object.assign(shotPose,{x:0,z:0,zoom:0});}
    previewAt=null;
    renderer.shadowMap.needsUpdate=true;
    const target=station==="feed" ? {x:-5.8,y:1.96,distance:7.2,overview:0}
      : station==="dig" ? {x:.03,y:1.78,distance:9.1,overview:0}
      : station==="gas" ? {x:6.3,y:1.6,distance:8,overview:0} : {x:0,y:1.04,distance:19.6,overview:1};
    inspectionLight.visible=station==="dig";
    focusMotion?.kill();
    if(!still()&&window.gsap) {
      focusMotion=window.gsap.to(focus,{...target,duration:.75,ease:"power2.inOut",onUpdate:()=>render(performance.now())});
    } else {
      Object.assign(focus,target);
    }
    render(performance.now());
  }
  new MutationObserver(refocus).observe(document.body,{attributes:true,attributeFilter:["data-station"]});
  new MutationObserver(()=>render(performance.now())).observe(viewport.closest(".yard"),{
    attributes:true,attributeFilter:["data-phase","data-reaction"]
  });
  function render(time = 0) {
    const aspect = width/height;
    const now=performance.now(), dt=prevTime?Math.max(0,Math.min(.15,(now-prevTime)/1000)):0;prevTime=now;
    if(energyState.active){
      const nextKey=energyState.inspecting?energyState.selected:"wide";
      if(nextKey!==targetKey){
        targetKey=nextKey;poseChangedAt=now;
        Object.assign(poseStart,shotPose);
        const device=utility.equipment[nextKey];
        Object.assign(poseEnd,device?{x:device.position.x,z:device.position.z,zoom:1}:{x:0,z:0,zoom:0});
      }
      const fraction=still()?1:Math.min(1,(now-poseChangedAt)/800);
      const ease=fraction*fraction*(3-2*fraction);
      for(const k of ["x","z","zoom"])shotPose[k]=T.MathUtils.lerp(poseStart[k],poseEnd[k],ease);
      const {x,z,zoom}=shotPose;
      const dist=T.MathUtils.lerp(Math.max(14.5,30.8/aspect),Math.max(8.4,12/aspect),zoom);
      const tilt=view.tilt+.12-.13*zoom;
      camera.position.set(x+Math.sin(view.azimuth)*Math.cos(tilt)*dist,1.35+Math.sin(tilt)*dist,z+Math.cos(view.azimuth)*Math.cos(tilt)*dist);
      camera.fov=34;camera.updateProjectionMatrix();camera.lookAt(x,1.35,z);camera.updateMatrixWorld();
      utility.update(energyState,still()?0:dt);
      renderer.render(energyScene,camera);
      for(const b of energyLabels){
        if(energyState.inspecting)continue;
        const p=vec(utility.markers[b.dataset.pin]).project(camera);
        b.style.left=((1+p.x)*50)+"%";b.style.top=((1-p.y)*50)+"%";
      }
      return;
    }
    utility.update(energyState,0);
    const digView=focusedStation==="dig";
    const run=yard.dataset.phase==="running";
    if(previewAt!==null && (now-previewAt>=10500 || run || !digView))previewAt=null;
    const preview=previewAt!==null, active=digView && (run||preview) && !still();
    const p=preview?(now-previewAt)/10500:playhead;
    if(digView) orbit.getPoint(Math.max(0,Math.min(1,p)),wanted);
    else wanted.set(0,0,1);
    if(!digView||still())lensPose.copy(wanted);else lensPose.lerp(wanted,1-Math.exp(-dt*5));
    const travel=lensPose;
    const close=digView?1-focus.overview:0;
    const distance = Math.max(focus.distance, (focus.overview*30.4+(1-focus.overview)*7.15)/aspect)*travel.z;
    const baseTilt=view.tilt+.20*(1-focus.overview)-.30*close;
    const tilt=baseTilt+travel.y*.70;
    const az=view.azimuth+travel.x*close;
    const aimX=focus.x+(digView?(-.44+.76*p+1.12*Math.pow(p,5)):0)*close, aimZ=-.35*close;
    camera.position.set(aimX+Math.sin(az)*Math.cos(tilt)*distance,
      Math.sin(tilt)*distance+focus.y+.22,aimZ+Math.cos(az)*Math.cos(tilt)*distance);
    camera.fov=34-close*(active?3.5:1.5);camera.updateProjectionMatrix();
    camera.lookAt(aimX,focus.y,aimZ);camera.updateMatrixWorld();
    const {phase,reaction}=viewport.closest(".yard").dataset;
    const feedOpen=focusedStation==="feed";
    const digOpen=focusedStation==="dig";
    feedInside.visible=feedOpen;
    feedSkin.visible=feedLid.visible=!feedOpen;
    chamber.visible=digOpen;
    housing.visible=!digOpen;
    shotTools.hidden=!digOpen;shotButton.hidden=true;
    const caption=!active?"05 产甲烷罐 · 设备剖面":
      (preview?"镜头预演":"过程示意")+" · "+(p<.23?"混合料入罐":p<.68?"桨叶与浆液环流":"气泡脱离与集气");
    if(shotLabel.textContent!==caption)shotLabel.textContent=caption;
    const btn=preview?"结束预演":"预演反应镜头";if(shotButton.textContent!==btn)shotButton.textContent=btn;
    if(digOpen) updateChamber(still()?0:dt,active,p,recipe);
    const flow=gasRate===null?.65:T.MathUtils.clamp(gasRate/1650,0,2);
    if(!still())pipeClock+=dt;
    conduits.forEach(({signal,uniforms},i)=>{
      const real=phase==="complete" || run && gasRate!==null;
      signal.visible=i===1 ? (phase==="complete" || active&&p>=.68) && (!real || flow>0)
        : phase==="ready" || active&&p<.34;
      const rate=i===1 && real?flow:.7;
      uniforms.offset.value=pipeClock*(.45+rate*.95);
      uniforms.strength.value=Math.min(1,.28+rate*.61);
    });
    if(digOpen)renderLens(scene,camera,distance);else renderer.render(scene,camera);
    for(const {label,angle} of bins){
      label.hidden=!feedOpen || focus.overview>.12;
      label.disabled=phase!=="feed";
      if(label.hidden) continue;
      const point=feed.localToWorld(new T.Vector3(Math.sin(angle)*.76,2.14,Math.cos(angle)*.76)).project(camera);
      label.style.left=(point.x+1)*50+"%";
      label.style.top=(1-point.y)*50+"%";
    }
    for (const [id, point] of labels) {
      const pos = vec(point).project(camera);
      const node = document.getElementById(id);
      node.style.left = Math.max(12,Math.min(87,(pos.x+1)*50))+"%";
      node.style.top = (1-pos.y)*50+"%";
    }
  }
  new ResizeObserver(() => {
    width = viewport.clientWidth; height = viewport.clientHeight;
    renderer.setSize(width,height,false);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    render();
  }).observe(viewport);
  canvas.addEventListener("pointerdown", event => {
    dragging = [event.clientX,event.clientY];
    gestureOrigin = dragging;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!dragging) return;
    view.azimuth = Math.max(-.55,Math.min(.61,view.azimuth-(event.clientX-dragging[0])*.006));
    view.tilt = Math.max(.24,Math.min(.72,view.tilt+(event.clientY-dragging[1])*.005));
    dragging = [event.clientX,event.clientY];
    render(performance.now());
  });
  const raycast = new T.Raycaster();
  const deviceBounds = [feed, digester, meter].map(group => new T.Box3().setFromObject(group));
  canvas.addEventListener("pointerup", event => {
    if (!gestureOrigin || Math.hypot(event.clientX-gestureOrigin[0], event.clientY-gestureOrigin[1]) >= 5) return;
    const rect = canvas.getBoundingClientRect();
    raycast.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2), camera);
    const powerHit=raycast.intersectObjects(Object.values(utility.equipment),true)[0];
    if(energyState.active || (powerHit && focusedStation==="overview" && !raycast.intersectObjects([feed,digester,meter],true).some(h=>h.distance<powerHit.distance))) {
      let part=powerHit?.object;
      while(part && !part.userData.energyKey)part=part.parent;
      if(part) viewport.dispatchEvent(new CustomEvent("energy-pick",{detail:part.userData.energyKey}));
      return;
    }
    if(focusedStation==="feed") {
      const hit=raycast.intersectObjects(bins.map(({sample})=>sample),true)[0];
      if(hit) viewport.dispatchEvent(new CustomEvent("material-pick",{detail:hit.object.parent.userData.materialIndex}));
      return;
    }
    if(focusedStation==="dig") return;
    let nearest = Infinity, device;
    deviceBounds.forEach((bounds, index) => {
      const hit = raycast.ray.intersectBox(bounds, new T.Vector3());
      if (!hit) return;
      const distance = hit.distanceToSquared(camera.position);
      if (distance < nearest) { nearest = distance; device = labels[index][0]; }
    });
    if (device) document.getElementById(device).click();
  });
  canvas.addEventListener("lostpointercapture", () => {dragging = gestureOrigin = null;});
  reset.hidden = false;
  reset.addEventListener("click", () => {Object.assign(view,start);render();});
  viewport.dataset.render = "live";
  let onScreen=true;
  new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;}).observe(viewport);
  let lastFrame = 0;
  function animate(time) {
    if (!still() && onScreen && !document.hidden && time-lastFrame >= (compact?31:14)) {
      if(!document.querySelector("dialog[open]") && (!focusedStation || energyState.active || focusedStation==="dig" || yard.dataset.phase==="complete"))render(time);
      lastFrame = time;
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
