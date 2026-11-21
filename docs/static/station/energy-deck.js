function buildEnergyDeck({T,mesh,box,cylinder,rod,ring,plaque,ladder,steel,darkSteel,blueSteel,painted,concrete,yellow}) {
  const deck=new T.Group(), equipment={}, markers={}, skins=[], highlights={}, flows=[];
  const gasMat=new T.MeshStandardMaterial({color:0x77958a,metalness:.12,roughness:.64});
  const seam=new T.MeshStandardMaterial({color:0x3b574f,metalness:.36,roughness:.56});
  const copper=new T.MeshStandardMaterial({color:0xb46c4d,metalness:.72,roughness:.38});
  const tones={supply:0xc8e6b0,heat:0xff9e7a,power:0xffd98a};
  function equipmentAt(key,x,z,r){
    const g=new T.Group();g.position.set(x,0,z);deck.add(g);equipment[key]=g;
    const halo=ring([0,.07,0],r,.026,new T.MeshBasicMaterial({color:0x89eee1}),g);
    highlights[key]=halo;halo.visible=false;
    return g;
  }
  function tube(points,r,material,group){
    const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,"centripetal");
    mesh(new T.TubeGeometry(path,Math.max(24,points.length*4),r,8,false),material,[0,0,0],group);
    return path;
  }
  function line(key,type,points){
    const material=type==="heat"?copper:darkSteel;
    const path=tube(points,.095,material,deck);
    const lights=new T.InstancedMesh(new T.SphereGeometry(.11,8,6),new T.MeshBasicMaterial({color:tones[type]}),5);
    deck.add(lights);flows.push({key,path,lights,type,clock:0});
  }
  box([0,-.30,0],[17.9,.6,7.6],concrete,deck);
  box([0,-.62,0],[18.2,.1,7.9],darkSteel,deck);
  function gasHolder(key,x,z,r,id){
    const g=equipmentAt(key,x,z,r+.22);
    cylinder([0,.14,0],r+.13,r+.17,.28,concrete,g);
    const side=painted.clone();
    cylinder([0,.72,0],r,r,1,side,g);
    const skin=gasMat.clone();
    const cap=mesh(new T.SphereGeometry(r,48,20,0,2*Math.PI,0,Math.PI/2),skin,[0,1.21,0],g);
    cap.scale.y=.85;skins.push({key,skin},{key,skin:side});
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;
      const points=Array.from({length:11},(_,j)=>{const u=j*Math.PI/20;return [r*1.002*Math.cos(a)*Math.cos(u),1.22+r*.85*Math.sin(u),r*1.002*Math.sin(a)*Math.cos(u)]});
      tube(points,.012,seam,g);
    }
    ring([0,1.2,0],r+.02,.062,steel,g);ring([0,.28,0],r+.02,.05,darkSteel,g);
    cylinder([0,1.25+r*.85,0],.15,.19,.08,steel,g);
    ladder(-r*.42,r*.95,1.22,g);plaque(id,[.32,.76,r+.04],g,.81);
    // Manifold and sampling tap remain visible under the shell.
    rod([0,.32,.04],[0,1.72,.04],.14,steel,g);ring([0,1.48,0],r*.58,.075,blueSteel,g);
    for(const x of [-.46,.46])rod([0,.46,0],[x,.46,r*.88],.075,steel,g);
    markers[key]=[x,1.95+r*.85,z];
  }
  gasHolder("g1",-6,-.65,1.35,"GH / 01");
  gasHolder("g2",-2.25,-.65,1.56,"GH / 02");
  const chp=equipmentAt("chp",1.65,-.75,1.98);
  box([0,.16,0],[3.25,.32,2.5],concrete,chp);
  box([0,1.05,0],[2.95,1.55,2.05],blueSteel,chp);
  box([0,1.90,0],[3.15,.12,2.18],steel,chp);
  for(let j=0;j<12;j++)box([-.98+j*.18,1.04,1.055],[.065,.8,.05],darkSteel,chp);
  for(const x of [-.94,-.34]){
    cylinder([x,2.46,-.55],.14,.14,1.11,steel,chp);
    cylinder([x,3.05,-.55],.19,.17,.10,darkSteel,chp);
  }
  plaque("CHP",[.68,1.59,1.05],chp,.71);markers.chp=[1.65,3.38,-.75];
  function heater(key,x,z,id){
    const g=equipmentAt(key,x,z,1.34);
    box([0,.1,0],[2.3,.2,1.42],concrete,g);
    for(const x of [-.65,.65])box([x,.43,0],[.24,.54,.68],darkSteel,g);
    const shell=cylinder([0,.82,0],.4,.4,1.7,steel,g);shell.rotation.z=Math.PI/2;
    for(const x of [-.9,.9]){
      const flange=cylinder([x,.82,0],.48,.48,.13,copper,g);flange.rotation.z=Math.PI/2;
      for(let i=0;i<8;i++){const a=i*Math.PI/4; const bolt=cylinder([x*1.07,.82+.4*Math.cos(a),.4*Math.sin(a)],.045,.045,.09,darkSteel,g,6);bolt.rotation.z=Math.PI/2}
    }
    tube([[-.6,1.18,0],[-.6,1.53,0],[.32,1.56,0]],.09,copper,g);
    const handle=ring([-.6,1.60,0],.22,.035,yellow,g);
    plaque(id,[0,.8,.425],g,.66);
    markers[key]=[x,2.06,z];
  }
  heater("h1",6.03,-1.80,"HX / 01");heater("h2",5.18,1.75,"HX / 02");
  line("g1","supply",[[-6,.63,.52],[-6,.63,1.55],[-3.6,.58,1.75],[-.3,.58,1.75],[.42,.68,.09]]);
  line("g2","supply",[[-2.25,.64,.90],[-2.25,.65,1.35],[-.55,.7,1.35],[.45,.95,-.03]]);
  line("h1","heat",[[2.98,.8,-1.30],[3.52,.75,-1.3],[3.95,.75,-1.8],[5.13,.82,-1.8]]);
  line("h2","heat",[[2.96,.85,-.20],[3.35,.85,.13],[3.53,.7,1.72],[4.27,.82,1.75]]);
  line("chp","power",[[1.8,.8,-1.78],[1.8,.43,-2.56],[3.58,.37,-3.13],[6.85,.37,-3.13],[7.76,.65,-3.13]]);
  box([7.79,.66,-3.1],[.76,1.32,.60],blueSteel,deck);
  for(const [key,g] of Object.entries(equipment))g.userData.energyKey=key;
  const point=new T.Vector3(),matrix=new T.Matrix4();
  function update({selected,transparent,particles,values,active,flowDays=0,inspecting},dt){
    for(const {key,skin} of skins){
      const cut=active && transparent && key===selected;
      const target=cut?.12:1;
      skin.opacity=dt>0?T.MathUtils.lerp(skin.opacity,target,1-Math.exp(-dt*10)):target;
      const translucent=skin.opacity<.997;
      if(skin.transparent!==translucent){skin.transparent=translucent;skin.depthWrite=!translucent;skin.needsUpdate=true}
    }
    for(const [key,halo] of Object.entries(highlights))halo.visible=active&&selected===key;
    for(const f of flows){
      const value=values?.[f.key];
      f.lights.visible=active && particles && value>0;
      if(!f.lights.visible)continue;
      f.lights.material.transparent=true;
      f.lights.material.opacity=(!inspecting || f.key===selected || selected==="chp")?1:.22;
      // An illustrative phase, indexed by replay time so the same frame is reproducible.
      f.clock=flowDays*.65;
      for(let i=0;i<5;i++){f.path.getPointAt((f.clock+i/5)%1,point);matrix.makeTranslation(point.x,point.y+.055,point.z);f.lights.setMatrixAt(i,matrix);}
      f.lights.instanceMatrix.needsUpdate=true;f.lights.frustumCulled=false;
    }
  }
  return {deck,markers,equipment,update};
}
