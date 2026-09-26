// Signed-distance modelling and a narrow-band surface-nets mesher. Units: metres.
// Pure JavaScript (no Three.js) so shapes can be measured in Node tests.
const {sqrt,abs,min,max,sign}=Math;
export const smin=(a,b,k)=>{if(k<=0)return a<b?a:b;const h=k-abs(a-b);return (a<b?a:b)-(h>0?h*h*.25/k:0);};
export const smax=(a,b,k)=>-smin(-a,-b,k);
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export const lerp=(a,b,t)=>a+(b-a)*t;
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const len=a=>sqrt(dot(a,a));
export const norm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
export const mix3=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
// Orthonormal frame whose local y axis follows `dir` and local z leans toward `hint`.
export function frame(dir,hint=[0,0,1]){
  const y=norm(dir);let x=cross(y,hint);if(len(x)<1e-6)x=cross(y,[1,0,0]);x=norm(x);return[x,y,cross(x,y)];
}
export const rotate=(v,axis,angle)=>{const k=norm(axis),c=Math.cos(angle),s=Math.sin(angle),d=dot(k,v),x=cross(k,v);return[v[0]*c+x[0]*s+k[0]*d*(1-c),v[1]*c+x[1]*s+k[1]*d*(1-c),v[2]*c+x[2]*s+k[2]*d*(1-c)];};

// Primitive descriptions. k = blend radius into the shape built so far; op: 0 union, 1 subtract.
export const sphere=(c,r,o={})=>({kind:0,c,r,...o});
export const ellipsoid=(c,radii,axes=null,o={})=>({kind:1,c,radii,axes,...o});
export const cone=(a,b,ra,rb,o={})=>({kind:2,a,b,ra,rb,...o});
export const plane=(n,d,o={})=>({kind:3,n:norm(n),d,...o});
const STRIDE=16;

export function sdfModel(list){
  const n=list.length,D=new Float64Array(n*STRIDE),kind=new Int8Array(n),op=new Int8Array(n),ks=new Float64Array(n),bounds=new Float64Array(n*4);
  list.forEach((p,i)=>{
    const o=i*STRIDE;kind[i]=p.kind;op[i]=p.sub?1:0;ks[i]=p.k||0;let c,R;
    if(p.kind===0){D.set([...p.c,p.r],o);c=p.c;R=p.r;}
    else if(p.kind===1){const a=p.axes||[[1,0,0],[0,1,0],[0,0,1]];D.set([...p.c,...p.radii,...a[0],...a[1],...a[2]],o);c=p.c;R=max(...p.radii);}
    else if(p.kind===2){const ba=sub(p.b,p.a),l2=dot(ba,ba),rr=p.ra-p.rb;D.set([...p.a,...ba,l2,rr,l2-rr*rr,1/l2,p.ra,p.rb],o);c=mul(add(p.a,p.b),.5);R=sqrt(l2)/2+max(p.ra,p.rb);}
    else {D.set([...p.n,p.d],o);c=[0,0,0];R=Infinity;}
    bounds.set([...c,R+(p.k||0)],i*4);
  });
  function run(idx,count,x,y,z){
    let acc=1e9;
    for(let q=0;q<count;q++){
      const i=idx[q],o=i*STRIDE;let d;
      switch(kind[i]){
        case 0:{const px=x-D[o],py=y-D[o+1],pz=z-D[o+2];d=sqrt(px*px+py*py+pz*pz)-D[o+3];break;}
        case 1:{
          const px=x-D[o],py=y-D[o+1],pz=z-D[o+2],rx=D[o+3],ry=D[o+4],rz=D[o+5];
          const lx=(px*D[o+6]+py*D[o+7]+pz*D[o+8])/rx,ly=(px*D[o+9]+py*D[o+10]+pz*D[o+11])/ry,lz=(px*D[o+12]+py*D[o+13]+pz*D[o+14])/rz;
          const k0=sqrt(lx*lx+ly*ly+lz*lz),k1=sqrt(lx*lx/(rx*rx)+ly*ly/(ry*ry)+lz*lz/(rz*rz));
          d=k1>1e-12?k0*(k0-1)/k1:-min(rx,ry,rz);break;
        }
        case 2:{
          const pax=x-D[o],pay=y-D[o+1],paz=z-D[o+2],bax=D[o+3],bay=D[o+4],baz=D[o+5],l2=D[o+6],rr=D[o+7],a2=D[o+8],il2=D[o+9];
          const yy=pax*bax+pay*bay+paz*baz,zz=yy-l2,qx=pax*l2-bax*yy,qy=pay*l2-bay*yy,qz=paz*l2-baz*yy;
          const x2=qx*qx+qy*qy+qz*qz,y2=yy*yy*l2,z2=zz*zz*l2,kk=sign(rr)*rr*rr*x2;
          if(sign(zz)*a2*z2>kk)d=sqrt(x2+z2)*il2-D[o+11];
          else if(sign(yy)*a2*y2<kk)d=sqrt(x2+y2)*il2-D[o+10];
          else d=(sqrt(x2*a2*il2)+yy*rr)*il2-D[o+10];
          break;
        }
        default:d=D[o]*x+D[o+1]*y+D[o+2]*z-D[o+3];
      }
      const k=ks[i];
      if(op[i]===0){if(k>0){const h=k-abs(acc-d);acc=(acc<d?acc:d)-(h>0?h*h*.25/k:0);}else if(d<acc)acc=d;}
      else{d=-d;if(k>0){const h=k-abs(acc-d);acc=(acc>d?acc:d)+(h>0?h*h*.25/k:0);}else if(d>acc)acc=d;}
    }
    return acc;
  }
  const all=Int32Array.from({length:n},(_,i)=>i);
  const evaluate=(x,y,z)=>run(all,n,x,y,z);
  // Keeps only primitives that can change the field inside a sphere (cx,cy,cz,r).
  function local(cx,cy,cz,r,slack=0){
    const keep=[];
    for(let i=0;i<n;i++){const b=i*4,dx=cx-bounds[b],dy=cy-bounds[b+1],dz=cz-bounds[b+2];if(sqrt(dx*dx+dy*dy+dz*dz)-bounds[b+3]-r<slack+r)keep.push(i);}
    if(keep.length===n)return evaluate;
    const idx=Int32Array.from(keep),c=idx.length;return(x,y,z)=>c?run(idx,c,x,y,z):1e9;
  }
  return{count:n,eval:evaluate,local,list};
}

// Open-addressing integer hash (keys >= 0) backed by typed arrays.
function intMap(bits=16){
  let cap=1<<bits,shift=32-bits,keys=new Int32Array(cap).fill(-1),vals=new Float64Array(cap),size=0;
  const slot=k=>{let h=Math.imul(k,-1640531535)>>>shift;while(keys[h]!==-1&&keys[h]!==k)h=(h+1)&(cap-1);return h;};
  function grow(){const ok=keys,ov=vals;bits++;cap=1<<bits;shift=32-bits;keys=new Int32Array(cap).fill(-1);vals=new Float64Array(cap);for(let i=0;i<ok.length;i++)if(ok[i]!==-1){const h=slot(ok[i]);keys[h]=ok[i];vals[h]=ov[i];}}
  return{
    get(k){const h=slot(k);return keys[h]===k?vals[h]:NaN;},
    set(k,v){if(size*2>=cap)grow();const h=slot(k);if(keys[h]!==k){keys[h]=k;size++;}vals[h]=v;},
    get size(){return size;}
  };
}

// Surface-following naive surface nets: only cells crossed by the zero set are sampled.
// field: {eval(x,y,z), local?(cx,cy,cz,r,slack)} or a plain function. Seeds come from a coarse
// lattice, so every connected part larger than `seed` cells is found.
export function polygonize(field,box,cell,{seed=4,block=6,project=1,clip=null}={}){
  const f=typeof field==='function'?{eval:field}:field;
  const [x0,y0,z0]=box.min,[x1,y1,z1]=box.max;
  const nx=Math.ceil((x1-x0)/cell),ny=Math.ceil((y1-y0)/cell),nz=Math.ceil((z1-z0)/cell);
  const sx=nx+1,sy=ny+1,B=block,bx=Math.ceil(nx/B)+1,by=Math.ceil(ny/B)+1;
  const locals=new Map(),samples=intMap(18),vmap=intMap(16),seen=new Uint8Array((nx*ny*nz>>3)+1);
  const fnFor=(i,j,k)=>{
    const bi=(i/B)|0,bj=(j/B)|0,bk=(k/B)|0,key=bi+bx*(bj+by*bk);
    let g=locals.get(key);
    if(!g){
      const cx=x0+(bi+.5)*B*cell,cy=y0+(bj+.5)*B*cell,cz=z0+(bk+.5)*B*cell,r=B*cell*.87+2*cell;
      g=f.local?f.local(cx,cy,cz,r,abs(f.eval(cx,cy,cz))):f.eval;locals.set(key,g);
    }
    return g;
  };
  let g0=null;
  const value=(i,j,k)=>{
    const key=i+sx*(j+sy*k);let v=samples.get(key);
    if(v!==v){v=(g0||fnFor(i,j,k))(x0+i*cell,y0+j*cell,z0+k*cell);samples.set(key,v);}
    return v;
  };
  const pos=[],cells=[],masks=[],owner=[],queue=[];
  const push=(i,j,k)=>{if(i<0||j<0||k<0||i>=nx||j>=ny||k>=nz)return;const key=i+nx*(j+ny*k);if(seen[key>>3]&(1<<(key&7)))return;seen[key>>3]|=1<<(key&7);queue.push(i,j,k);};
  // coarse seeds: walk each coarse lattice edge that changes sign down to a fine cell
  const C=seed,cnx=Math.ceil(nx/C),cny=Math.ceil(ny/C),cnz=Math.ceil(nz/C),coarse=new Float32Array((cnx+1)*(cny+1)*(cnz+1));
  const cidx=(a,b,c)=>a+(cnx+1)*(b+(cny+1)*c);
  for(let c=0;c<=cnz;c++)for(let b=0;b<=cny;b++)for(let a=0;a<=cnx;a++)coarse[cidx(a,b,c)]=value(Math.min(a*C,nx),Math.min(b*C,ny),Math.min(c*C,nz));
  for(let c=0;c<=cnz;c++)for(let b=0;b<=cny;b++)for(let a=0;a<=cnx;a++){
    const v0=coarse[cidx(a,b,c)]<0;
    for(let ax=0;ax<3;ax++){
      const da=ax===0?1:0,db=ax===1?1:0,dc=ax===2?1:0;
      if(a+da>cnx||b+db>cny||c+dc>cnz||v0===(coarse[cidx(a+da,b+db,c+dc)]<0))continue;
      let i=Math.min(a*C,nx),j=Math.min(b*C,ny),k=Math.min(c*C,nz),prev=v0;
      for(let s=0;s<C;s++){
        const ni=Math.min(i+da,nx),nj=Math.min(j+db,ny),nk=Math.min(k+dc,nz),nv=value(ni,nj,nk)<0;
        if(nv!==prev){
          if(da){push(i,j,k);push(i,j-1,k);push(i,j,k-1);push(i,j-1,k-1);}
          else if(db){push(i,j,k);push(i-1,j,k);push(i,j,k-1);push(i-1,j,k-1);}
          else{push(i,j,k);push(i-1,j,k);push(i,j-1,k);push(i-1,j-1,k);}
          break;
        }
        i=ni;j=nj;k=nk;prev=nv;
      }
    }
  }
  const cv=new Float64Array(8);
  while(queue.length){
    const k=queue.pop(),j=queue.pop(),i=queue.pop();
    g0=fnFor(i,j,k);
    let mask=0;
    for(let c=0;c<8;c++){const val=value(i+(c&1),j+(c>>1&1),k+(c>>2&1));cv[c]=val;if(val<0)mask|=1<<c;}
    g0=null;
    if(mask===0||mask===255)continue;
    // faces with mixed corner signs lead to neighbours that the surface also crosses
    const m0=mask&1,m1=mask>>1&1,m2=mask>>2&1,m3=mask>>3&1,m4=mask>>4&1,m5=mask>>5&1,m6=mask>>6&1,m7=mask>>7&1;
    let q=m0+m2+m4+m6;if(q&&q<4)push(i-1,j,k);
    q=m1+m3+m5+m7;if(q&&q<4)push(i+1,j,k);
    q=m0+m1+m4+m5;if(q&&q<4)push(i,j-1,k);
    q=m2+m3+m6+m7;if(q&&q<4)push(i,j+1,k);
    q=m0+m1+m2+m3;if(q&&q<4)push(i,j,k-1);
    q=m4+m5+m6+m7;if(q&&q<4)push(i,j,k+1);
    let px=0,py=0,pz=0,m=0;
    for(let e=0;e<12;e++){
      const a=EA[e],b=EB[e];
      if(((mask>>a)&1)===((mask>>b)&1))continue;
      const t=cv[a]/(cv[a]-cv[b]);
      px+=(a&1)+((b&1)-(a&1))*t;py+=(a>>1&1)+((b>>1&1)-(a>>1&1))*t;pz+=(a>>2&1)+((b>>2&1)-(a>>2&1))*t;m++;
    }
    vmap.set(i+nx*(j+ny*k),pos.length/3);
    pos.push(x0+(i+px/m)*cell,y0+(j+py/m)*cell,z0+(k+pz/m)*cell);cells.push(i,j,k);masks.push(mask);owner.push(fnFor(i,j,k));
  }
  const tri=[];
  const P=(a,b)=>{const dx=pos[a*3]-pos[b*3],dy=pos[a*3+1]-pos[b*3+1],dz=pos[a*3+2]-pos[b*3+2];return dx*dx+dy*dy+dz*dz;};
  function quad(a,b,c,d,flip){
    if(a!==a||b!==b||c!==c||d!==d)return;
    if(flip){const t=b;b=d;d=t;}
    if(P(a,c)<=P(b,d))tri.push(a,b,c,a,c,d);else tri.push(a,b,d,b,c,d);
  }
  const id=(i,j,k)=>i<0||j<0||k<0?NaN:vmap.get(i+nx*(j+ny*k));
  for(let q=0;q<masks.length;q++){
    const mask=masks[q],i=cells[q*3],j=cells[q*3+1],k=cells[q*3+2],inside=mask&1;
    if(inside!==((mask>>1)&1))quad(id(i,j-1,k-1),id(i,j,k-1),id(i,j,k),id(i,j-1,k),!inside);
    if(inside!==((mask>>2)&1))quad(id(i-1,j,k-1),id(i-1,j,k),id(i,j,k),id(i,j,k-1),!inside);
    if(inside!==((mask>>4)&1))quad(id(i-1,j-1,k),id(i,j-1,k),id(i,j,k),id(i-1,j,k),!inside);
  }
  const positions=Float32Array.from(pos);
  // Pull vertices onto the zero set along the local gradient (tetrahedral differences, 4 samples).
  const T=[[1,-1,-1],[-1,-1,1],[-1,1,-1],[1,1,1]];
  for(let it=0;it<project;it++)for(let q=0;q<masks.length;q++){
    const g=owner[q],x=positions[q*3],y=positions[q*3+1],z=positions[q*3+2],h=cell*.2;
    let d=0,gx=0,gy=0,gz=0;
    for(const [a,b,c] of T){const v=g(x+a*h,y+b*h,z+c*h);d+=v;gx+=a*v;gy+=b*v;gz+=c*v;}
    d/=4;gx/=4*h;gy/=4*h;gz/=4*h;
    const l2=gx*gx+gy*gy+gz*gz;if(l2<1e-8||abs(d)>cell)continue;
    const s=clamp(d/l2,-cell*.5,cell*.5);
    positions[q*3]=x-gx*s;positions[q*3+1]=y-gy*s;positions[q*3+2]=z-gz*s;
  }
  let mesh={positions,indices:Uint32Array.from(tri),stats:{samples:samples.size,cells:masks.length}};
  if(clip)for(const c of clip)mesh=splitMesh(mesh,c).neg;
  return mesh;
}
const EA=[0,2,4,6,0,1,4,5,0,1,2,3],EB=[1,3,5,7,2,3,6,7,4,5,6,7];

// Splits triangles on the zero set of fieldFn(x,y,z); returns watertight neg/pos parts.
// Extra per-vertex float attributes (e.g. normals) are interpolated when present.
export function splitMesh(mesh,fieldFn,{attrs=[]}={}){
  const P=mesh.positions,I=mesh.indices,nv=P.length/3,fv=new Float64Array(nv);
  for(let i=0;i<nv;i++)fv[i]=fieldFn(P[i*3],P[i*3+1],P[i*3+2]);
  const extra=attrs.map(name=>({name,src:mesh[name],size:mesh[name].length/nv}));
  const newPos=[],newExtra=extra.map(()=>[]),edgeMap=new Map();
  const vert=i=>i;
  function cut(a,b){
    const key=a<b?a*nv+b:b*nv+a;let v=edgeMap.get(key);if(v!==undefined)return v;
    const t=fv[a]/(fv[a]-fv[b]);v=nv+newPos.length/3;
    for(let c=0;c<3;c++)newPos.push(P[a*3+c]+(P[b*3+c]-P[a*3+c])*t);
    extra.forEach((e,q)=>{for(let c=0;c<e.size;c++)newExtra[q].push(e.src[a*e.size+c]+(e.src[b*e.size+c]-e.src[a*e.size+c])*t);});
    edgeMap.set(key,v);return v;
  }
  const neg=[],pos=[];
  for(let t=0;t<I.length;t+=3){
    const a=I[t],b=I[t+1],c=I[t+2],sa=fv[a]<0,sb=fv[b]<0,sc=fv[c]<0;
    if(sa===sb&&sb===sc){(sa?neg:pos).push(a,b,c);continue;}
    // rotate so that `a` is the odd vertex out
    let o,p,q;if(sa!==sb&&sa!==sc){o=a;p=b;q=c;}else if(sb!==sa&&sb!==sc){o=b;p=c;q=a;}else{o=c;p=a;q=b;}
    const op=cut(o,p),oq=cut(o,q),lone=fv[o]<0?neg:pos,pair=fv[o]<0?pos:neg;
    lone.push(vert(o),op,oq);pair.push(op,vert(p),vert(q),op,vert(q),oq);
  }
  const allPos=new Float32Array(P.length+newPos.length);allPos.set(P);allPos.set(newPos,P.length);
  const all={positions:allPos};
  extra.forEach((e,q)=>{
    const arr=new Float32Array(e.src.length+newExtra[q].length);arr.set(e.src);arr.set(newExtra[q],e.src.length);
    if(e.name==='normals')for(let i=e.src.length;i<arr.length;i+=3){const l=Math.hypot(arr[i],arr[i+1],arr[i+2])||1;arr[i]/=l;arr[i+1]/=l;arr[i+2]/=l;}
    all[e.name]=arr;
  });
  return{neg:compact(all,neg,attrs),pos:compact(all,pos,attrs)};
}

// Drops unused vertices. `tri` is an index list into `src`.
export function compact(src,tri,attrs=[]){
  const nv=src.positions.length/3,remap=new Int32Array(nv).fill(-1),order=[];
  const indices=new Uint32Array(tri.length);
  for(let t=0;t<tri.length;t++){const v=tri[t];if(remap[v]<0){remap[v]=order.length;order.push(v);}indices[t]=remap[v];}
  const out={indices,positions:new Float32Array(order.length*3)};
  order.forEach((v,i)=>{out.positions.set(src.positions.subarray(v*3,v*3+3),i*3);});
  for(const name of attrs){const size=src[name].length/nv,arr=new Float32Array(order.length*size);order.forEach((v,i)=>arr.set(src[name].subarray(v*size,v*size+size),i*size));out[name]=arr;}
  return out;
}

export function filterTriangles(mesh,keep,attrs=[]){
  const P=mesh.positions,I=mesh.indices,out=[];
  for(let t=0;t<I.length;t+=3){
    const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3;
    if(keep((P[a]+P[b]+P[c])/3,(P[a+1]+P[b+1]+P[c+1])/3,(P[a+2]+P[b+2]+P[c+2])/3))out.push(I[t],I[t+1],I[t+2]);
  }
  return compact(mesh,out,attrs);
}

export function computeNormals(mesh){
  const P=mesh.positions,I=mesh.indices,N=new Float32Array(P.length);
  for(let t=0;t<I.length;t+=3){
    const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3;
    const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    for(const v of[a,b,c]){N[v]+=nx;N[v+1]+=ny;N[v+2]+=nz;}
  }
  for(let i=0;i<N.length;i+=3){const l=sqrt(N[i]*N[i]+N[i+1]*N[i+1]+N[i+2]*N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l;}
  mesh.normals=N;return mesh;
}

// Ambient occlusion from a distance field: fewer free-space samples along the normal = darker.
export function bakeOcclusion(mesh,f,{steps=[.012,.03,.06,.1],strength=1,floor=.28}={}){
  const P=mesh.positions,N=mesh.normals,nv=P.length/3,ao=new Float32Array(nv);
  for(let v=0;v<nv;v++){
    const x=P[v*3],y=P[v*3+1],z=P[v*3+2],nx=N[v*3],ny=N[v*3+1],nz=N[v*3+2];
    let occ=0,w=1,tot=0;
    for(const s of steps){const d=f(x+nx*s,y+ny*s,z+nz*s);occ+=w*clamp((s-d)/s,0,1);tot+=w;w*=.72;}
    ao[v]=max(floor,1-strength*occ/tot);
  }
  mesh.ao=ao;return mesh;
}
