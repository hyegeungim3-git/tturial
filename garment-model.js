// Outfit geometry on the mannequin: pattern-linked raglan sweater, wide wool trousers, sneakers.
// Garment surfaces are distance fields draped over the body (union with the dilated body keeps
// every layer outside the one below), then meshed, cut at the openings and split into regions.
import {smin,smax,clamp,smooth,lerp,add,sub,mul,dot,cross,norm,len} from './sdf-mesh.js';

const TAU=Math.PI*2;

// ---------- horizontal sections as polar functions around a vertical axis ----------
function outerRadius(f,y,zc,th,rmax=.5){
  const dx=Math.sin(th),dz=Math.cos(th);let r=rmax;
  for(let i=0;i<64;i++){const d=f(dx*r,y,zc+dz*r);if(d<4e-4)break;r-=Math.max(d*.9,6e-4);if(r<=0)return 0;}
  let lo=Math.max(0,r-.004),hi=r+.004;
  if(f(dx*hi,y,zc+dz*hi)<0)hi+=.02;
  for(let i=0;i<18;i++){const m=(lo+hi)/2;if(f(dx*m,y,zc+dz*m)<0)lo=m;else hi=m;}
  return(lo+hi)/2;
}
function hull2(pts){
  const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),c=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const q of p){while(lo.length>1&&c(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}
  for(const q of p.reverse()){while(up.length>1&&c(up.at(-2),up.at(-1),q)<=0)up.pop();up.push(q);}
  return lo.slice(0,-1).concat(up.slice(0,-1));
}
// Convex hull of a polar curve, offset outward by d, resampled at the same n angles.
function convexPolar(radii,d=0){
  const n=radii.length,pts=[];
  for(let a=0;a<n;a++){const t=a/n*TAU,r=Math.max(radii[a],1e-3);pts.push([Math.sin(t)*r,Math.cos(t)*r]);}
  const h=hull2(pts),out=new Float32Array(n);
  for(let a=0;a<n;a++){
    const t=a/n*TAU,dx=Math.sin(t),dz=Math.cos(t);let best=0,cosb=1;
    for(let i=0;i<h.length;i++){
      const p=h[i],q=h[(i+1)%h.length],ex=q[0]-p[0],ez=q[1]-p[1],den=dx*ez-dz*ex;
      if(Math.abs(den)<1e-12)continue;
      const s=(p[0]*ez-p[1]*ex)/den,u=(p[0]*dz-p[1]*dx)/den;
      if(s>0&&u>=-1e-6&&u<=1+1e-6){const el=Math.hypot(ex,ez)||1;best=s;cosb=Math.abs((dx*ez-dz*ex)/el);break;}
    }
    out[a]=best+d/Math.max(cosb,.35);
  }
  return out;
}
function perimeterPolar(r){let s=0;const n=r.length;for(let a=0;a<n;a++){const t0=a/n*TAU,t1=(a+1)/n*TAU,b=(a+1)%n;s+=Math.hypot(Math.sin(t1)*r[b]-Math.sin(t0)*r[a],Math.cos(t1)*r[b]-Math.cos(t0)*r[a]);}return s;}
// Bilinear lookup in a (height × angle) table with periodic angle.
function tableLookup(T,y,th){
  const fy=clamp((y-T.y0)/T.dy,0,T.ny-1.0001),i=fy|0,ty=fy-i,fa=((th/TAU)%1+1)%1*T.n,a=fa|0,ta=fa-a,a1=(a+1)%T.n,R=T.r,n=T.n;
  return lerp(lerp(R[i*n+a],R[i*n+a1],ta),lerp(R[(i+1)*n+a],R[(i+1)*n+a1],ta),ty);
}

// ---------- a tube along a polyline with a radius table (sleeves, trouser legs) ----------
function pathModel(raw,round=.06){
  // interior corners become short arcs so frames and stitch columns turn smoothly
  const points=[raw[0]];
  for(let i=1;i<raw.length-1;i++){
    const a=raw[i-1],b=raw[i],c=raw[i+1],r=Math.min(round,len(sub(b,a))*.4,len(sub(c,b))*.4),p0=add(b,mul(norm(sub(a,b)),r)),p1=add(b,mul(norm(sub(c,b)),r));
    for(let k=0;k<=4;k++){const t=k/4,q0=add(mul(p0,1-t),mul(b,t)),q1=add(mul(b,1-t),mul(p1,t));points.push(add(mul(q0,1-t),mul(q1,t)));}
  }
  points.push(raw.at(-1));
  const segs=[];let s0=0;
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],d=sub(b,a),l=len(d);if(l<1e-6)continue;segs.push({a,b,d:mul(d,1/l),l,s0});s0+=l;}
  // parallel-transported frames so the around-angle stays continuous across the elbow
  let e1=norm(sub([0,1,0],mul(segs[0].d,dot([0,1,0],segs[0].d))));
  for(const g of segs){e1=norm(sub(e1,mul(g.d,dot(e1,g.d))));g.e1=e1;g.e2=cross(g.d,e1);}
  return{segs,length:s0};
}
// closest point on the path: returns s (arc length, extends past both ends), axis point and frame
function onPath(P,x,y,z){
  let best=null;
  for(let i=0;i<P.segs.length;i++){
    const g=P.segs[i],px=x-g.a[0],py=y-g.a[1],pz=z-g.a[2];
    let t=px*g.d[0]+py*g.d[1]+pz*g.d[2];
    const first=i===0,last=i===P.segs.length-1;
    if(!first&&t<0)t=0;if(!last&&t>g.l)t=g.l;
    const cx=g.a[0]+g.d[0]*t,cy=g.a[1]+g.d[1]*t,cz=g.a[2]+g.d[2]*t,dx=x-cx,dy=y-cy,dz=z-cz,d2=dx*dx+dy*dy+dz*dz;
    if(!best||d2<best.d2)best={d2,s:g.s0+t,cx,cy,cz,g};
  }
  return best;
}

// ---------- measurements of the mannequin used to fit layers ----------
function armRadiusTable(bodyArm,P,ds=.01){
  const n=Math.ceil(P.length/ds)+1,r=new Float32Array(n);
  for(let i=0;i<n;i++){
    const s=Math.min(i*ds,P.length-1e-4);let g=P.segs.find(q=>s>=q.s0&&s<=q.s0+q.l)||P.segs.at(-1);
    const t=s-g.s0,c=add(g.a,mul(g.d,t));let sum=0,cnt=0;
    for(let k=0;k<10;k++){
      const a=k/10*TAU,dir=add(mul(g.e1,Math.cos(a)),mul(g.e2,Math.sin(a)));let lo=0,hi=.12;
      if(bodyArm(...c)>0){r[i]=0;continue;}
      for(let q=0;q<22;q++){const m=(lo+hi)/2,p=add(c,mul(dir,m));if(bodyArm(...p)<0)lo=m;else hi=m;}
      sum+=lo;cnt++;
    }
    r[i]=cnt?sum/cnt:0;
  }
  return s=>{const f=clamp(s/ds,0,n-1.001),i=f|0;return lerp(r[i],r[i+1],f-i);};
}

// ---------- trousers ----------
export function trousersModel(body){
  const lv=body.levels,J=body.joints,H=body.H,sh=H/1.65;
  const under=body.field(['torso','leg','foot']);
  const waist=lv.waist+.01,crotch=lv.crotch-.02;
  const legs=['R','L'].map(k=>{
    const j=J[k],s=k==='R'?-1:1;
    const top=[j.hip[0],crotch+.05,j.hip[2]],bottom=[j.ankle[0]+s*.008,0,j.ankle[2]+.004];
    return{s,top,bottom,axis:norm(sub(bottom,top)),L:len(sub(bottom,top))};
  });
  const hemY=.028*sh;
  function base(x,y,z,local){
    const u=local?local(x,y,z):under.eval(x,y,z);
    let d=u-.007;
    for(const g of legs){
      const px=x-g.top[0],py=y-g.top[1],pz=z-g.top[2];let t=(px*g.axis[0]+py*g.axis[1]+pz*g.axis[2])/g.L;
      const tc=clamp(t,0,1.05),cx=g.top[0]+g.axis[0]*g.L*tc,cy=g.top[1]+g.axis[1]*g.L*tc,cz=g.top[2]+g.axis[2]*g.L*tc;
      const ex=x-cx,ey=y-cy,ez=(z-cz)*1.08,r=Math.hypot(ex,ey,ez);
      // wide straight leg: thigh room at the top, 23 cm half-opening at the hem
      const R=lerp(.094,.087,smooth(0,.45,tc))*sh*(.92+.08*body.girthScale);
      const th=Math.atan2(ex*g.s,ez),fold=(.0022*Math.sin(th*5+tc*3.1)+.0014*Math.sin(th*9+1.3+tc*5))*smooth(.25,.95,tc)
        +.0045*smooth(.84,1,tc)*Math.sin(tc*g.L/.035*TAU+th*1.7)*(.6+.4*Math.cos(th));
      d=smin(d,r-R-fold,.035);
    }
    return d;
  }
  const f={eval:(x,y,z)=>base(x,y,z),local:(cx,cy,cz,r,sl)=>{const l=under.local(cx,cy,cz,r+.05,sl);return(x,y,z)=>base(x,y,z,l);}};
  const bb=body.bounds,px=Math.max(.3,.2*body.girthScale+.14),pz=Math.max(.22,.15*body.girthScale+.1);
  return{field:f,box:{min:[-px,-.01,Math.max(bb.min[2],-pz)],max:[px,waist+.02,Math.min(bb.max[2],pz+.04)]},clips:[(x,y,z)=>y-waist,(x,y,z)=>hemY+.012*clamp((z-.02)/.08,-1,1)-y],legs,waist,hemY};
}

// ---------- sneakers ----------
// White low-top sneakers: a foot-shaped cupsole with toe spring, an upper whose height rises from
// the toe box to the lace panel and heel counter, and a padded collar.
export function sneakersModel(body){
  const J=body.joints,sh=body.H/1.65,feet=body.field(['foot']);
  const parts=[];
  for(const k of['R','L']){
    const j=J[k],s=k==='R'?-1:1,dir=norm([s*.1,0,1]),side=norm(cross([0,1,0],dir));
    const L=.272*sh,W=.049*sh,heel=[j.ankle[0]-dir[0]*.052*sh,0,j.ankle[2]-dir[2]*.052*sh];
    parts.push({heel,dir,side,L,W,s});
  }
  // footprint: heel, ball and toe discs blended (2D, local u = across, v = along 0..1)
  function footprint(u,v,g,inset=0){
    const z=v*g.L,c=(cz,r)=>Math.hypot(u,z-cz*g.L)-r+inset;
    return smin(smin(c(.14,g.W*.78),c(.62,g.W*1.02),g.L*.22),c(.86,g.W*.82),g.L*.16);
  }
  const upperH=(v,g)=>(v<.5?lerp(.095,.082,smooth(.02,.3,v)):lerp(.082,.043,smooth(.45,.97,v)))*sh+(v>.3&&v<.72?.016*sh*Math.sin((v-.3)/.42*Math.PI):0);
  function one(x,y,z,g){
    const px=x-g.heel[0],pz=z-g.heel[2],u=px*g.side[0]+pz*g.side[2],v=(px*g.dir[0]+pz*g.dir[2])/g.L;
    const spring=.012*sh*smooth(.78,1.02,v),yb=y-spring,soleH=.028*sh;
    const fp=footprint(u,v,g);
    const sole=smax(fp,Math.abs(yb-soleH/2)-soleH/2,.006);
    const top=upperH(v,g),up=smax(footprint(u,v,g,.004),yb-top,.02);
    let d=smin(sole,smax(up,soleH*.5-yb,.004),.003);
    // collar opening around the ankle, padded rim
    const cv=(v-.2)/.13,cu=u/(g.W*.62),open=Math.hypot(cu,cv)-1;
    d=smax(d,-Math.max(open*.03,(top-.012*sh)-yb),.008);
    return d;
  }
  const f=(x,y,z,fl)=>{const g=x*parts[1].heel[0]>0?parts[1]:parts[0];return Math.min(one(x,y,z,g),(fl||feet.eval)(x,y,z)-.004);};
  const soleTop=.028*sh;
  return{field:{eval:(x,y,z)=>f(x,y,z),local:(cx,cy,cz,r,sl)=>{const fl=feet.local(cx,cy,cz,r+.02,sl);return(x,y,z)=>f(x,y,z,fl);}},box:{min:[-(Math.max(...parts.map(g=>Math.abs(g.heel[0])))+.1*sh),-.005,Math.min(...parts.map(g=>g.heel[2]))-.05],max:[Math.max(...parts.map(g=>Math.abs(g.heel[0])))+.1*sh,.16*sh,Math.max(...parts.map(g=>g.heel[2]+g.dir[2]*g.L))+.05]},soleTop,parts};
}

// ---------- the raglan sweater ----------
// plan: compiled design (design-engine), rings: sleeveRings(plan)
export function sweaterModel(body,plan,rings,under=null){
  const lv=body.levels,J=body.joints,sg=plan.gauge.stitchesPerCm*100,rg=plan.gauge.rowsPerCm*100;
  const Cg=plan.body.actualChestCm/100,lengthM=plan.body.actualLengthCm/100,s=plan.sleeve;
  const hps=lv.hps,hemY=hps-lengthM,bandH=.05,bandTop=hemY+bandH;
  // hands belong to the safety layer so a sleeve longer than the arm covers them instead of being pierced
  const torsoBody=body.field(['torso','neck']),armBody=body.field(['arm','hand']),upperBody=body.field(['torso','neck','arm','hand']);
  const underEval=under?(x,y,z)=>Math.min(torsoBody.eval(x,y,z),under.eval(x,y,z)):torsoBody.eval;
  const zc=-.012,dMin=.006,dYoke=.006;
  // polar sections of the layer below, from under the hem to above the neck
  const y0=hemY-.04,y1=hps+.07,dy=.01,n=120,ny=Math.round((y1-y0)/dy)+1;
  const rawHull=[];
  for(let i=0;i<ny;i++){
    const y=y0+i*dy,local=torsoBody.local(0,y,zc,.45,0),fl=under&&y<under.top?((x,yy,z)=>Math.min(local(x,yy,z),under.eval(x,yy,z))):local;
    const radii=new Float32Array(n);for(let a=0;a<n;a++)radii[a]=outerRadius(fl,y,zc,a/n*TAU);
    rawHull.push(convexPolar(radii,0));
  }
  const iy=y=>clamp(Math.round((y-y0)/dy),0,ny-1),bustI=iy(lv.bust),ua=lv.axilla;
  const T={y0,dy,ny,n,r:new Float32Array(ny*n)},band={y0,dy,ny,n,r:new Float32Array(ny*n)};
  // curtain: fabric falls straight from the widest section above (bust, shoulder blades)
  let run=new Float32Array(n);
  const rowR=[];
  for(let i=bustI;i>=0;i--){
    for(let a=0;a<n;a++)run[a]=Math.max(run[a],rawHull[i][a]);
    const hull=convexPolar(run,0),P=perimeterPolar(hull),d=Math.max(dMin,(Cg-P)/TAU);
    rowR[i]=convexPolar(hull,d);
  }
  for(let i=bustI+1;i<ny;i++){
    const y=y0+i*dy,w=smooth(lv.bust,ua+.03,y),yoke=convexPolar(rawHull[i],dYoke),r=new Float32Array(n);
    for(let a=0;a<n;a++)r[a]=Math.max(lerp(rowR[bustI][a],yoke[a],w),yoke[a]);
    rowR[i]=r;
  }
  {
    const lo=iy(lv.underbust-.03),hi=iy(ua+.04),src=rowR.map(r=>Float32Array.from(r));
    for(let i=lo;i<=hi;i++)for(let a=0;a<n;a++){
      let acc=0,w=0;for(let k=-4;k<=4;k++){const j=clamp(i+k,0,ny-1),q=Math.exp(-k*k/6);acc+=src[j][a]*q;w+=q;}
      rowR[i][a]=Math.max(acc/w,rawHull[i][a]+dMin);
    }
  }
  for(let i=0;i<ny;i++){
    const y=y0+i*dy,outer=convexPolar(rawHull[i],.0025+.0055),tuck=smooth(bandTop+.03,bandTop-.004,y);
    for(let a=0;a<n;a++){band.r[i*n+a]=outer[a];T.r[i*n+a]=lerp(rowR[i][a],Math.min(rowR[i][a],outer[a]-.004),tuck);}
  }
  const torsoPerimeter=y=>{const r=new Float32Array(n),i=iy(y);for(let a=0;a<n;a++)r[a]=T.r[i*n+a];return perimeterPolar(r);};
  // arc-length (around) tables for stitch columns
  const arcT=new Float32Array(ny*(n+1));
  for(let i=0;i<ny;i++){let acc=0;arcT[i*(n+1)]=0;for(let a=0;a<n;a++){const t0=a/n*TAU,t1=(a+1)/n*TAU,r0=T.r[i*n+a],r1=T.r[i*n+(a+1)%n];acc+=Math.hypot(Math.sin(t1)*r1-Math.sin(t0)*r0,Math.cos(t1)*r1-Math.cos(t0)*r0);arcT[i*(n+1)+a+1]=acc;}}
  const arcAt=(y,th)=>{const fy=clamp((y-y0)/dy,0,ny-1.0001),i=fy|0,ty=fy-i,t=((th/TAU)%1+1)%1*n,a=t|0,ta=t-a,A=j=>lerp(arcT[j*(n+1)+a],arcT[j*(n+1)+a+1],ta);return lerp(A(i),A(i+1),ty);};
  const girthAt=y=>{const fy=clamp((y-y0)/dy,0,ny-1.0001),i=fy|0;return lerp(arcT[i*(n+1)+n],arcT[(i+1)*(n+1)+n],fy-i);};
  // neck opening: a cylinder around the neck; the collar grows from where it meets the yoke
  const neckAxis=[0,0,-.026],R0=.068*Math.pow(body.girthScale,.4),neckRx=R0*1.07,neckRz=R0*.94;
  const rhoNeck=(x,z)=>Math.hypot(x/neckRx,(z-neckAxis[2])/neckRz)*R0;
  // sleeves: along the arm from the acromion level, radius from the knitted rounds
  const ringS=rings.map(r=>r.yCm/100),ringR=rings.map(r=>r.radiusM),capS=s.capRows/plan.gauge.rowsPerCm/100;
  const cuffS=(s.capRows+s.shapingRows)/plan.gauge.rowsPerCm/100,endS=ringS.at(-1);
  const patternR=q=>{if(q<=0)return ringR[0];if(q>=endS)return ringR.at(-1);let lo=0,hi=ringS.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(ringS[m]<=q)lo=m;else hi=m;}return lerp(ringR[lo],ringR[hi],(q-ringS[lo])/(ringS[hi]-ringS[lo]||1));};
  const sleeves=['R','L'].map(k=>{
    const j=J[k],sd=k==='R'?-1:1,top=add(j.shoulder,mul(j.upper,-.04));
    const P=pathModel([top,j.shoulder,j.elbow,j.wrist,add(j.wrist,mul(j.fore,.12))]);
    const armR=armRadiusTable(armBody.eval,P);
    const down=q=>{const g=P.segs.find(x=>q>=x.s0&&q<=x.s0+x.l)||P.segs.at(-1),v=sub([0,-1,0],mul(g.d,-g.d[1]));return len(v)>1e-6?norm(v):[0,0,0];};
    const cuffOuter=q=>Math.max(patternR(q)*.9,armR(clamp(q,cuffS,endS))+dMin+.0015)+.005;
    const tubeR=q=>{
      const a=armR(q)+.004,p=patternR(q),w=smooth(.05,capS,q),r=Math.max(a,lerp(a+.002,p,w));
      return lerp(r,Math.min(r,cuffOuter(q)-.0025),smooth(cuffS-.018,cuffS-.002,q));
    };
    const capEnd=add(j.wrist,mul(j.fore,.12)),capR=Math.max(...ringR)+.012+.035;
    return{k,sd,P,armR,tubeR,down,elbowS:len(sub(j.shoulder,top))+len(sub(j.elbow,j.shoulder)),cap:{a:top,b:capEnd,d:norm(sub(capEnd,top)),l:len(sub(capEnd,top)),r:capR}};
  });
  // underarm point where each sleeve leaves the body; raglan line runs from the neck to it
  for(const q of sleeves){
    const g=q.P.segs.find(x=>capS>=x.s0&&capS<=x.s0+x.l)||q.P.segs[1],c=add(g.a,mul(g.d,capS-g.s0));
    q.under=add(c,[-q.sd*q.tubeR(capS)*.85,0,0]);
    q.neck=[q.sd*neckRx*.98,0,neckAxis[2]];q.neck[1]=hps+.012;
    q.nrm=norm(cross(sub(q.under,q.neck),[0,0,q.sd]));if(q.nrm[0]*q.sd<0)q.nrm=mul(q.nrm,-1);
  }
  const k1=Math.max(6,Math.round(Cg/.115)),k2=Math.max(9,Math.round(Cg/.07)),ph=[.7,2.1,4.2];
  function torsoField(x,y,z){
    const th=Math.atan2(x,z-zc),r=Math.hypot(x,z-zc);let R=tableLookup(T,y,th);
    // hanging folds below the bust, soft blousing over the hem band
    const hang=smooth(lv.bust-.04,lv.waist,y)*(1-smooth(bandTop+.05,bandTop+.015,y));
    R+=hang*(.0034*Math.sin(k1*th+ph[0]+Math.sin(y*9)*.6)+.0019*Math.sin(k2*th+ph[1]+y*4));
    const bl=y-bandTop;if(bl>-.01&&bl<.07)R+=.0038*Math.exp(-Math.pow((bl-.022)/.016,2))+.0016*Math.sin(th*Math.round(Cg/.035)+ph[2])*smooth(.06,.01,bl);
    if(y<y0)return Math.max(r-R,y0-y);
    return r-R;
  }
  const hit={s:0};
  const S0=.07;
  function sleeveField(q,x,y,z){
    const o=onPath(q.P,x,y,z),sArc=o.s;hit.s=sArc;
    if(sArc<S0){const g=q.P.segs.find(v=>S0>=v.s0&&S0<=v.s0+v.l)||q.P.segs[1],c=add(g.a,mul(g.d,S0-g.s0));return Math.hypot(x-c[0],y-c[1],z-c[2])-q.tubeR(S0);}
    const R=q.tubeR(sArc),hangAmt=Math.max(0,R-q.armR(sArc)-.004)*.55,dv=q.down(sArc);
    const cx=o.cx+dv[0]*hangAmt,cy=o.cy+dv[1]*hangAmt,cz=o.cz+dv[2]*hangAmt,ex=x-cx,ey=y-cy,ez=z-cz;
    const phi=Math.atan2(ex*o.g.e2[0]+ey*o.g.e2[1]+ez*o.g.e2[2],ex*o.g.e1[0]+ey*o.g.e1[1]+ez*o.g.e1[2]);
    let fold=0;
    const toCuff=cuffS-sArc;
    // gathered fabric above the rib cuff: uneven, tilted ripples that fade up the arm
    if(toCuff>.004&&toCuff<.09){
      const env=Math.exp(-toCuff/.03)*smooth(.004,.014,toCuff)*(.65+.35*Math.sin(phi*2+q.sd*.9));
      fold+=env*(.0026*Math.sin((sArc+.007*Math.sin(phi*1.7+.4))/.024*TAU)+.0012*Math.sin((sArc-.004*Math.cos(phi*3.1))/.013*TAU+1.3));
    }
    const de=sArc-q.elbowS;if(Math.abs(de)<.07)fold+=.0022*Math.exp(-de*de/.0014)*Math.max(0,Math.cos(phi-Math.PI*.75))*Math.sin((sArc*.8+phi*.012)/.017*TAU);
    if(sArc>capS-.04&&sArc<q.elbowS)fold+=.002*smooth(capS-.04,capS+.03,sArc)*Math.max(0,-Math.cos(phi))*Math.sin(phi*7+1.7+sArc*9);
    return Math.hypot(ex,ey,ez)-R-fold;
  }
  // blend radius shrinks from the armpit down the arm so sleeves never web onto the body
  const blendK=(sArc)=>.005+.035*(1-smooth(capS-.02,capS+.09,sArc));
  const capsule=(c,x,y,z)=>{const px=x-c.a[0],py=y-c.a[1],pz=z-c.a[2],t=clamp(px*c.d[0]+py*c.d[1]+pz*c.d[2],0,c.l);return Math.hypot(px-c.d[0]*t,py-c.d[1]*t,pz-c.d[2]*t)-c.r;};
  function evalWith(x,y,z,upper,underL){
    let d=torsoField(x,y,z);
    for(const q of sleeves){if(capsule(q.cap,x,y,z)-d>.06)continue;const ds=sleeveField(q,x,y,z);if(ds-d<.06)d=smin(d,ds,blendK(hit.s));}
    // the dilated body keeps every layer outside the skin; blend softly only where the yoke rests
    // on the shoulders, elsewhere a near-hard union so pattern radii are not inflated
    const u=(upper?upper(x,y,z):upperBody.eval(x,y,z))-dMin;
    if(u<d+.03)d=smin(d,u,lerp(.0025,.012,smooth(ua-.09,ua-.02,y)));
    if(under&&y<bandTop+.04){const w=(underL?underL(x,y,z):under.eval(x,y,z))-.004;if(w<d)d=w;}
    return d;
  }
  const field={eval:(x,y,z)=>evalWith(x,y,z),local:(cx,cy,cz,r,sl)=>{const up=upperBody.local(cx,cy,cz,r+.05,sl+.05),ul=under&&under.local&&cy-r<bandTop+.04?under.local(cx,cy,cz,r+.02,sl+.05):null;return(x,y,z)=>evalWith(x,y,z,up,ul);}};
  const sleevePlane=q=>(x,y,z)=>(x-q.neck[0])*q.nrm[0]+(y-q.neck[1])*q.nrm[1];
  // region fields: >0 on the sleeve side
  const regionField=q=>{
    const plane=sleevePlane(q),uy=q.under[1];
    return(x,y,z)=>{
      const wPlane=smooth(uy-.035,uy+.015,y),a=plane(x,y,z);
      if(wPlane>=1)return a;
      const b=torsoField(x,y,z)-sleeveField(q,x,y,z);
      return wPlane<=0?b:lerp(b,a,wPlane);
    };
  };
  const cuts={
    hem:(x,y,z)=>hemY+.018-y,
    neck:(x,y,z)=>R0+.002-rhoNeck(x,z),
    cuff:q=>(x,y,z)=>{const o=onPath(q.P,x,y,z);return o.s-(cuffS+.012);}
  };
  // meshing box: torso table, the whole sleeve (it may run past the hands) and the body extents
  function sweaterBox(){
    let maxR=0;for(const v of T.r)maxR=Math.max(maxR,v);
    const bb=body.bounds,ends=sleeves.map(q=>{const s=endS+.03,g=q.P.segs.find(v=>s>=v.s0&&s<=v.s0+v.l)||q.P.segs.at(-1);return add(g.a,mul(g.d,s-g.s0));});
    const xm=Math.max(maxR+.04,bb.max[0],...ends.map(p=>Math.abs(p[0])+.1)),y0=Math.min(hemY-.03,...ends.map(p=>p[1]-.1));
    return{min:[-xm,y0,Math.min(zc-maxR-.04,bb.min[2],...ends.map(p=>p[2]-.1))],max:[xm,hps+.07,Math.max(zc+maxR+.04,...ends.map(p=>p[2]+.1))]};
  }
  return{dMin,field,torsoField,sleeveField,sleeves,regionField,cuts,T,band,arcAt,girthAt,torsoPerimeter,hemY,bandTop,bandH,hps,zc,neckAxis,R0,neckRx,neckRz,rhoNeck,capS,cuffS,endS,sg,rg,patternR,upperBody,
    box:sweaterBox()};
}

// Rib bands as shells: hem (around the hips), cuffs (around the forearms), collar (around the neck).
// Each is a rounded box in (radial offset, height) space, with shallow 2×2 rib ridges.
const shell=(dr,dh,t,h)=>{const qx=Math.abs(dr)-t/2,qy=Math.abs(dh)-h/2;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0);};
export function ribFields(sw,body){
  const hemMid=(sw.hemY+sw.bandTop)/2,t=.0055,hemRibs=Math.round(sw.girthAt(hemMid)*sw.sg/4);
  const hem=(x,y,z)=>{
    const th=Math.atan2(x,z-sw.zc),r=Math.hypot(x,z-sw.zc),R=tableLookup(sw.band,y,th)+.0008*Math.cos(th*hemRibs);
    return shell(r-(R-t/2),y-hemMid,t,sw.bandH)-.0009;
  };
  const cuff=q=>{
    const mid=(sw.cuffS+sw.endS)/2,len=sw.endS-sw.cuffS,ct=.005,ribs=Math.round(TAU*sw.patternR(mid)*sw.sg/4);
    return(x,y,z)=>{
      const o=onPath(q.P,x,y,z),ex=x-o.cx,ey=y-o.cy,ez=z-o.cz,phi=Math.atan2(ex*o.g.e2[0]+ey*o.g.e2[1]+ez*o.g.e2[2],ex*o.g.e1[0]+ey*o.g.e1[1]+ez*o.g.e1[2]);
      const inner=Math.max(sw.patternR(o.s)*.9,q.armR(clamp(o.s,sw.cuffS,sw.endS))+sw.dMin+.0015),Rm=inner+ct/2+.0009*Math.cos(phi*ribs);
      return shell(Math.hypot(ex,ey,ez)-Rm,o.s-mid,ct,len)-.0008;
    };
  };
  // collar: constant-width band standing on the yoke along the neck opening
  const n=96,raw=new Float32Array(n),base=new Float32Array(n),W=.021,ctk=.0072,collarRibs=Math.round(TAU*sw.R0*sw.sg/4);
  for(let a=0;a<n;a++){
    const th=a/n*TAU,x=Math.sin(th)*sw.neckRx,z=sw.neckAxis[2]+Math.cos(th)*sw.neckRz;
    let lo=sw.hps-.12,hi=sw.hps+.1;
    for(let i=0;i<30;i++){const m=(lo+hi)/2;if(sw.field.eval(x,m,z)<0)lo=m;else hi=m;}
    raw[a]=lo-.007;
  }
  // smooth the rim but never lift it above the yoke (a lifted rim leaves a gap at the steep front)
  for(let a=0;a<n;a++){let acc=0,w=0;for(let k=-4;k<=4;k++){const q=Math.exp(-k*k/8);acc+=raw[(a+k+n)%n]*q;w+=q;}base[a]=Math.min(acc/w,raw[a]);}
  const baseAt=th=>{const f=((th/TAU)%1+1)%1*n,a=f|0;return lerp(base[a],base[(a+1)%n],f-a);};
  const collar=(x,y,z)=>{
    const th=Math.atan2(x,z-sw.neckAxis[2]),rho=sw.rhoNeck(x,z),h=y-baseAt(th);
    const Rm=sw.R0+ctk/2-.004*smooth(0,W,h)+.0007*Math.cos(th*collarRibs);
    return shell(rho-Rm,h-W/2,ctk*.7,W*.85)-ctk*.15;
  };
  return{hem,cuff,collar,collarBase:baseAt,collarW:W};
}

// ---------- UV (stitch/row) coordinates and seam handling ----------
// param(x,y,z) → [angle, u, v]; triangles that straddle the angle wrap get their own vertices.
export function applyStitchUV(mesh,param,period){
  const P=mesh.positions,I=mesh.indices,nv=P.length/3,base=new Float32Array(nv*3);
  for(let i=0;i<nv;i++){const q=param(P[i*3],P[i*3+1],P[i*3+2]);base[i*3]=q[0];base[i*3+1]=q[1];base[i*3+2]=q[2];}
  const extraP=[],extraN=[],extraUV=[],dup=new Map(),N=mesh.normals,AO=mesh.ao,extraAO=[];
  const uvs=new Float32Array(nv*2);for(let i=0;i<nv;i++){uvs[i*2]=base[i*3+1];uvs[i*2+1]=base[i*3+2];}
  const idx=Uint32Array.from(I);
  for(let t=0;t<I.length;t+=3){
    const a=base[I[t]*3],b=base[I[t+1]*3],c=base[I[t+2]*3];
    if(Math.max(a,b,c)-Math.min(a,b,c)<Math.PI)continue;
    for(let e=0;e<3;e++){
      const v=I[t+e];if(base[v*3]>=0)continue;
      let nvI=dup.get(v);
      if(nvI===undefined){
        nvI=nv+extraP.length/3;dup.set(v,nvI);
        extraP.push(P[v*3],P[v*3+1],P[v*3+2]);if(N)extraN.push(N[v*3],N[v*3+1],N[v*3+2]);if(AO)extraAO.push(AO[v]);
        const pos=[P[v*3],P[v*3+1],P[v*3+2]];extraUV.push(base[v*3+1]+period(pos),base[v*3+2]);
      }
      idx[t+e]=nvI;
    }
  }
  const out={indices:idx,positions:new Float32Array(P.length+extraP.length),uvs:new Float32Array(uvs.length+extraUV.length)};
  out.positions.set(P);out.positions.set(extraP,P.length);out.uvs.set(uvs);out.uvs.set(extraUV,uvs.length);
  if(N){out.normals=new Float32Array(N.length+extraN.length);out.normals.set(N);out.normals.set(extraN,N.length);}
  if(AO){out.ao=new Float32Array(AO.length+extraAO.length);out.ao.set(AO);out.ao.set(extraAO,AO.length);}
  return out;
}

// Loop around the sleeve at arc length sArc (continuation safety line).
export function sleeveLoop(sw,q,sArc,count=72){
  const g=q.P.segs.find(x=>sArc>=x.s0&&sArc<=x.s0+x.l)||q.P.segs.at(-1),c=add(g.a,mul(g.d,sArc-g.s0)),pts=[];
  for(let i=0;i<count;i++){
    const a=i/count*TAU,dir=add(mul(g.e1,Math.cos(a)),mul(g.e2,Math.sin(a)));let lo=0,hi=.16;
    for(let k=0;k<24;k++){const m=(lo+hi)/2,p=add(c,mul(dir,m));if(sw.field.eval(...p)<0)lo=m;else hi=m;}
    pts.push(add(c,mul(dir,lo+.0015)));
  }
  return pts;
}

export {onPath};
