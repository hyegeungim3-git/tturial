import * as THREE from './assets/three.module.js';
import {compileDesign,sleeveRings} from './design-engine.js';
import {zipFiles} from './bundle.js';

export function createAvatar(container,project,onSelectSleeve){
  const plan=compileDesign(project);
  if(!plan.valid){container.innerHTML='<div class="empty"><h3>수정 조건을 조정해 주세요</h3><p>줄임 규칙이 성립하는 조건에서 360도 형태를 만듭니다.</p></div>';return{dispose(){}};}
  const d=project.design,p=project.profile,s=plan.sleeve,h=p.height/165,materials=new Set(),geometries=new Set();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f4f2f7');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',`설계 ${plan.id}, 소매 ${s.totalRows}단으로 생성한 360도 구조`);
  const camera=new THREE.PerspectiveCamera(32,1,.1,10);camera.position.set(0,1.1,3.6);camera.lookAt(0,.85,0);
  scene.add(new THREE.HemisphereLight('#ffffff','#b3a4c1',2.4));
  const key=new THREE.DirectionalLight('#fff9f1',3);key.position.set(-2,4,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.006;scene.add(key);
  const fill=new THREE.DirectionalLight('#e0daff',1.8);fill.position.set(3,2,-3);scene.add(fill);
  const model=new THREE.Group();model.scale.y=h;scene.add(model);
  const mat=(color)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.93});materials.add(m);return m;};
  const skin=mat('#e8ddd7'),pants=mat('#555364'),shoes=mat('#faf8f4'),plain=mat(d.color);
  function textile(color,rib=false){const m=mat(color);m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 stitchUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nstitchUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 stitchUv;').replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cell=fract(stitchUv); float ridge=abs(cell.x-.5)*1.5; float yarn=sin((cell.y-ridge)*6.28318); float ribShadow=${rib?'mod(floor(stitchUv.x),4.0)<2.0?1.0:.80':'1.0'};
      diffuseColor.rgb *= (.92+.08*yarn)*ribShadow;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(normal+vec3(cos(stitchUv.x*6.28318)*.09,sin(stitchUv.y*6.28318)*.05,0.0));');
  };m.customProgramCacheKey=()=>`knit-${rib}`;return m;}
  const garment=textile(d.color),rib=textile(d.trim,true);
  const surfaces=[],sleeves=[],markers=[];
  const ids={body:'#b28af4','sleeve-left':'#69bbbd','sleeve-right':'#77a2ed',cuff:'#ed9d59',collar:'#edcf6c',human:'#526172'};
  const normal=new THREE.MeshNormalMaterial();materials.add(normal);
  const depth=new THREE.ShaderMaterial({uniforms:{nearZ:{value:.1},farZ:{value:5}},vertexShader:'varying float z; void main(){vec4 p=modelViewMatrix*vec4(position,1.);z=-p.z;gl_Position=projectionMatrix*p;}',fragmentShader:'varying float z;uniform float nearZ;uniform float farZ;void main(){float d=1.-clamp((z-nearZ)/(farZ-nearZ),0.,1.);gl_FragColor=vec4(vec3(d),1.);}'});materials.add(depth);
  const masks=Object.fromEntries(Object.entries(ids).map(([k,color])=>{const m=new THREE.MeshBasicMaterial({color,toneMapped:false});materials.add(m);return[k,m];}));
  function mesh(geo,material,parent=model,region='human'){geometries.add(geo);const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;m.userData={surface:material,region};parent.add(m);surfaces.push(m);return m;}
  function oval(parent,pos,size,material,region='human'){const m=mesh(new THREE.SphereGeometry(1,36,24),material,parent,region);m.position.set(...pos);m.scale.set(...size);return m;}
  function tube(parent,length,r1,r2,material,region='human'){const m=mesh(new THREE.CylinderGeometry(r1,r2,length,48,8),material,parent,region);m.position.y=-length/2;return m;}
  const floor=mesh(new THREE.PlaneGeometry(200,200),mat('#f4f2f7'),scene);floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;
  for(const side of[-1,1]){const leg=new THREE.Group();leg.position.set(side*.095,.87,0);model.add(leg);tube(leg,.76,.097,.06,pants);oval(leg,[0,-.77,.035],[.066,.055,.125],shoes);}
  oval(model,[0,.92,0],[.188,.18,.12],pants);
  const neck=mesh(new THREE.CylinderGeometry(.048,.06,.13,36),skin);neck.position.y=1.443;
  oval(model,[0,1.565,.01],[.083,.108,.082],skin);
  const bust=plan.body.actualChestCm/100/(Math.PI*(3*(1+.7)-Math.sqrt((3+.7)*(1+3*.7))));
  const length=plan.body.actualLengthCm/100/h,shoulderY=1.382,bottom=shoulderY-length;
  const bodyPoints=[[bust,.05/h],[bust,length*.5],[bust,length*.70],[bust*.88,length*.84],[.1,length*.97],[.068,length]].map(([x,y])=>new THREE.Vector2(x,y));
  const bodyGeo=new THREE.LatheGeometry(bodyPoints,96),uv=bodyGeo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*plan.body.stitches,uv.getY(i)*plan.body.actualLengthCm*plan.gauge.rowsPerCm);
  const body=mesh(bodyGeo,garment,model,'body');body.position.y=bottom;body.scale.z=.7;
  const hemGeo=new THREE.CylinderGeometry(bust,bust*.94,.05/h,96,12),huv=hemGeo.attributes.uv;
  for(let i=0;i<huv.count;i++)huv.setXY(i,huv.getX(i)*plan.body.stitches,huv.getY(i)*Math.round(5*plan.gauge.rowsPerCm));
  const hem=mesh(hemGeo,rib,model,'cuff');hem.position.y=bottom+.025/h;hem.scale.z=.7;
  const collar=mesh(new THREE.TorusGeometry(.072,.013,20,64),rib,model,'collar');collar.rotation.x=Math.PI/2;collar.position.y=shoulderY;collar.scale.y=.88;
  const rings=sleeveRings(plan),boundary=s.capRows+s.shapingRows;
  function ringMesh(list,material,parent,region){const positions=[],normals=[],uvs=[],indices=[],segments=64;
    for(let i=0;i<list.length;i++){const r=list[i];for(let j=0;j<=segments;j++){const angle=j/segments*Math.PI*2;positions.push(Math.cos(angle)*r.radiusM,-r.yCm/100/h,Math.sin(angle)*r.radiusM);normals.push(Math.cos(angle),0,Math.sin(angle));uvs.push(j/segments*r.stitches,r.row);if(i&&j){const b=i*(segments+1)+j;indices.push(b,b-1,b-segments-1,b-1,b-segments-2,b-segments-1);}}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const m=mesh(geo,material,parent,region);sleeves.push(m);return m;
  }
  for(const side of[-1,1]){
    const arm=new THREE.Group();arm.position.set(side*(p.shoulder/200+.003),1.315,0);arm.rotation.z=side*.18;model.add(arm);
    tube(arm,p.arm/100/h,Math.min(.043,rings[0].radiusM*.75),Math.min(.024,rings.at(-1).radiusM*.75),skin);oval(arm,[0,-p.arm/100/h-.03,0],[.032,.063,.024],skin);
    oval(arm,[0,0,0],[rings[0].radiusM,.048,rings[0].radiusM],plain,side===1?'sleeve-left':'sleeve-right');
    ringMesh(rings.filter(r=>r.row<=boundary),garment,arm,side===1?'sleeve-left':'sleeve-right');
    ringMesh(rings.filter(r=>r.row>=boundary),rib,arm,'cuff');
    if(s.continuation){
      const kept=rings[s.capRows+s.continuation.lockedRows];
      const points=Array.from({length:80},(_,j)=>new THREE.Vector3(Math.cos(j/80*Math.PI*2)*(kept.radiusM+.001),-kept.yCm/100/h,Math.sin(j/80*Math.PI*2)*(kept.radiusM+.001)));
      const geo=new THREE.BufferGeometry().setFromPoints(points),material=new THREE.LineBasicMaterial({color:'#dcaf57'});geometries.add(geo);materials.add(material);
      const marker=new THREE.LineLoop(geo,material);arm.add(marker);markers.push(marker);
    }
    // Raglan connection guide: a visible template boundary, not a solved yoke chart.
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.074,1.37,.055),new THREE.Vector3(side*bust*.65,1.285,.10),new THREE.Vector3(side*bust*.93,1.19,.052)]);
    mesh(new THREE.TubeGeometry(path,28,.0017,6,false),plain,model,'body');
  }
  let mode='surface',disposed=false,frame,auto=false,drag=null,exporting=false;
  const abort=new AbortController(),signal=abort.signal;
  function setMode(value){mode=value;surfaces.forEach(m=>{m.material=value==='surface'?m.userData.surface:value==='parts'?masks[m.userData.region]:value==='normal'?normal:depth;});markers.forEach(m=>m.visible=value==='surface'&&!exporting);floor.visible=value==='surface';scene.background=new THREE.Color(value==='surface'?'#f4f2f7':'#000000');}
  function resize(){if(exporting||disposed)return;const w=Math.max(1,container.clientWidth),ht=Math.max(1,container.clientHeight);renderer.setSize(w,ht);camera.aspect=w/ht;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function draw(){if(disposed)return;if(!exporting){if(auto&&!drag)model.rotation.y+=.006;renderer.render(scene,camera);}frame=requestAnimationFrame(draw);}draw();
  container.tabIndex=0;container.style.touchAction='pan-y';
  container.addEventListener('pointerdown',e=>{if(e.button>0||exporting)return;drag={x:e.clientX,start:e.clientX,y:e.clientY};container.setPointerCapture(e.pointerId);container.focus({preventScroll:true});},{signal});
  container.addEventListener('pointermove',e=>{if(!drag)return;model.rotation.y+=(e.clientX-drag.x)*.012;drag.x=e.clientX;},{signal});
  container.addEventListener('pointerup',e=>{if(!drag)return;const click=Math.abs(e.clientX-drag.start)+Math.abs(e.clientY-drag.y)<5;drag=null;if(click){const b=container.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);if(ray.intersectObjects(sleeves).length)onSelectSleeve();}},{signal});
  container.addEventListener('pointercancel',()=>drag=null,{signal});container.addEventListener('lostpointercapture',()=>drag=null,{signal});
  container.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();model.rotation.y+=e.key==='ArrowLeft'?-.15:.15;}},{signal});
  const png=()=>new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));
  async function exportGuides(){
    if(exporting)throw new Error('이미 가이드를 저장하고 있어요.');exporting=true;
    const previous={mode,angle:model.rotation.y,z:camera.position.z,pixel:renderer.getPixelRatio()},files=[];
    try{
      renderer.setPixelRatio(1);renderer.setSize(512,768,false);camera.aspect=512/768;camera.position.z=3.6;camera.updateProjectionMatrix();
      const manifest={designId:plan.id,engine:plan.engine,width:512,height:768,views:[],partPalette:ids,depthEncoding:{space:'camera view z, metres',near:.1,far:5,formula:'intensity=1-clamp((z-near)/(far-near),0,1)',background:0},normalEncoding:'view-space XYZ mapped from [-1,1] to [0,1] by Three.js MeshNormalMaterial; display encoded sRGB',scope:'Geometry and conditioning assets only. No image-generation inference, identity preservation, image fidelity verification or fit validation has run.'};
      for(let n=0;n<8;n++){
        if(disposed)throw new Error('다른 화면으로 이동해 저장을 중단했어요.');
        const angle=n*45;model.rotation.y=angle*Math.PI/180;
        const view={angle,designId:plan.id,files:{},camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect},modelRotationY:angle*Math.PI/180};
        for(const kind of['surface','parts','normal','depth']){setMode(kind);renderer.render(scene,camera);const blob=await png();if(!blob)throw new Error('이미지 저장에 실패했어요.');const name=`views/${String(angle).padStart(3,'0')}-${kind}.png`;files.push({name,data:new Uint8Array(await blob.arrayBuffer())});view.files[kind]=name;}
        manifest.views.push(view);
      }
      files.push({name:'design.json',data:JSON.stringify(plan,null,2)},{name:'manifest.json',data:JSON.stringify(manifest,null,2)},{name:'sleeve-rounds.csv',data:'round,section,before,after,operation\n'+s.rounds.map(r=>[r.round,r.section,r.before,r.after,r.operation].join(',')).join('\n')},{name:'README.txt',data:`Knit real ${plan.id}\n8 camera views x 4 passes from the same compiled design.\nUse parts/depth/normal maps to condition a future image generation pipeline; never treat these assets as generated photoreal try-on or validated fit.\nThe body and yoke are template geometry; only the post-underarm sleeve schedule is compiled course by course.\nTo evaluate an AI result, segment its garment parts, compare projected boundaries to these masks, check reference identity and colors, and reject mismatches. Stitch topology cannot be proven from a photoreal picture alone.\n`});
      return zipFiles(files);
    }finally{exporting=false;if(!disposed){renderer.setPixelRatio(previous.pixel);model.rotation.y=previous.angle;camera.position.z=previous.z;setMode(previous.mode);resize();renderer.render(scene,camera);}}
  }
  return{plan,setMode,angle(deg){auto=false;model.rotation.y=deg*Math.PI/180;},toggleAuto(){auto=!auto;return auto;},zoom(){camera.position.z=camera.position.z>3?2.35:3.6;},reset(){auto=false;model.rotation.y=0;camera.position.z=3.6;setMode('surface');},save(name){renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=name;a.click();},exportGuides,dispose(){disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();}};
}
