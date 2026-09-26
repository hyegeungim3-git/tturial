import * as THREE from './assets/three.module.js';
import {profileDimensions} from './profile-shape.js';
import {requestMesh} from './mesh-client.js';
import {configureRenderer,studioEnvironment,cyclorama,studioLights,geometryFrom,mannequinMaterial} from './studio.js';

// Measurement mannequin: the same sculpted body as the dressed 360° view, sized by height,
// chest girth, arm length and shoulder width. Meshes are built in a worker; renders on demand.
export function createProfileAvatar(container, profile) {
  const BG='#f5f2f8',scene=new THREE.Scene();scene.background=new THREE.Color(BG);
  const renderer=new THREE.WebGLRenderer({antialias:true});configureRenderer(renderer);
  container.replaceChildren(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(30,1,.02,20),model=new THREE.Group();scene.add(model);
  const envTarget=studioEnvironment(renderer);scene.environment=envTarget.texture;
  const backdrop=cyclorama(BG);scene.add(backdrop);
  studioLights(scene,{target:[0,.85,0],span:1.2});
  const material=mannequinMaterial();
  const loading=document.createElement('p');loading.className='model-loading';loading.setAttribute('role','status');loading.textContent='치수로 아바타를 만드는 중이에요';container.append(loading);
  let disposed=false,frame=0,drag=null,zoomed=false,dimensions=null,visible=true,mesh=null,token=0,busy=false,queued=null;
  const abort=new AbortController(),signal=abort.signal;
  function frameCamera() {
    if(!dimensions)return;
    const {height,shoulderWidth,armLength}=dimensions;
    const width=Math.max(shoulderWidth+armLength*.62+.12,.7);
    const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
    const distance=Math.max(height*1.24,width*1.14/camera.aspect)/(2*Math.tan(halfFov));
    const target=height*(zoomed?.72:.47);
    camera.position.set(0,target+height*.04,distance*(zoomed?.6:1));camera.lookAt(0,target,0);
  }
  function draw(){if(!disposed&&visible)renderer.render(scene,camera);}
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
  // Latest-wins rebuilds: typing a measurement never queues more than one pending body.
  function build(next){
    if(busy){queued=next;return;}
    busy=true;const mine=++token;
    requestMesh({type:'mannequin',profile:{height:next.height,chest:next.chest,arm:next.arm,shoulder:next.shoulder},cell:.005}).then(r=>{
      if(disposed||mine!==token)return;
      const geo=geometryFrom(r.mesh);
      if(mesh){mesh.geometry.dispose();mesh.geometry=geo;}else{mesh=new THREE.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;model.add(mesh);}
      loading.remove();container.setAttribute('aria-busy','false');container.dataset.modelReady='true';schedule();
    }).catch(error=>{if(!disposed)console.error('Profile avatar:',error);}).finally(()=>{
      busy=false;if(queued&&!disposed){const q=queued;queued=null;build(q);}
    });
  }
  function update(next) {
    const shape=profileDimensions(next);if(!shape)return false;
    dimensions=shape;frameCamera();build(next);
    renderer.domElement.setAttribute('aria-label',`키 ${next.height}cm, 가슴둘레 ${next.chest}cm, 팔 길이 ${next.arm}cm, 어깨너비 ${next.shoulder}cm의 3D 치수 아바타`);
    schedule();return true;
  }
  function resize(){if(disposed)return;const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();frameCamera();draw();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)draw();});intersection.observe(container);
  container.tabIndex=0;
  container.addEventListener('pointerdown',event=>{if(event.button>0)return;drag={id:event.pointerId,x:event.clientX};container.setPointerCapture(event.pointerId);container.focus({preventScroll:true});},{signal});
  container.addEventListener('pointermove',event=>{if(!drag)return;model.rotation.y+=(event.clientX-drag.x)*.012;drag.x=event.clientX;schedule();},{signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])container.addEventListener(type,()=>drag=null,{signal});
  container.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();model.rotation.y=event.key==='Home'?0:model.rotation.y+(event.key==='ArrowLeft'?-.15:.15);draw();}},{signal});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(disposed)return;container.innerHTML='<p class="avatar-load-message">3D 연결이 중단됐어요. 다른 치수를 선택하거나 보관함을 다시 열어주세요.</p>';},{signal});
  model.rotation.y=-.16;update(profile);resize();
  return {update,angle(degrees){model.rotation.y=degrees*Math.PI/180;draw();},zoom(){zoomed=!zoomed;frameCamera();draw();return zoomed;},reset(){zoomed=false;model.rotation.y=0;frameCamera();draw();},
    dispose(){if(disposed)return;disposed=true;abort.abort();loading.remove();cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();mesh?.geometry.dispose();backdrop.geometry.dispose();backdrop.material.dispose();material.dispose();envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
