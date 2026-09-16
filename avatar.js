import * as THREE from './assets/three.module.js';

// Parametric garment/mannequin for interaction demonstration, not cloth simulation.
export function createAvatar(container, project, onSelectSleeve) {
  const d=project.design,p=project.profile;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f4f3f6');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor('#f4f3f6');container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(0,1.05,3.85);camera.lookAt(0,.77,0);
  const ambient=new THREE.HemisphereLight('#ffffff','#b2a3bb',2.3);scene.add(ambient);
  const light=new THREE.DirectionalLight('#fff9f3',3.2);light.position.set(-2,4,3);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=3;light.shadow.camera.bottom=-2;light.shadow.normalBias=.015;scene.add(light);
  const fill=new THREE.DirectionalLight('#e7e3ff',1.4);fill.position.set(3,2,-2);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#f4f3f6',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.015;scene.add(floor);
  const grid=new THREE.GridHelper(4,32,'#ded9e5','#e6e1eb');grid.material.transparent=true;grid.material.opacity=.5;grid.position.y=-.012;scene.add(grid);
  const model=new THREE.Group();scene.add(model);model.rotation.y=-.13;
  // Vertical proportion follows height. Chest/shoulder/arm remain separately parametrized.
  const h=p.height/165;model.scale.y=h;
  const skin=new THREE.MeshStandardMaterial({color:'#e5dcd5',roughness:.65});
  const pants=new THREE.MeshStandardMaterial({color:'#50505e',roughness:.96});
  const shoes=new THREE.MeshStandardMaterial({color:'#f2efea',roughness:.75});
  const garment=new THREE.MeshStandardMaterial({color:d.color,roughness:1});
  const trim=new THREE.MeshStandardMaterial({color:d.trim,roughness:1});
  function knitShader(material,rib=false){material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vKnitUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvKnitUv=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vKnitUv;').replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>\nfloat threadWave=sin(vKnitUv.x*${rib?'420.0':'550.0'}+sin(vKnitUv.y*380.0)*1.1);\nnormal=normalize(normal+vec3(threadWave*.095,cos(vKnitUv.y*380.0)*.025,0.0));`);};}knitShader(garment);knitShader(trim,true);
  const parts=[];
  function mesh(geo,mat,parent=model){const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function oval(x,y,z,sx,sy,sz,mat,parent=model){const m=mesh(new THREE.SphereGeometry(1,40,28),mat,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;}
  function segment(parent,length,top,bottom,mat,depth=1){const m=mesh(new THREE.CylinderGeometry(top,bottom,length,40,12),mat,parent);m.position.y=-length/2;m.scale.z=depth;return m;}
  const legs=[];
  for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.095,.86,0);model.add(leg);segment(leg,.75,.093,.061,pants,.88);oval(0,-.758,.033,.064,.06,.132,shoes,leg);legs.push(leg);}
  oval(0,.91,0,.188,.185,.112,pants);
  const bodyWidth=p.chest/88*.19;
  oval(0,1.19,0,bodyWidth,.23,.108,skin);
  const neck=mesh(new THREE.CylinderGeometry(.047,.059,.115,40),skin);neck.position.y=1.443;
  const head=oval(0,1.564,.009,.084,.108,.081,skin);head.rotation.x=-.03;
  // A neutral mannequin head intentionally avoids implying photorealistic fit prediction.
  const bust=(p.chest+d.ease)/100*.208;
  const garmentLength=d.length/100/h;
  const shoulderY=1.382;
  const bottomY=shoulderY-garmentLength;
  const pts=[[bust*.94,0],[bust, .055],[bust*1.015,garmentLength*.44],[bust,garmentLength*.73],[bust*.91,garmentLength*.86],[.10,garmentLength*.98],[.064,garmentLength]].map(([x,y])=>new THREE.Vector2(x,y));
  const body=mesh(new THREE.LatheGeometry(pts,80),garment);body.position.y=bottomY;body.scale.z=.70;
  const hem=mesh(new THREE.CylinderGeometry(bust*.98,bust*.94,.055,80,8),trim);hem.position.y=bottomY+.014;hem.scale.z=.70;
  const collar=mesh(new THREE.TorusGeometry(.069,.014,20,80),trim);collar.rotation.x=Math.PI/2;collar.position.y=shoulderY-.006;collar.scale.y=.88;
  const arms=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*(p.shoulder/200+.004),1.312,0);arm.rotation.z=side*.22;model.add(arm);arms.push(arm);
    const armLength=p.arm/100/h;
    segment(arm,armLength,.054,.036,skin,.94);
    oval(0,-armLength-.033,0,.039,.069,.025,skin,arm);
    const sleeveLength=d.sleeve/100/h;
    oval(0,-.028,0,.081,.06,.082,garment,arm);
    const sleeve=segment(arm,sleeveLength,.085,.055,garment,.97);sleeve.userData.sleeve=true;parts.push(sleeve);
    const cuff=mesh(new THREE.CylinderGeometry(.057,.052,.047,48,8),trim,arm);cuff.position.y=-sleeveLength;cuff.userData.sleeve=true;parts.push(cuff);
  }
  let poseIndex=0,dragging=false,lastX=0,downX=0,downY=0,disposed=false,frame=0;
  const raycaster=new THREE.Raycaster();
  function down(e){dragging=true;lastX=e.clientX;downX=e.clientX;downY=e.clientY;container.setPointerCapture(e.pointerId);}
  function move(e){if(dragging){model.rotation.y+=(e.clientX-lastX)*.012;lastX=e.clientX;}}
  function up(e){dragging=false;if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)<5){const b=container.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);if(raycaster.intersectObjects(parts).length)onSelectSleeve();}}
  container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);container.addEventListener('pointerup',up);
  container.tabIndex=0;const key=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();model.rotation.y+=e.key==='ArrowLeft'?-.15:.15;}};container.addEventListener('keydown',key);
  function resize(){const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function draw(){if(disposed)return;renderer.render(scene,camera);frame=requestAnimationFrame(draw);}draw();
  return {pose(i){poseIndex=i;arms[0].rotation.z=i===1?-1.45:-.22;arms[1].rotation.z=i===1?1.45:.22;legs[0].rotation.x=i===2?-.28:0;legs[1].rotation.x=i===2?.22:0;},zoom(){camera.position.z=camera.position.z>3?2.45:3.6;},reset(){model.rotation.y=-.13;camera.position.z=3.6;},save(name){renderer.render(scene,camera);const a=document.createElement('a');a.download=name;a.href=renderer.domElement.toDataURL('image/png');a.click();},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);container.removeEventListener('pointerup',up);container.removeEventListener('keydown',key);scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});[skin,pants,shoes,garment,trim,floor.material,grid.material].forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();}};
}
