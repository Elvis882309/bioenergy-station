/* R-05 sectional exhibit. Distances and the compressed process clock are illustrative. */
function createReactorSection(T, chamber, {mesh, rod, cylinder, steel, darkSteel, grain, compact}) {
  const tau = 2 * Math.PI;
  const radius = 2.28, level = 1.70;
  const alloy = steel.clone();
  alloy.color.setHex(0x88999b);
  alloy.side = T.DoubleSide;
  const lining = new T.MeshStandardMaterial({color:0x202c29, roughness:.54, metalness:.57,
    roughnessMap:grain, side:T.DoubleSide});
  const brass = new T.MeshStandardMaterial({color:0xc69a5e, metalness:.65, roughness:.32});
  const cut = Math.PI*.46, sweep = tau-2*cut;
  const shell = (r,y,h,material) => mesh(new T.CylinderGeometry(r,r,h,72,1,true,cut,sweep),material,[0,y,0],chamber);
  shell(2.38,1.51,2.46,lining);
  for (const y of [.37,1.32,2.72]) shell(2.40,y,.065,alloy);
  // Three's sphere and cylinder use different azimuth origins.
  const roof=mesh(new T.SphereGeometry(2.38,72,24,cut+Math.PI/2,sweep,0,Math.PI/2),lining,[0,2.72,0],chamber);
  roof.scale.y=.42;
  for (const a of [cut,tau-cut]) {
    const x=Math.sin(a), z=Math.cos(a);
    rod([2.39*x,.33,2.39*z],[2.39*x,2.73,2.39*z],.055,brass,chamber);
    const pts=Array.from({length:23},(_,i)=>{
      const t=i*Math.PI/44;
      return new T.Vector3(x*2.39*Math.cos(t),2.72+Math.sin(t),z*2.39*Math.cos(t));
    });
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),26,.045,10),brass,[0,0,0],chamber);
  }
  for(let i=0;i<9;i++){
    const a=cut+sweep*(i+.5)/9;
    rod([2.31*Math.sin(a),.4,2.31*Math.cos(a)],[2.31*Math.sin(a),2.64,2.31*Math.cos(a)],.035,alloy,chamber);
  }
  // Inner weld seams and bolted flanges follow the section instead of crossing the view.
  for(const y of [.84,1.74,2.57]){
    const pts=Array.from({length:49},(_,i)=>{const a=cut+sweep*i/48;return new T.Vector3(2.355*Math.sin(a),y,2.355*Math.cos(a));});
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),60,.018,6),alloy,[0,0,0],chamber);
  }
  const screws=new T.InstancedMesh(new T.CylinderGeometry(.042,.049,.034,6),darkSteel,42);
  const bolt=new T.Object3D();
  for(let i=0;i<42;i++){
    const a=cut+sweep*((i%21)+.5)/21;
    bolt.position.set(2.32*Math.sin(a),i<21?.85:2.57,2.32*Math.cos(a));
    bolt.rotation.set(Math.PI/2,a,0,'YXZ');bolt.updateMatrix();screws.setMatrixAt(i,bolt.matrix);
  }
  chamber.add(screws);
  // Folded, pitched hydrofoil blades on a flanged hub.
  const rotor=new T.Group(); chamber.add(rotor);
  rod([0,.59,0],[0,3.86,0],.077,steel,rotor);
  cylinder([0,1.03,0],.23,.18,.37,brass,rotor);
  cylinder([0,3.74,0],.36,.41,.16,alloy,chamber);
  cylinder([0,3.94,0],.19,.19,.29,darkSteel,chamber);
  const bladeContour=new T.Shape();
  bladeContour.moveTo(.15,-.09); bladeContour.bezierCurveTo(.48,-.20,.94,-.36,1.35,-.23);
  bladeContour.quadraticCurveTo(1.49,-.14,1.4,.08);
  bladeContour.bezierCurveTo(1.11,.34,.61,.22,.15,.12); bladeContour.closePath();
  const foil=new T.ExtrudeGeometry(bladeContour,{depth:.038,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:2,curveSegments:12});
  foil.rotateX(-1.04);
  for(let i=0;i<3;i++){
    const blade=mesh(foil,alloy,[0,1.03,0],rotor); blade.rotation.y=i*tau/3;
  }
  const volume=new T.MeshPhysicalMaterial({color:new T.Color(.042,.029,.010),metalness:.01,roughness:.63,transparent:true,
    opacity:.50,side:T.FrontSide,depthWrite:false,clearcoat:.03});
  const side=mesh(new T.CylinderGeometry(radius,radius,level-.34,80,1,true),volume,[0,(level+.34)/2,0],chamber);
  side.castShadow=false; side.renderOrder=3;
  cylinder([0,.36,0],radius,radius,.05,lining,chamber);

  // Polar mesh: actual surface depression plus two advected scales of detail in the PBR lighting.
  const pts=[],uv=[],indices=[],rings=compact?18:36,segs=compact?64:112;
  for(let j=0;j<=rings;j++) for(let i=0;i<=segs;i++){
    const r=radius*j/rings,a=tau*i/segs,x=r*Math.sin(a),z=r*Math.cos(a);
    pts.push(x,0,z); uv.push(x/5+.5,z/5+.5);
    if(j&&i){const k=j*(segs+1)+i;indices.push(k-segs-2,k-1,k,k-segs-2,k,k-segs-1);}
  }
  const surfGeo=new T.BufferGeometry();
  surfGeo.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  surfGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); surfGeo.setIndex(indices);surfGeo.computeVertexNormals();
  const wet=new T.MeshPhysicalMaterial({color:new T.Color(.044,.035,.009),roughness:.39,metalness:.02,clearcoat:.14,
    clearcoatRoughness:.38,side:T.DoubleSide,transparent:true,opacity:.94,depthWrite:false});
  const clock={value:0}, energy={value:0};
  wet.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{uRotor:energy,uClock:clock,uGrain:{value:grain}});
    s.vertexShader='uniform float uRotor,uClock; varying vec2 vBath;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vBath=position.xz; float r=length(vBath); float a=atan(vBath.y,vBath.x+.00001);
      transformed.y+=uRotor*(-.43*exp(-r*r/.54)+.028*sin(3.*a+r*6.+uClock*1.7)*smoothstep(.02,.4,r));
    `);
    s.fragmentShader='uniform float uRotor,uClock; uniform sampler2D uGrain; varying vec2 vBath;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float r=length(vBath); float a=atan(vBath.y,vBath.x+.00001);
      float w=a+2.*r-uClock*.31;
      vec2 drift=vec2(cos(w),sin(w))*r;
      float fine=texture2D(uGrain,drift*.53+uClock*.014).r;
      float broad=texture2D(uGrain,drift*.09-uClock*.008).r;
      float striation=sin(r*16.+3.*a+3.4*sin(w+2.*r)+broad*9.);
      diffuseColor.rgb*=.83+.32*fine+.20*striation*uRotor;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float grad=.43*uRotor*exp(-r*r/.54)*2./.54;
      vec2 slope=vBath*grad+(.005+.046*uRotor)*vec2(sin(w+fine*3.),cos(w+broad*3.))*striation;
      normal=normalize(mat3(viewMatrix)*vec3(-slope.x,1.,-slope.y));
    `);
  };
  const top=mesh(surfGeo,wet,[0,level,0],chamber);
  top.castShadow=false;top.renderOrder=2;

  // A toroidal flow field. Each tracer follows a closed axial/radial loop while rotating with the shaft.
  const count=compact?620:2350;
  const seed= n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const data=new Float32Array(count*3);
  for(let i=0;i<count;i++){data[i*3]=seed(i+.1);data[i*3+1]=seed(i+.2);data[i*3+2]=seed(i+.3);}
  const fieldGeo=new T.BufferGeometry();fieldGeo.setAttribute('position',new T.BufferAttribute(data,3));
  const field=new T.Points(fieldGeo,new T.ShaderMaterial({uniforms:{t:clock,power:energy},
    vertexShader:`uniform float t,power;varying float fade; void main(){
      float p=position.x*6.283+t*(.54+.34*position.y);
      float r=1.15+(.43+.52*position.y)*cos(p);
      float a=position.z*6.283+t*(.75+1.35/(.5+r));
      vec3 q=vec3(r*cos(a),1.+(.18+.36*position.y)*sin(p),r*sin(a));
      vec4 mv=modelViewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((2.+position.y*7.)/(-mv.z),1.,3.);
      fade=(.12+.68*position.y)*power;
    }`,
    fragmentShader:`varying float fade;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.88,.74,.39,fade*(1.-smoothstep(.12,.5,d)));}`,
    transparent:true,depthWrite:false}));
  field.frustumCulled=false;field.renderOrder=1;chamber.add(field);

  // Three short wakes trail the tips in the direction opposite blade travel.
  const wakeMaterial=new T.MeshBasicMaterial({color:0xc8a967,transparent:true,opacity:.24,side:T.DoubleSide,depthWrite:false});
  for(let blade=0;blade<3;blade++){
    const v=[],ix=[];
    for(let j=0;j<=30;j++){
      const u=j/30,a=blade*tau/3+u*1.5,r=1.26+u*.45;
      for(const d of [-1,1])v.push(Math.cos(a)*r,1.06+.13*u+.022*d*(1-u),Math.sin(a)*(r+d*.035*(1-u)));
      if(j){const k=j*2;ix.push(k-2,k-1,k,k,k-1,k+1);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);
    const trail=new T.Mesh(g,wakeMaterial);rotor.add(trail);
  }
  // Size-dependent buoyancy; wall sites pin, paired nuclei merge, then pop at the local surface.
  const N=compact?28:68, obj=new T.Object3D();
  const bubbles=new T.InstancedMesh(new T.SphereGeometry(1,12,8),
    new T.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:`varying vec3 n,v;void main(){
        vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);
        n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;
      }`,
      fragmentShader:`varying vec3 n,v;void main(){
        vec3 N=normalize(n);float edge=pow(1.-max(0.,dot(normalize(v),N)),2.);
        float glint=pow(max(0.,dot(N,normalize(vec3(-.42,.73,.60)))),19.);
        gl_FragColor=vec4(mix(vec3(.21,.25,.14),vec3(.94,.93,.73),clamp(edge+glint,0.,1.)),.14+.54*edge+.30*glint);
      }`}),N*2);
  const foam=new T.InstancedMesh(new T.TorusGeometry(1,.045,4,32),
    new T.MeshBasicMaterial({color:0xe5d6a7,transparent:true,opacity:.64,depthWrite:false}),N);
  bubbles.renderOrder=1;foam.renderOrder=4;chamber.add(bubbles,foam);
  const nuclei=Array.from({length:N},(_,i)=>({a:tau*seed(i+8.1),r:.037+.052*seed(i+5.7),
    orbit:i%4===0?2.17:.4+1.66*seed(i+3.5), delay:i%4===0?.62:.12,phase:seed(i+1.3)}));
  function instance(batch,i,x,y,z,size,stretch=1,flat=false){
    obj.position.set(x,y,z);obj.rotation.set(flat?-Math.PI/2:0,0,0);
    obj.scale.set(size,flat?size:size*stretch,size);obj.updateMatrix();batch.setMatrixAt(i,obj.matrix);
  }
  // Small side-mounted inlet visible through the cut. Flakes and clumps share the locked volumetric recipe.
  const nozzle=mesh(new T.CylinderGeometry(.18,.18,.60,30,1,true),alloy,[-1.96,2.03,-.44],chamber);
  nozzle.rotation.z=1.18;
  const chipShape=new T.Shape();chipShape.moveTo(-.09,-.016);chipShape.quadraticCurveTo(.01,-.04,.105,.016);
  chipShape.lineTo(.065,.04);chipShape.lineTo(-.075,.011);chipShape.closePath();
  const chip=new T.ExtrudeGeometry(chipShape,{depth:.012,bevelEnabled:false});
  const lump=new T.IcosahedronGeometry(.062,1);
  const vs=lump.attributes.position;
  for(let i=0;i<vs.count;i++){const x=vs.getX(i),y=vs.getY(i),z=vs.getZ(i),s=1+.16*Math.sin(x*59+y*42-z*32);vs.setXYZ(i,x*s,y*s*.76,z*s);}
  lump.computeVertexNormals();
  const chunks=[0xbca443,0x65503e,0x796547].map((c,i)=>{
    const b=new T.InstancedMesh(i?lump:chip,new T.MeshStandardMaterial({color:c,roughness:i?.31:.76,side:T.DoubleSide}),60);
    b.material.color.convertSRGBToLinear();
    b.frustumCulled=false;chamber.add(b);return b;
  });
  const inletSpray=new T.InstancedMesh(new T.SphereGeometry(1,7,5),volume.clone(),18);
  inletSpray.material.opacity=.72;inletSpray.renderOrder=4;chamber.add(inletSpray);
  const headGeo=new T.BufferGeometry();
  const strands=compact?12:25;
  const head=new Float32Array(strands*6);headGeo.setAttribute('position',new T.BufferAttribute(head,3));
  const headFlow=new T.LineSegments(headGeo,new T.LineBasicMaterial({color:0xe4be76,opacity:.33,transparent:true,depthWrite:false}));
  headFlow.frustumCulled=false;chamber.add(headFlow);
  const gasGlow=new T.PointLight(0xffc885,.29,7);gasGlow.position.set(-.82,2.22,1.24);chamber.add(gasGlow);
  const soft=new T.PointLight(0xcce8f2,.25,8);soft.position.set(1.42,3.34,.78);chamber.add(soft);
  let angle=0, speed=0, age=0;
  return function update(dt,active,progress,shares){
    const target=active?1:0;
    speed+=(target-speed)*(1-Math.exp(-dt*1.55));
    clock.value+=dt*speed;energy.value=speed;age+=active?dt:0;
    angle+=dt*speed*tau*1.8;rotor.rotation.y=angle;
    wakeMaterial.opacity=speed*.26;
    field.visible=speed>.015;
    headFlow.visible=active && progress>=.68;
    if(headFlow.visible){
      for(let j=0;j<strands;j++)for(let k=0;k<2;k++){
        const u=Math.min(1,(age*.49+seed(j+7))%1+k*.045),q=1-u,a=seed(j+.3)*tau;
        const idx=(j*2+k)*3;
        head[idx]=q*1.37*Math.sin(a)+u*1.8;
        head[idx+1]=q*q*(level+.06)+(1-q*q)*2.88;
        head[idx+2]=q*1.29*Math.cos(a)-u*.15;
      }
      headGeo.attributes.position.needsUpdate=true;
    }
    bubbles.visible=foam.visible=active && progress>=.28;
    if(bubbles.visible){
      for(const [i,b] of nuclei.entries()){
        const bottom=.49, topY=level-speed*.43*Math.exp(-b.orbit*b.orbit/.54);
        const rise=(topY-bottom)/(.15+95*b.r*b.r);
        const cycle=rise+b.delay+.48, t=(age+b.phase*cycle)%cycle;
        const u=Math.min(1,Math.max(0,(t-b.delay)/rise)),pop=Math.max(0,(t-b.delay-rise)/.48);
        const a=b.a+u*.40+.023*Math.sin(i+u*11),x=Math.cos(a)*b.orbit,z=Math.sin(a)*b.orbit;
        const y=bottom+u*(topY-bottom),k=pop>0?0:b.r*(.65+.35*Math.min(1,t/b.delay));
        instance(bubbles,i*2,x,y,z,k*(u>.56?1.12:1),1-.12*u);
        instance(bubbles,i*2+1,x+.11*Math.max(0,1-u/.56),y-.032,z,u<.56?k*.73:0);
        instance(foam,i,x,topY+.025,z,pop>0?.018+.19*Math.sin(Math.PI*pop):0,1,true);
      }
      bubbles.instanceMatrix.needsUpdate=foam.instanceMatrix.needsUpdate=true;
    }
    const feeding=active && progress<.33;
    inletSpray.visible=feeding;
    if(feeding){
      for(let i=0;i<18;i++){
        const t=(age*1.9+seed(i))%1,a=i*2.39996,r=.045+t*.17;
        instance(inletSpray,i,-1.24+r*Math.cos(a),level+.73*t*(1-t),-.32+r*Math.sin(a),.025*(1-t),1.8);
      }
      inletSpray.instanceMatrix.needsUpdate=true;
    }
    const used=[0,0,0];
    if(feeding) for(let i=0;i<60;i++){
      const roll=seed(i+.72), b=roll<shares[0]?0:roll<shares[0]+shares[1]?1:2;
      if(roll>=shares[0]+shares[1]+shares[2])continue;
      const u=(age*.77+seed(i+.83))%1, k=.52+seed(i+.91);
      obj.position.set(-1.73+u*(.83+.20*seed(i+2)),1.98+.08*u-1.22*u*u,-.44+.28*(seed(i+1)-.5)+u*.25);
      obj.scale.setScalar(k*Math.min(1,(1-u)*9));obj.rotation.set(u*8+i,u*4+i,u*7);obj.updateMatrix();chunks[b].setMatrixAt(used[b]++,obj.matrix);
    }
    chunks.forEach((b,i)=>{b.count=used[i];b.visible=used[i]>0;if(b.visible)b.instanceMatrix.needsUpdate=true;});
  };
}

/* Combine unmoving pieces sharing material within the same visibility group. */
function batchPlantHardware(T,parent,exclude=[]){
  const buckets=new Map();
  for(const m of parent.children){
    if(!m.isMesh || m.isInstancedMesh || exclude.includes(m) || m.material.transparent) continue;
    const key=m.material.uuid+'-'+m.castShadow+'-'+m.receiveShadow;
    if(!buckets.has(key)) buckets.set(key,[]); buckets.get(key).push(m);
  }
  for(const parts of buckets.values()){
    if(parts.length<2) continue;
    const xyz=[],norm=[],uv=[];
    for(const part of parts){
      part.updateMatrix();
      const geom=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
      geom.applyMatrix4(part.matrix);
      for(const [name,to] of [['position',xyz],['normal',norm],['uv',uv]]){
        const attr=geom.attributes[name];
        if(attr)for(const v of attr.array)to.push(v);
      }
      geom.dispose();parent.remove(part);
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));
    if(uv.length===xyz.length/3*2)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    const baked=new T.Mesh(geo,parts[0].material);baked.castShadow=parts[0].castShadow;baked.receiveShadow=parts[0].receiveShadow;parent.add(baked);
  }
}

// One screen pass for contact occlusion, focus falloff, and highlight bloom.
// Mobile omits depth reads. The rest of the workbench renders directly to the canvas.
function reactorLens(T,renderer,compact){
  const depth=!compact && (renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture'));
  const rt=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter});
  rt.texture.encoding=T.sRGBEncoding;
  if(depth)rt.depthTexture=new T.DepthTexture(1,1,T.UnsignedShortType);
  const uniforms={frame:{value:rt.texture},depthMap:{value:rt.depthTexture},pixel:{value:new T.Vector2()},focus:{value:8}};
  const mat=new T.ShaderMaterial({uniforms,defines:depth?{DEPTH_LENS:1}:{},depthWrite:false,depthTest:false,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 v;uniform sampler2D frame,depthMap;uniform vec2 pixel;uniform float focus;
    float zAt(vec2 p){float d=texture2D(depthMap,p).r;return 10./(100.-d*99.9);}
    void main(){
      vec3 src=texture2D(frame,v).rgb, glow=vec3(0.), blurred=vec3(0.);float occ=0.;
      #ifdef DEPTH_LENS
      float z=zAt(v),blur=clamp((abs(z-focus)-1.75)*.75,0.,3.5);
      #endif
      for(int i=0;i<8;i++){
        float a=float(i)*.785398;vec2 dir=vec2(cos(a),sin(a))*pixel;
        glow+=max(texture2D(frame,v+dir*3.8).rgb-.67,0.);
        #ifdef DEPTH_LENS
        float dz=z-zAt(v+dir*4.);
        occ+=smoothstep(.015,.19,dz)*(1.-smoothstep(.35,.85,dz));
        blurred+=texture2D(frame,v+dir*blur).rgb;
        #endif
      }
      #ifdef DEPTH_LENS
      src=mix(src,blurred*.125,smoothstep(0.,1.,blur))*(1.-occ*.032);
      #endif
      float vignette=smoothstep(.24,.78,length(v-.5));
      gl_FragColor=vec4((pow(max(src,vec3(0.)),vec3(1.24,1.27,1.30))+glow*.022)*(1.-vignette*.13),1.);
    }`});
  const quad=new T.Scene();quad.add(new T.Mesh(new T.PlaneGeometry(2,2),mat));const flat=new T.Camera();
  const size=new T.Vector2();
  return (scene,camera,distance)=>{
    renderer.getDrawingBufferSize(size); if(rt.width!==size.x||rt.height!==size.y)rt.setSize(size.x,size.y);
    uniforms.pixel.value.set(1/size.x,1/size.y);uniforms.focus.value=distance;
    renderer.setRenderTarget(rt);renderer.setClearColor(0x0d1b24,1);renderer.render(scene,camera);
    renderer.setRenderTarget(null);renderer.render(quad,flat);renderer.setClearColor(0x000000,0);
  };
}
