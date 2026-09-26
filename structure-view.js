import * as THREE from './assets/three.module.js';
import {compileDesign} from './design-engine.js';
import {zipFiles} from './bundle.js';
import {requestMesh} from './mesh-client.js';
import {configureRenderer,studioEnvironment,cyclorama,studioLights,geometryFrom,knitMaps,fabricMaps,yarnMaterial,mannequinMaterial,clothMaterial} from './studio.js';

// Dressed mannequin whose sweater geometry comes from the compiled design: body circumference,
// length, per-round sleeve radii, rib cuffs and hem. Meshes are built in a worker and kept for
// the last few designs, so switching preview tabs or versions back does not rebuild them.
const built=new Map();
function outfitFor(project){
  const key=JSON.stringify([project.design,project.gauge,project.profile]);
  if(!built.has(key)){
    const job=requestMesh({type:'outfit',project});built.set(key,job);job.catch(()=>built.delete(key));
    if(built.size>3)built.delete(built.keys().next().value);
  }
  return built.get(key);
}
export function createAvatar(container,project,onSelectSleeve){
  const plan=compileDesign(project);
  if(!plan.valid){container.innerHTML='<div class="empty"><h3>수정 조건을 조정해 주세요</h3><p>줄임 규칙이 성립하는 조건에서 360도 형태를 만듭니다.</p></div>';return{dispose(){}};}
  const d=project.design,s=plan.sleeve,H=project.profile.height/100,fit=Math.max(1,H/1.75),materials=new Set(),geometries=new Set(),textures=new Set();
  const BG='#f3f1f6';
  const scene=new THREE.Scene();scene.background=new THREE.Color(BG);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});configureRenderer(renderer);container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',`설계 ${plan.id}, 소매 ${s.totalRows}단으로 생성한 360도 구조`);
  const envTarget=studioEnvironment(renderer);scene.environment=envTarget.texture;
  const backdrop=cyclorama(BG);scene.add(backdrop);geometries.add(backdrop.geometry);materials.add(backdrop.material);
  studioLights(scene,{target:[0,.9*H/1.65,0],span:1.05*fit});
  const camera=new THREE.PerspectiveCamera(32,1,.05,20);
  const model=new THREE.Group();scene.add(model);
  const track=(m)=>{materials.add(m);for(const t of[m.map,m.normalMap])if(t)textures.add(t);return m;};
  const knit=track(yarnMaterial(d.color,knitMaps(renderer,'stockinette'))),rib=track(yarnMaterial(d.trim,knitMaps(renderer,'rib')));
  const skin=track(mannequinMaterial()),pants=track(clothMaterial('#57575e',fabricMaps(renderer,1)));
  const shoes=track(new THREE.MeshPhysicalMaterial({color:'#f6f3ec',roughness:.5,clearcoat:.2,clearcoatRoughness:.4,vertexColors:true,envMapIntensity:.8}));
  const surfaces=[],sleeves=[],markers=[];
  const ids={body:'#b28af4','sleeve-left':'#69bbbd','sleeve-right':'#77a2ed',cuff:'#ed9d59',collar:'#edcf6c',human:'#526172'};
  const normal=new THREE.MeshNormalMaterial();normal.toneMapped=false;materials.add(normal);
  const depth=new THREE.ShaderMaterial({uniforms:{nearZ:{value:.1},farZ:{value:5}},vertexShader:'varying float z; void main(){vec4 p=modelViewMatrix*vec4(position,1.);z=-p.z;gl_Position=projectionMatrix*p;}',fragmentShader:'varying float z;uniform float nearZ;uniform float farZ;void main(){float d=1.-clamp((z-nearZ)/(farZ-nearZ),0.,1.);gl_FragColor=vec4(vec3(d),1.);}'});materials.add(depth);
  const masks=Object.fromEntries(Object.entries(ids).map(([k,color])=>{const m=new THREE.MeshBasicMaterial({color,toneMapped:false});materials.add(m);return[k,m];}));
  function add(data,material,region,{sleeve=false,shadow=true}={}){
    const geo=geometryFrom(data);geometries.add(geo);
    const m=new THREE.Mesh(geo,material);m.castShadow=shadow;m.receiveShadow=true;m.userData={surface:material,region};
    model.add(m);surfaces.push(m);if(sleeve)sleeves.push(m);return m;
  }
  let mode='surface',disposed=false,frame,auto=false,drag=null,exporting=false,zoomDistance=3.6,pinchDistance=0,dirty=true,interacting=0,ratioScale=1,slowFrames=0;
  let resolveReady,rejectReady;const ready=new Promise((a,b)=>{resolveReady=a;rejectReady=b;});ready.catch(()=>{});
  const pointers=new Map();
  const loading=document.createElement('div');loading.className='model-loading';loading.setAttribute('role','status');loading.textContent='도안 수치로 3D 모델을 만드는 중이에요';container.append(loading);
  // pass the design as stored: a measured sleeve revision is bound to a fingerprint of all fields
  outfitFor({design:project.design,gauge:project.gauge,profile:project.profile}).then(r=>{
    if(disposed)return;
    if(r.invalid)throw new Error('invalid plan');
    add(r.skin,skin,'human');add(r.trousers,pants,'human');add(r.sneakers,shoes,'human');
    const sw=r.sweater;
    add(sw.parts.body,knit,'body');
    add(sw.parts['sleeve-left'],knit,'sleeve-left',{sleeve:true});add(sw.parts['sleeve-right'],knit,'sleeve-right',{sleeve:true});
    add(sw.bands.hem,rib,'cuff');add(sw.bands.collar,rib,'collar');sw.bands.cuffs.forEach(c=>add(c,rib,'cuff',{sleeve:true}));
    // lifeline: a contrasting safety thread through the kept round, as knitters thread one
    const thread=track(new THREE.MeshStandardMaterial({color:'#e2b24f',roughness:.55,emissive:'#6b4a0c',emissiveIntensity:.35}));
    for(const loop of sw.loops){
      const curve=new THREE.CatmullRomCurve3(loop.map(p=>new THREE.Vector3(...p)),true),geo=new THREE.TubeGeometry(curve,loop.length*2,.0014,6,true);
      geometries.add(geo);const marker=new THREE.Mesh(geo,thread);marker.castShadow=false;model.add(marker);markers.push(marker);
    }
    setMode(mode);loading.remove();container.dataset.modelReady='true';dirty=true;resolveReady();
  }).catch(error=>{
    if(disposed)return;
    console.error('3D model:',error);loading.textContent='3D 모델을 만들지 못했어요. 새로고침하거나 다른 탭을 이용해 주세요.';rejectReady(error);
  });
  function setZoom(distance){
    zoomDistance=Math.max(.68,Math.min(3.6,distance));
    // full figure (shoes clear of the stage caption) at the widest view, chest when zoomed in
    // portrait stages (phones) carry overlays top and bottom, so step back a little further
    const progress=(3.6-zoomDistance)/(3.6-.68),h=fit*Math.min(1,H/1.65+.08),portrait=Math.min(1,Math.max(0,(1-camera.aspect)/.25))*(1-progress);
    camera.position.set(0,(1.02+.18*progress)*h,zoomDistance*1.08*fit*(1+.13*portrait));camera.lookAt(0,(.8-.02*portrait+.32*progress)*h,0);
    dirty=true;return zoomDistance;
  }
  function zoomBy(direction){return setZoom(zoomDistance*Math.pow(.72,direction));}
  function pointerSpan(){const [a,b]=[...pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
  const abort=new AbortController(),signal=abort.signal;
  function setMode(value){
    mode=value;
    surfaces.forEach(m=>{m.material=value==='surface'?m.userData.surface:value==='parts'?masks[m.userData.region]:value==='normal'?normal:depth;});
    markers.forEach(m=>m.visible=value==='surface'&&!exporting);backdrop.visible=value==='surface';
    scene.background=new THREE.Color(value==='surface'?BG:'#000000');dirty=true;
  }
  function pixelRatio(w,ht){return Math.max(1,Math.min(3,Math.max(2,window.devicePixelRatio||1),Math.sqrt(5000000/(w*ht)),renderer.capabilities.maxTextureSize/Math.max(w,ht)));}
  function resize(){
    if(exporting||disposed)return;
    const w=Math.max(1,container.clientWidth),ht=Math.max(1,container.clientHeight);
    renderer.setPixelRatio(Math.max(1,pixelRatio(w,ht)*ratioScale));renderer.setSize(w,ht);camera.aspect=w/ht;camera.updateProjectionMatrix();setZoom(zoomDistance);
  }
  const observer=new ResizeObserver(resize);observer.observe(container);setZoom(3.6);resize();
  // Renders only when something changed; lowers resolution while moving if frames get slow.
  let lastFrame=0;
  function draw(now=performance.now()){
    if(disposed)return;
    if(!exporting){
      const moving=(auto&&pointers.size===0)||interacting>now;
      if(auto&&pointers.size===0){model.rotation.y+=.006;dirty=true;}
      // frame-to-frame time includes GPU work; persistent slow frames lower the resolution
      if(moving&&lastFrame){slowFrames=now-lastFrame>42?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>5&&ratioScale>.45){ratioScale*=.8;slowFrames=0;resize();}}
      if(!moving&&ratioScale<1&&interacting+400<now){ratioScale=1;slowFrames=0;resize();}
      if(dirty){renderer.render(scene,camera);dirty=false;}
      lastFrame=moving?now:0;
    }
    frame=requestAnimationFrame(draw);
  }
  draw();
  const touch=()=>{interacting=performance.now()+250;dirty=true;};
  container.tabIndex=0;container.style.touchAction='pan-y';
  container.addEventListener('pointerdown',e=>{
    if(exporting||(e.pointerType!=='touch'&&e.button>0))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    container.setPointerCapture(e.pointerId);container.focus({preventScroll:true});
    if(pointers.size===1)drag={id:e.pointerId,x:e.clientX,start:e.clientX,y:e.clientY};
    else{drag=null;pinchDistance=pointerSpan();}
  },{signal});
  container.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){const span=pointerSpan();if(pinchDistance&&span)setZoom(zoomDistance*pinchDistance/span);pinchDistance=span;touch();}
    else if(drag?.id===e.pointerId){model.rotation.y+=(e.clientX-drag.x)*.012;drag.x=e.clientX;touch();}
  },{signal});
  function finishPointer(e){
    if(!pointers.has(e.pointerId))return;
    const click=pointers.size===1&&drag?.id===e.pointerId&&Math.abs(e.clientX-drag.start)+Math.abs(e.clientY-drag.y)<5;
    pointers.delete(e.pointerId);pinchDistance=0;
    if(pointers.size===1){const [id,point]=pointers.entries().next().value;drag={id,x:point.x,start:point.x,y:point.y};}else drag=null;
    if(click&&e.type==='pointerup'){
      const b=container.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);
      const hit=ray.intersectObjects(surfaces)[0];if(hit&&sleeves.includes(hit.object))onSelectSleeve();
    }
  }
  container.addEventListener('pointerup',finishPointer,{signal});
  container.addEventListener('pointercancel',finishPointer,{signal});
  container.addEventListener('lostpointercapture',finishPointer,{signal});
  container.addEventListener('wheel',e=>{
    if(exporting)return;
    if((e.deltaY<0&&zoomDistance<=.68)||(e.deltaY>0&&zoomDistance>=3.6))return;
    e.preventDefault();setZoom(zoomDistance*Math.exp(e.deltaY*.0015));touch();
  },{passive:false,signal});
  container.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();model.rotation.y+=e.key==='ArrowLeft'?-.15:.15;dirty=true;}
    if(['+','=','Add','-','_','Subtract'].includes(e.key)){e.preventDefault();zoomBy(['+','=','Add'].includes(e.key)?1:-1);}
  },{signal});
  const png=()=>new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));
  async function exportGuides(){
    if(exporting)throw new Error('이미 가이드를 저장하고 있어요.');
    await ready;if(disposed)throw new Error('다른 화면으로 이동해 저장을 중단했어요.');
    exporting=true;
    const previous={mode,angle:model.rotation.y,z:zoomDistance},files=[];
    try{
      renderer.setPixelRatio(1);renderer.setSize(512,768,false);camera.aspect=512/768;setZoom(3.6);camera.updateProjectionMatrix();
      const manifest={designId:plan.id,engine:plan.engine,width:512,height:768,views:[],partPalette:ids,depthEncoding:{space:'camera view z, metres',near:.1,far:5,formula:'intensity=1-clamp((z-near)/(far-near),0,1)',background:0},normalEncoding:'view-space XYZ mapped from [-1,1] to [0,1] by Three.js MeshNormalMaterial; display encoded sRGB',scope:'Geometry and conditioning assets only. No image-generation inference, identity preservation, image fidelity verification or fit validation has run.'};
      for(let n=0;n<8;n++){
        if(disposed)throw new Error('다른 화면으로 이동해 저장을 중단했어요.');
        const angle=n*45;model.rotation.y=angle*Math.PI/180;
        const view={angle,designId:plan.id,files:{},camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect},modelRotationY:angle*Math.PI/180};
        for(const kind of['surface','parts','normal','depth']){setMode(kind);renderer.render(scene,camera);const blob=await png();if(!blob)throw new Error('이미지 저장에 실패했어요.');const name=`views/${String(angle).padStart(3,'0')}-${kind}.png`;files.push({name,data:new Uint8Array(await blob.arrayBuffer())});view.files[kind]=name;}
        manifest.views.push(view);
      }
      files.push({name:'design.json',data:JSON.stringify(plan,null,2)},{name:'manifest.json',data:JSON.stringify(manifest,null,2)},{name:'sleeve-rounds.csv',data:'round,section,before,after,operation\n'+s.rounds.map(r=>[r.round,r.section,r.before,r.after,r.operation].join(',')).join('\n')},{name:'README.txt',data:`Knit real ${plan.id}\n8 camera views x 4 passes from the same compiled design.\nUse parts/depth/normal maps to condition a future image generation pipeline; never treat these assets as generated photoreal try-on or validated fit.\nThe mannequin, trousers and drape are representative geometry; body circumference, garment length, per-round sleeve radii and rib bands come from the compiled design. Only the post-underarm sleeve schedule is compiled course by course.\nTo evaluate an AI result, segment its garment parts, compare projected boundaries to these masks, check reference identity and colors, and reject mismatches. Stitch topology cannot be proven from a photoreal picture alone.\n`});
      return zipFiles(files);
    }finally{exporting=false;if(!disposed){model.rotation.y=previous.angle;setZoom(previous.z);setMode(previous.mode);resize();renderer.render(scene,camera);}}
  }
  function save(name){
    if(exporting)return;
    ready.then(()=>{
      if(disposed||exporting)return;
      const w=Math.max(1,container.clientWidth),ht=Math.max(1,container.clientHeight),previousRatio=renderer.getPixelRatio();
      const scale=Math.min(4096/Math.max(w,ht),Math.sqrt(8000000/(w*ht)));
      try{
        renderer.setPixelRatio(1);renderer.setSize(Math.round(w*scale),Math.round(ht*scale),false);
        camera.aspect=w/ht;camera.updateProjectionMatrix();renderer.render(scene,camera);
        const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=name;a.click();
      }finally{renderer.setPixelRatio(previousRatio);resize();renderer.render(scene,camera);}
    },()=>{});
  }
  return{plan,ready,setMode,angle(deg){auto=false;model.rotation.y=deg*Math.PI/180;dirty=true;},toggleAuto(){auto=!auto;dirty=true;return auto;},zoom(){return zoomBy(1);},zoomBy,reset(){auto=false;model.rotation.y=0;setZoom(3.6);setMode('surface');},save,exportGuides,
    dispose(){disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();loading.remove();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();delete container.dataset.modelReady;}};
}
