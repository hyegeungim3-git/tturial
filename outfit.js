// Builds render-ready mesh data for the dressed mannequin (pure JS: runs in a worker or in Node).
import {bodySpec} from './body-model.js';
import {polygonize,splitMesh,computeNormals,bakeOcclusion,filterTriangles,clamp,lerp} from './sdf-mesh.js';
import {trousersModel,sneakersModel,sweaterModel,ribFields,applyStitchUV,sleeveLoop,onPath} from './garment-model.js';

const TAU=Math.PI*2;
const key=p=>[p.height,p.chest,p.arm,p.shoulder].join('/');
const baseCache=new Map();

function timed(stats,name,fn){const t=performance.now(),r=fn();stats[name]=Math.round(performance.now()-t);return r;}

// Occlusion proxy: a cached grid of the mannequin field, inflated by the layer thickness of the
// surface being shaded, plus cheap garment shells.
const gridCache=new WeakMap();
function occluder(body,inflate=0,extra=[]){
  let grid=gridCache.get(body);
  if(!grid){const f=body.field();const b=body.bounds;grid=sampleGridFast((x,y,z,l)=>l?l(x,y,z):f.eval(x,y,z),f,{min:[b.min[0]-.1,-.02,b.min[2]-.1],max:[b.max[0]+.1,body.H+.06,b.max[2]+.1]},.014);gridCache.set(body,grid);}
  return(x,y,z)=>{let d=grid(x,y,z)-inflate;for(const e of extra){const v=e(x,y,z);if(v<d)d=v;}return d;};
}
// Dense trilinear grid with block-level early outs (far blocks are filled with their centre value).
function sampleGridFast(fn,model,box,cell,far=.14){
  const [x0,y0,z0]=box.min,nx=Math.ceil((box.max[0]-x0)/cell)+1,ny=Math.ceil((box.max[1]-y0)/cell)+1,nz=Math.ceil((box.max[2]-z0)/cell)+1,B=6;
  const data=new Float32Array(nx*ny*nz);
  for(let bk=0;bk<nz;bk+=B)for(let bj=0;bj<ny;bj+=B)for(let bi=0;bi<nx;bi+=B){
    const cx=x0+(bi+B/2)*cell,cy=y0+(bj+B/2)*cell,cz=z0+(bk+B/2)*cell,rad=B*cell*.87,d0=fn(cx,cy,cz);
    if(d0>far+rad){for(let k=bk;k<Math.min(bk+B+1,nz);k++)for(let j=bj;j<Math.min(bj+B+1,ny);j++)for(let i=bi;i<Math.min(bi+B+1,nx);i++)data[i+nx*(j+ny*k)]=far;continue;}
    const l=model.local(cx,cy,cz,rad+.02,Math.abs(d0));
    for(let k=bk;k<Math.min(bk+B+1,nz);k++)for(let j=bj;j<Math.min(bj+B+1,ny);j++)for(let i=bi;i<Math.min(bi+B+1,nx);i++)data[i+nx*(j+ny*k)]=Math.min(far,fn(x0+i*cell,y0+j*cell,z0+k*cell,l));
  }
  return(x,y,z)=>{
    let fx=(x-x0)/cell,fy=(y-y0)/cell,fz=(z-z0)/cell;
    if(fx<0||fy<0||fz<0||fx>=nx-1||fy>=ny-1||fz>=nz-1)return far;
    const i=fx|0,j=fy|0,k=fz|0;fx-=i;fy-=j;fz-=k;
    const q=i+nx*(j+ny*k),s=nx*ny,a=data[q],b=data[q+1],c=data[q+nx],d=data[q+nx+1],e=data[q+s],g=data[q+s+1],h=data[q+s+nx],m=data[q+s+nx+1];
    return lerp(lerp(lerp(a,b,fx),lerp(c,d,fx),fy),lerp(lerp(e,g,fx),lerp(h,m,fx),fy),fz);
  };
}

function finish(mesh,occ,opts={}){computeNormals(mesh);bakeOcclusion(mesh,occ,{steps:[.014,.035,.07,.12],strength:opts.ao??.95,floor:opts.floor??.3});return mesh;}

// Mannequin only (measurement avatar).
export function buildMannequin(profile,{cell=.0045}={}){
  const stats={},body=timed(stats,'spec',()=>bodySpec(profile)),f=body.field();
  const mesh=timed(stats,'mesh',()=>polygonize(f,body.bounds,cell));
  timed(stats,'shade',()=>{finish(mesh,occluder(body,0),{ao:.85,floor:.4});});
  return{body:{H:body.H,levels:body.levels,joints:body.joints,girthScale:body.girthScale,bounds:body.bounds},mesh,stats};
}

// Everything that depends only on the wearer: visible skin, trousers, sneakers. Cached.
export function outfitBase(profile,{cell=.0045}={}){
  const k=key(profile)+'@'+cell;if(baseCache.has(k))return baseCache.get(k);
  const stats={},body=timed(stats,'spec',()=>bodySpec(profile)),bf=body.field(),lv=body.levels,J=body.joints;
  const pants=trousersModel(body),shoes=sneakersModel(body);
  // visible skin: head and neck, both arms (sleeve length varies); the rest stays under clothes
  const skinBox={min:[body.bounds.min[0],.36*body.H,body.bounds.min[2]],max:[body.bounds.max[0],body.H+.02,body.bounds.max[2]]};
  const limbs=['R','L'].flatMap(k=>{const j=J[k];return[[j.shoulder,j.elbow],[j.elbow,j.wrist],[j.wrist,j.handTip]];});
  const keepSkin=(x,y,z)=>y>lv.neck-.045||limbs.some(([a,b])=>segDist([x,y,z],a,b)<.075);
  const skin=timed(stats,'skin',()=>filterTriangles(polygonize(bf,skinBox,cell*.9),keepSkin));
  const trousers=timed(stats,'trousers',()=>{let m=polygonize(pants.field,pants.box,cell*1.1);for(const c of pants.clips)m=splitMesh(m,c).neg;return m;});
  const sneakers=timed(stats,'sneakers',()=>polygonize(shoes.field,shoes.box,cell*.9));
  timed(stats,'shade',()=>{
    finish(skin,occluder(body,0),{ao:.8,floor:.4});
    finish(trousers,occluder(body,.007,[]),{ao:.9});
    finish(sneakers,occluder(body,.004),{ao:.7,floor:.45});
  });
  // flannel weave coordinates (1 unit = 2 cm) around each trouser leg; sole tinted off-white
  const tp=trousers.positions,tuv=new Float32Array(tp.length/3*2);
  for(let i=0;i<tp.length/3;i++){const x=tp[i*3],y=tp[i*3+1],z=tp[i*3+2],leg=pants.legs[x<0?0:1],a=Math.atan2(x-leg.top[0],z-leg.top[2]);tuv[i*2]=a*.09/.02;tuv[i*2+1]=y/.02;}
  trousers.uvs=tuv;
  const sp=sneakers.positions,sc=new Float32Array(sp.length);
  for(let i=0;i<sp.length/3;i++){const y=sp[i*3+1],sole=y<shoes.soleTop?1:y<shoes.soleTop+.004?(shoes.soleTop+.004-y)/.004:0,ao=sneakers.ao[i];sc[i*3]=ao*(1-.07*sole);sc[i*3+1]=ao*(1-.08*sole);sc[i*3+2]=ao*(1-.1*sole);}
  sneakers.colors=sc;
  const base={profile:{...profile},body,pants,shoes,skin,trousers,sneakers,stats};
  baseCache.set(k,base);if(baseCache.size>4)baseCache.delete(baseCache.keys().next().value);
  return base;
}

// Sweater for a compiled design on a cached base. rings: sleeveRings(plan).
export function buildSweater(base,plan,rings,{cell=.004}={}){
  const stats={},body=base.body;
  const sw=timed(stats,'model',()=>sweaterModel(body,plan,rings,{eval:base.pants.field.eval,local:base.pants.field.local,top:base.pants.waist}));
  const rib=ribFields(sw,body);
  let main=timed(stats,'mesh',()=>polygonize(sw.field,sw.box,cell));
  main=splitMesh(main,sw.cuts.neck).neg;
  const occ=timed(stats,'occluder',()=>occluder(body,.012,[(x,y,z)=>sw.torsoField(x,y,z)]));
  timed(stats,'shade',()=>finish(main,occ));
  // regions: sleeves outside the raglan lines, body in between (shading carried across the seams)
  const parts={},attrs={attrs:['normals','ao']};
  timed(stats,'regions',()=>{
    let rest=main;
    for(const q of sw.sleeves){
      const sp=splitMesh(rest,sw.regionField(q),attrs);
      parts['sleeve-'+(q.k==='L'?'left':'right')]=splitMesh(sp.pos,sw.cuts.cuff(q),attrs).neg;
      rest=sp.neg;
    }
    parts.body=splitMesh(rest,sw.cuts.hem,attrs).neg;
  });
  const bands=timed(stats,'ribs',()=>({
    hem:polygonize(rib.hem,(()=>{let m=0;for(const v of sw.band.r)m=Math.max(m,v);m+=.02;return{min:[-m,sw.hemY-.01,sw.zc-m],max:[m,sw.bandTop+.01,sw.zc+m]};})(),cell*.8),
    collar:polygonize(rib.collar,{min:[-.12,sw.hps-.12,-.14],max:[.12,sw.hps+.08,.1]},cell*.6),
    cuffs:sw.sleeves.map(q=>{
      const g=q.P.segs.find(x=>sw.cuffS>=x.s0&&sw.cuffS<=x.s0+x.l)||q.P.segs.at(-1),c=[g.a[0]+g.d[0]*(sw.cuffS-g.s0),g.a[1]+g.d[1]*(sw.cuffS-g.s0),g.a[2]+g.d[2]*(sw.cuffS-g.s0)];
      return polygonize(rib.cuff(q),{min:[c[0]-.1,c[1]-.12,c[2]-.1],max:[c[0]+.1,c[1]+.06,c[2]+.1]},cell*.7);
    })
  }));
  timed(stats,'shadeRibs',()=>{finish(bands.hem,occ);finish(bands.collar,occ);bands.cuffs.forEach(m=>finish(m,occ));});
  // stitch coordinates: one UV unit = one stitch (u) / one row (v)
  timed(stats,'uv',()=>{
    const cutT=Math.PI/2,refT=cutT+Math.PI; // the round starts under the left arm
    const N=Math.max(4,Math.round(sw.girthAt(body.levels.bust)*sw.sg/4)*4); // stitch columns around the body
    const torsoParam=(x,y,z)=>{
      const th=Math.atan2(x,z-sw.zc),a=cutAngle(th,cutT),girth=sw.girthAt(y);
      let u=(sw.arcAt(y,th)-sw.arcAt(y,refT))%girth;if(u<0)u+=girth;if(a<0)u-=girth;
      return[a,u/girth*N,(y-sw.hemY)*sw.rg];
    };
    parts.body=applyStitchUV(parts.body,torsoParam,()=>N);
    const around=(q,x,y,z)=>{const o=onPath(q.P,x,y,z),ex=x-o.cx,ey=y-o.cy,ez=z-o.cz;return[o,Math.atan2(ex*o.g.e2[0]+ey*o.g.e2[1]+ez*o.g.e2[2],ex*o.g.e1[0]+ey*o.g.e1[1]+ez*o.g.e1[2]),Math.hypot(ex,ey,ez)];};
    for(const q of sw.sleeves){
      const name='sleeve-'+(q.k==='L'?'left':'right');
      // arc length at the point's own radius; the round's jog sits on the underarm decrease line
      parts[name]=applyStitchUV(parts[name],(x,y,z)=>{const [o,phi,r]=around(q,x,y,z);return[phi,phi*r*sw.sg,o.s*sw.rg];},p=>{const [,,r]=around(q,...p);return TAU*r*sw.sg;});
    }
    const ring=r=>Math.max(4,Math.round(TAU*r*sw.sg/4)*4);
    const hemN=ring(sw.girthAt((sw.hemY+sw.bandTop)/2)/TAU),colN=ring(sw.R0),cufN=ring(sw.patternR(sw.endS));
    bands.hem=applyStitchUV(bands.hem,(x,y,z)=>{const a=cutAngle(Math.atan2(x,z-sw.zc),cutT);return[a,a/TAU*hemN,(y-sw.hemY)*sw.rg];},()=>hemN);
    bands.collar=applyStitchUV(bands.collar,(x,y,z)=>{const th=Math.atan2(x,z-sw.neckAxis[2]);return[th,th/TAU*colN,(y-rib.collarBase(th))*sw.rg];},()=>colN);
    bands.cuffs=bands.cuffs.map((m,i)=>{const q=sw.sleeves[i];return applyStitchUV(m,(x,y,z)=>{const [o,phi]=around(q,x,y,z);return[phi,phi/TAU*cufN,o.s*sw.rg];},()=>cufN);});
  });
  let loops=[];
  if(plan.sleeve.continuation){
    const kept=rings[plan.sleeve.capRows+plan.sleeve.continuation.lockedRows];
    if(kept)loops=sw.sleeves.map(q=>sleeveLoop(sw,q,kept.yCm/100));
  }
  const measure={chestGirth:sw.girthAt(body.levels.bust),hemY:sw.hemY,sleeveEnd:sw.endS,cuffStart:sw.cuffS};
  return{parts,bands,loops,measure,stats,sleevePaths:sw.sleeves.map(q=>q.P.segs.map(g=>({a:g.a,b:g.b})))};
}
// angle in (-π, π] whose discontinuity sits at `cut`
function cutAngle(a,cut){let v=a-cut-Math.PI;v-=TAU*Math.floor((v+Math.PI)/TAU);return v;}
function segDist(p,a,b){const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]],t=clamp((ap[0]*ab[0]+ap[1]*ab[1]+ap[2]*ab[2])/(ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2]),0,1);return Math.hypot(ap[0]-ab[0]*t,ap[1]-ab[1]*t,ap[2]-ab[2]*t);}
