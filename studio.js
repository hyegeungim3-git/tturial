// Shared photographic studio for the 3D views: soft image-based light, key shadow,
// seamless cyclorama and procedural yarn/fabric surface maps.
import * as THREE from './assets/three.module.js';

export function configureRenderer(renderer){
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=EXPOSURE;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
}

// Low-cost HDR environment: gradient dome plus three soft boxes, prefiltered with PMREM.
export function studioEnvironment(renderer){
  const scene=new THREE.Scene(),disposables=[];
  const dome=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(1.05,1.03,1.08)},mid:{value:new THREE.Color(.78,.76,.8)},low:{value:new THREE.Color(.42,.4,.44)}},
    vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top,mid,low;varying vec3 vp;void main(){float h=vp.y;vec3 c=h>0.?mix(mid,top,smoothstep(0.,.8,h)):mix(mid,low,smoothstep(0.,-.6,h));gl_FragColor=vec4(c,1.);}'});
  const domeGeo=new THREE.SphereGeometry(20,48,24);scene.add(new THREE.Mesh(domeGeo,dome));disposables.push(dome,domeGeo);
  const box=(w,h,pos,intensity,tint=[1,1,1])=>{
    const g=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({color:new THREE.Color(...tint).multiplyScalar(intensity),side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(g,m);mesh.position.set(...pos);mesh.lookAt(0,1.1,0);scene.add(mesh);disposables.push(g,m);
  };
  box(4,5,[-5,6,6],7,[1,.97,.93]);   // key softbox, front left above
  box(5,4,[7,3,3],3.2,[.93,.95,1]);  // fill, right
  box(6,2.5,[0,5,-7],4.5,[1,.98,1]); // rim, behind
  box(9,9,[0,12,0],2.4);             // ceiling bounce
  const pmrem=new THREE.PMREMGenerator(renderer),rt=pmrem.fromScene(scene,.035);
  pmrem.dispose();disposables.forEach(d=>d.dispose());
  return rt;
}

// Floor that curves into a back wall so the horizon never shows.
export function cyclorama(color='#f3f1f6'){
  const R=1.4,depth=2.6,width=16,pts=[];
  for(let i=0;i<=24;i++){const a=i/24*Math.PI/2;pts.push([-(depth-R)-Math.sin(a)*R,R-Math.cos(a)*R]);}
  const profile=[[6,0],[-(depth-R),0],...pts.slice(1),[-depth,7]];
  const geo=new THREE.BufferGeometry(),pos=[],idx=[],cols=12;
  profile.forEach(([z,y])=>{for(let c=0;c<=cols;c++)pos.push(-width/2+c/cols*width,y,z);});
  for(let r=0;r<profile.length-1;r++)for(let c=0;c<cols;c++){const a=r*(cols+1)+c,b=a+cols+1;idx.push(a,a+1,b,a+1,b+1,b);}
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color,roughness:.96,metalness:0,envMapIntensity:.55});
  const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;return mesh;
}

export function studioLights(scene,{target=[0,.9,0],span=1.4}={}){
  const key=new THREE.DirectionalLight('#fff4e8',2.7);key.position.set(-1.8,3.6,2.6);key.target.position.set(...target);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0004;key.shadow.normalBias=.012;key.shadow.radius=4;
  Object.assign(key.shadow.camera,{left:-span,right:span,top:span*1.3,bottom:-span*.9,near:.5,far:9});
  const rim=new THREE.DirectionalLight('#eef0ff',.9);rim.position.set(1.6,2.6,-2.4);rim.target.position.set(...target);
  const hemi=new THREE.HemisphereLight('#ffffff','#cfc8d6',.12);
  scene.add(key,key.target,rim,rim.target,hemi);
  return{key,rim,hemi};
}

// Mesh data {positions, indices, normals?, uvs?, ao?, colors?} → BufferGeometry.
export function geometryFrom(mesh){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));
  if(mesh.normals)g.setAttribute('normal',new THREE.BufferAttribute(mesh.normals,3));
  if(mesh.uvs)g.setAttribute('uv',new THREE.BufferAttribute(mesh.uvs,2));
  if(mesh.colors)g.setAttribute('color',new THREE.BufferAttribute(mesh.colors,3));
  else if(mesh.ao){const c=new Float32Array(mesh.ao.length*3);for(let i=0;i<mesh.ao.length;i++)c[i*3]=c[i*3+1]=c[i*3+2]=mesh.ao[i];g.setAttribute('color',new THREE.BufferAttribute(c,3));}
  g.setIndex(new THREE.BufferAttribute(mesh.indices,1));
  if(!mesh.normals)g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------- procedural surface maps (cached as canvases, textures made per renderer) ----------
const canvasCache=new Map();
function hash(x,y,s=0){let h=Math.imul(x*374761393+y*668265263+s*982451653,1274126177);h^=h>>>13;h=Math.imul(h,1274126177);return((h^h>>>16)>>>0)/4294967295;}
function valueNoise(x,y,period,seed){
  const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const w=a=>((a%period)+period)%period;
  const a=hash(w(xi),w(yi),seed),b=hash(w(xi+1),w(yi),seed),c=hash(w(xi),w(yi+1),seed),d=hash(w(xi+1),w(yi+1),seed);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
// Knit stitches drawn in physical millimetres (stitch 5 mm wide, row 3.6 mm tall).
// Each stitch is a V of two plump lozenge-shaped legs that overlap the row above,
// so columns read as braids separated by narrow valleys, as in real stockinette.
const ST=5,RW=3.6;
function knitCanvas(kind,px=64){
  const key=kind+px;if(canvasCache.has(key))return canvasCache.get(key);
  const cols=8,rows=8,W=cols*px,Hh=rows*px,height=new Float32Array(W*Hh),shade=new Float32Array(W*Hh);
  const jit=(c,r,s)=>hash(((c%cols)+cols)%cols,((r%rows)+rows)%rows,s)-.5;
  const purl=c=>kind==='rib'&&(((c%4)+4)%4)>=2;
  const LA=2.65,LB=kind==='rib'?1.4:1.27; // leg half-length / half-width (mm)
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){
    const U=(x+.5)/px,V=rows-(y+.5)/px,col=Math.floor(U),row=Math.floor(V);
    let best=-1,ply=.5,tone=0,rim=1;
    for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++){
      const c=col+dc,r=row+dr,u=(U-c)*ST,v=(V-r)*RW,j1=jit(c,r,1),j2=jit(c,r,2),j3=jit(c,r,3);
      if(purl(c)){
        // purl bump: a short horizontal loop sunk between the knit ribs
        const cx=ST*.5,cy=RW*(.58+j2*.06),du=(u-cx)/(ST*.6),dv=(v-cy+.3*Math.cos(du*1.4)-.12*j1)/(RW*.36),q=1-du*du*du*du-dv*dv;
        if(q>0){const h=Math.sqrt(q)*.7-.42;if(h>best){best=h;ply=.5+.5*Math.cos((u*1.3-v*.5)*1.9+j3*6);tone=j1*.5;rim=Math.sqrt(1-q);}}
        continue;
      }
      for(const side of[-1,1]){
        // leg axis from the V's bottom centre up to the outer top corner
        const bx=ST*(.5+side*.06)+j1*.12,by=RW*(-.18)+j2*.1,tx=ST*(.5+side*.42)+j1*.12+j3*.1,ty=RW*1.2+j2*.1;
        const ax=tx-bx,ay=ty-by,L=Math.hypot(ax,ay),dx=ax/L,dy=ay/L,cxm=(bx+tx)/2,cym=(by+ty)/2;
        const s=(u-cxm)*dx+(v-cym)*dy,d=-(u-cxm)*dy+(v-cym)*dx,a=LA,b=LB*(1+.06*j3);
        const q=1-(s/a)*(s/a)-(d/b)*(d/b);
        if(q<=0)continue;
        const t=.5+s/(2*a),h=Math.sqrt(q)*(1+.22*(.5-t))+(kind==='rib'?.1:0);
        if(h>best){best=h;ply=.5+.5*Math.cos((s*1.5-d*side*2.1)*2.4+j1*9);tone=j3*.5+side*.02;rim=Math.sqrt(1-q);}
      }
    }
    const i=y*W+x,fuzz=valueNoise(x/2.6,y/2.6,Math.round(W/2.6),7)*.6+valueNoise(x/1.2,y/1.2,Math.round(W/1.2),9)*.4;
    height[i]=(best<-.2?-.45:best)+(fuzz-.5)*.07+(ply-.5)*.06*(best>0?1:0);
    const body=best<-.2?.4:best<.1?.5+.5*(best+.45):.62+.38*Math.pow(Math.min(1,best),.6);
    shade[i]=body*(1+.05*tone)*(.92+.14*ply*(best>0?1:.4))*(.93+.12*fuzz)*(1-.12*Math.pow(rim,5));
  }
  const n=document.createElement('canvas');n.width=W;n.height=Hh;const nc=n.getContext('2d'),nd=nc.createImageData(W,Hh);
  const a=document.createElement('canvas');a.width=W;a.height=Hh;const ac=a.getContext('2d'),ad=ac.createImageData(W,Hh);
  // normal map from physical slopes (yarn relief ≈ 1.25 mm)
  const H=(x,y)=>height[((y+Hh)%Hh)*W+((x+W)%W)],relief=.9,sx=relief*px/ST,sy=relief*px/RW;
  let mean=0;for(let i=0;i<shade.length;i++)mean+=shade[i];mean/=shade.length;
  const gain=Math.min(1.12,.84/mean); // keep the fabric's average tone close to the yarn colour
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){
    const gx=(H(x+1,y)-H(x-1,y))/2*sx,gy=(H(x,y-1)-H(x,y+1))/2*sy;
    let nx=-gx,ny=-gy,nz=1;const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
    const i=(y*W+x)*4;nd.data[i]=(nx*.5+.5)*255;nd.data[i+1]=(ny*.5+.5)*255;nd.data[i+2]=(nz*.5+.5)*255;nd.data[i+3]=255;
    const sv=shade[y*W+x]*gain,v=(sv<.9?sv:.9+.1*(1-Math.exp(-(sv-.9)*6)))*255;ad.data[i]=ad.data[i+1]=ad.data[i+2]=v;ad.data[i+3]=255;
  }
  nc.putImageData(nd,0,0);ac.putImageData(ad,0,0);
  const out={normal:n,albedo:a,cols,rows};canvasCache.set(key,out);return out;
}
function fabricCanvas(px=256){
  const key='fabric'+px;if(canvasCache.has(key))return canvasCache.get(key);
  const W=px,h=new Float32Array(W*W);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
    const twill=.5+.5*Math.sin((x+y)*Math.PI*2/6),n=valueNoise(x/3,y/3,W/3,11)*.6+valueNoise(x/11,y/11,Math.ceil(W/11),13)*.4;
    h[y*W+x]=twill*.35+n*.65;
  }
  const c=document.createElement('canvas');c.width=c.height=W;const ctx=c.getContext('2d'),d=ctx.createImageData(W,W);
  const H=(x,y)=>h[((y+W)%W)*W+((x+W)%W)];
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
    const gx=(H(x+1,y)-H(x-1,y))*.9,gy=(H(x,y-1)-H(x,y+1))*.9,l=Math.hypot(gx,gy,1),i=(y*W+x)*4;
    d.data[i]=(-gx/l*.5+.5)*255;d.data[i+1]=(-gy/l*.5+.5)*255;d.data[i+2]=(1/l*.5+.5)*255;d.data[i+3]=255;
  }
  ctx.putImageData(d,0,0);const out={normal:c};canvasCache.set(key,out);return out;
}

export function knitMaps(renderer,kind){
  const c=knitCanvas(kind),aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const make=(canvas,srgb)=>{const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/c.cols,1/c.rows);t.anisotropy=aniso;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;return t;};
  return{normalMap:make(c.normal,false),map:make(c.albedo,true)};
}
export function fabricMaps(renderer,repeat=1){
  const c=fabricCanvas(),t=new THREE.CanvasTexture(c.normal);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.colorSpace=THREE.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return{normalMap:t};
}

// Filmic tone mapping desaturates bright, saturated yarns. Invert three.js' ACES fit for the
// studio's typical lit exposure so the rendered front of the garment matches the swatch colour.
const EXPOSURE=.9,LIT=.87;
const ACES_IN=[[.59719,.35458,.04823],[.076,.90834,.01566],[.0284,.13383,.83777]],ACES_OUT=[[1.60475,-.53108,-.07367],[-.10208,1.10813,-.00605],[-.00327,-.07276,1.07602]];
const mv=(m,v)=>m.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]);
const acesFit=v=>v.map(x=>(x*(x+.0245786)-.000090537)/(x*(.983729*x+.432951)+.238081));
const aces=c=>mv(ACES_OUT,acesFit(mv(ACES_IN,c.map(x=>x*EXPOSURE/.6)))).map(x=>Math.min(1,Math.max(0,x)));
function swatchColor(hex){
  const t=new THREE.Color(hex),T=[t.r,t.g,t.b];let A=T.slice();
  for(let i=0;i<40;i++){const r=aces(A.map(x=>x*LIT));A=A.map((a,j)=>Math.min(1,Math.max(0,a*Math.pow(T[j]/Math.max(r[j],1e-4),.8))));}
  return new THREE.Color().setRGB(A[0],A[1],A[2]);
}
export function yarnMaterial(color,maps,{sheen=.7,normalScale=.9}={}){
  const base=swatchColor(color),sheenColor=base.clone().lerp(new THREE.Color('#ffffff'),.14);
  return new THREE.MeshPhysicalMaterial({color:base,map:maps.map,normalMap:maps.normalMap,normalScale:new THREE.Vector2(normalScale,normalScale),roughness:.92,metalness:0,sheen,sheenRoughness:.55,sheenColor,vertexColors:true,envMapIntensity:.85});
}
export function mannequinMaterial(color='#dccdc1'){
  return new THREE.MeshPhysicalMaterial({color,roughness:.52,metalness:0,clearcoat:.2,clearcoatRoughness:.5,sheen:.2,sheenRoughness:.6,sheenColor:new THREE.Color('#fff2ea'),vertexColors:true,envMapIntensity:.62});
}
export function clothMaterial(color,maps,{roughness=.88,sheen=.35}={}){
  return new THREE.MeshPhysicalMaterial({color,normalMap:maps?.normalMap||null,normalScale:new THREE.Vector2(.5,.5),roughness,metalness:0,sheen,sheenRoughness:.7,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#ffffff'),.3),vertexColors:true,envMapIntensity:.8,side:THREE.DoubleSide});
}
