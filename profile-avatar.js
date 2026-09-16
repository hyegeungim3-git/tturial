import * as THREE from './assets/three.module.js';
import {profileDimensions} from './profile-shape.js';

export function createProfileAvatar(container, profile) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f5f2f8');
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  container.replaceChildren(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(30,1,.01,20),model=new THREE.Group();scene.add(model);
  scene.add(new THREE.HemisphereLight('#ffffff','#b7a3ca',2.5));
  const key=new THREE.DirectionalLight('#fff7ee',3);key.position.set(-2,4,3);scene.add(key);
  const fill=new THREE.DirectionalLight('#ded6fb',1.8);fill.position.set(3,2,-2);scene.add(fill);
  const skin=new THREE.MeshStandardMaterial({color:'#e6dbd4',roughness:.75});
  const body=new THREE.MeshStandardMaterial({color:'#aaa0c5',roughness:.9});
  const accents=new THREE.MeshStandardMaterial({color:'#9187ad',roughness:.85});
  const floorMaterial=new THREE.MeshStandardMaterial({color:'#eee8f3',roughness:1});
  const baseGeometry=new THREE.CylinderGeometry(.55,.57,.015,64),base=new THREE.Mesh(baseGeometry,floorMaterial);base.position.y=-.015;scene.add(base);
  const geometries=new Set();
  let disposed=false,frame=0,drag=null,zoomed=false,dimensions=null,visible=true;
  const abort=new AbortController(),signal=abort.signal;
  function add(geometry,material,parent=model) {geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);return mesh;}
  function oval(parent,x,y,z,rx,ry,rz,material) {const m=add(new THREE.SphereGeometry(1,32,24),material,parent);m.position.set(x,y,z);m.scale.set(rx,ry,rz);return m;}
  function segment(parent,length,r1,r2,material) {const m=add(new THREE.CylinderGeometry(r1,r2,length,32,8),material,parent);m.position.y=-length/2;return m;}
  function frameCamera() {
    if(!dimensions)return;
    const {height,shoulderWidth,armLength,chestRadius}=dimensions;
    const width=Math.max(shoulderWidth+armLength*.30+.18,chestRadius*2.5,.8);
    const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
    const distance=Math.max(height*1.16,width*1.12/camera.aspect)/(2*Math.tan(halfFov));
    camera.position.set(0,height*.55,distance*(zoomed ? .8 : 1));camera.lookAt(0,height*.51,0);
  }
  function draw(){if(!disposed&&visible)renderer.render(scene,camera);}
  function update(next) {
    const shape=profileDimensions(next);if(!shape)return false;
    geometries.forEach(g=>g.dispose());geometries.clear();model.clear();dimensions=shape;
    const {height:h,shoulderWidth:sw,armLength:al,chestRadius:r,chestDepthRatio:depth,shoulderY:sy,hipY:hy,headHeight:hh}=shape;
    const torsoHeight=sy-hy;
    const points=[[r*.86,0],[r*.98,torsoHeight*.12],[r*.79,torsoHeight*.39],[r,torsoHeight*.72],[r*.94,torsoHeight*.87],[Math.max(.065,sw*.46),torsoHeight*.97],[.053,torsoHeight*1.025]].map(([x,y])=>new THREE.Vector2(x,y));
    const torso=add(new THREE.LatheGeometry(points,64),body);torso.position.y=hy;torso.scale.z=depth;
    oval(model,0,hy+.014,0,r*.9,h*.07,r*depth*.96,body);
    const neck=add(new THREE.CylinderGeometry(h*.026,h*.034,h*.08,32),skin);neck.position.y=h-hh-h*.025;
    oval(model,0,h-hh/2,0,hh*.38,hh/2,hh*.39,skin);
    for(const side of [-1,1]) {
      const leg=new THREE.Group();leg.position.set(side*r*.46,hy,0);model.add(leg);
      const legLength=hy-h*.065;
      segment(leg,legLength*.53,r*.46,r*.32,body);
      oval(leg,0,-legLength*.52,0,r*.32,r*.32,r*.31,body);
      const shin=new THREE.Group();shin.position.y=-legLength*.53;leg.add(shin);segment(shin,legLength*.47,r*.32,r*.21,body);
      oval(leg,0,-legLength-h*.022,h*.029,r*.245,h*.035,h*.063,accents);
      const arm=new THREE.Group();arm.position.set(side*sw/2,sy,0);arm.rotation.z=side*.13;model.add(arm);
      const upperRadius=Math.min(.067,Math.max(.038,r*.29));
      oval(arm,0,0,0,upperRadius,upperRadius,upperRadius,body);
      segment(arm,al*.52,upperRadius,upperRadius*.76,body);
      const forearm=new THREE.Group();forearm.position.y=-al*.52;arm.add(forearm);
      oval(forearm,0,0,0,upperRadius*.77,upperRadius*.77,upperRadius*.77,body);
      segment(forearm,al*.48,upperRadius*.76,upperRadius*.49,body);
      oval(arm,0,-al-h*.027,0,upperRadius*.56,h*.044,upperRadius*.39,skin);
    }
    renderer.domElement.setAttribute('aria-label',`키 ${next.height}cm, 가슴둘레 ${next.chest}cm, 팔 길이 ${next.arm}cm, 어깨너비 ${next.shoulder}cm의 3D 치수 아바타`);
    frameCamera();draw();return true;
  }
  function resize(){if(disposed)return;const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();frameCamera();draw();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)draw();});intersection.observe(container);
  container.tabIndex=0;
  container.addEventListener('pointerdown',event=>{if(event.button>0)return;drag={id:event.pointerId,x:event.clientX};container.setPointerCapture(event.pointerId);container.focus({preventScroll:true});},{signal});
  container.addEventListener('pointermove',event=>{if(!drag)return;model.rotation.y+=(event.clientX-drag.x)*.012;drag.x=event.clientX;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);},{signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])container.addEventListener(type,()=>drag=null,{signal});
  container.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();model.rotation.y=event.key==='Home'?0:model.rotation.y+(event.key==='ArrowLeft'?-.15:.15);draw();}},{signal});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(disposed)return;container.innerHTML='<p class="avatar-load-message">3D 연결이 중단됐어요. 다른 치수를 선택하거나 보관함을 다시 열어주세요.</p>';},{signal});
  model.rotation.y=-.16;update(profile);resize();
  return {update,angle(degrees){model.rotation.y=degrees*Math.PI/180;draw();},zoom(){zoomed=!zoomed;frameCamera();draw();return zoomed;},reset(){zoomed=false;model.rotation.y=0;frameCamera();draw();},dispose(){if(disposed)return;disposed=true;abort.abort();cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();geometries.forEach(g=>g.dispose());baseGeometry.dispose();[skin,body,accents,floorMaterial].forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();}};
}
