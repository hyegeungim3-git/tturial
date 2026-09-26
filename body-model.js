// Neutral mannequin sculpted from blended distance primitives, sized by four measurements.
// Height, chest girth, shoulder width and arm length are honoured; the rest are common proportions.
import {sdfModel,sphere,ellipsoid,cone,plane,frame,add,sub,mul,norm,rotate,mix3,cross,dot} from './sdf-mesh.js';

const at=(o,f,v)=>add(o,[v[0]*f[0][0]+v[1]*f[1][0]+v[2]*f[2][0],v[0]*f[0][1]+v[1]*f[1][1]+v[2]*f[2][1],v[0]*f[0][2]+v[1]*f[1][2]+v[2]*f[2][2]]);

export function bodySpec(profile,{chestFit=true}={}){
  const H=profile.height/100,C=profile.chest/100,S=profile.shoulder/100,A=profile.arm/100;
  const sh=H/1.65,hs=.55+.45*sh,ss=S/.38,limb=Math.pow(C/.88,.75);
  const lv={top:H,eye:.936*H,chin:.866*H,hps:.833*H,neck:.818*H,c7:.846*H,acromion:.815*H,axilla:.748*H,bust:.72*H,underbust:.68*H,waist:.615*H,hip:.52*H,crotch:.462*H,knee:.282*H,ankle:.045*H};
  let girth=C/.88;
  const build=()=>{
    const P=[],t=(tag,p)=>{p.tag=tag;P.push(p);return p;};
    const Y=f=>f*H,g=girth,X=v=>v*g,joints={R:{},L:{}};
    const ax=S/2*.96,acr=lv.acromion;
    // torso
    t('torso',ellipsoid([0,Y(.527),X(-.012)],[X(.158),.105*sh,X(.108)]));
    for(const s of[-1,1])t('torso',ellipsoid([s*X(.068),Y(.505),X(-.052)],[X(.082),.098*sh,X(.074)],null,{k:.05}));
    t('torso',ellipsoid([0,Y(.565),X(.018)],[X(.13),.085*sh,X(.094)],null,{k:.06}));
    t('torso',ellipsoid([0,lv.waist,X(-.002)],[X(.128),.105*sh,X(.088)],null,{k:.09}));
    t('torso',ellipsoid([0,Y(.713),X(-.014)],[X(.14),.15*sh,X(.104)],null,{k:.08}));
    t('torso',ellipsoid([0,Y(.765),X(-.012)],[X(.128)*.55+.058*ss,.085*sh,X(.088)],null,{k:.05}));
    for(const s of[-1,1]){
      t('torso',ellipsoid([s*X(.05),lv.bust,X(.066)],[X(.06),.056*sh,X(.054)],frame([s*.12,1,.25]),{k:.05}));
      t('torso',ellipsoid([s*X(.066),Y(.752),X(-.078)],[X(.074),.085*sh,X(.043)],null,{k:.04}));
    }
    // shoulder girdle: shoulder width drives the acromion positions
    t('torso',cone([-ax*.8,acr-.046*sh,-.022],[ax*.8,acr-.046*sh,-.022],.043*limb,.043*limb,{k:.05}));
    for(const s of[-1,1]){
      const du=norm([s*Math.sin(.24),-Math.cos(.24),.05]);
      t('torso',cone([s*.036*hs,lv.c7-.01,-.036*hs],[s*ax*.84,acr-.016*sh,-.02],.027*limb,.027*limb,{k:.04}));
      t('torso',ellipsoid([s*(ax-.032*limb),acr-.046*sh,-.004],[.043*limb,.072*sh,.048*limb],frame(du,[0,0,1]),{k:.035}));
    }
    // legs
    for(const s of[-1,1]){
      const Hj=[s*.079*g,lv.crotch+.078*sh,-.006],K=[s*.078*g,lv.knee,.012],Ak=[s*.094*Math.max(g,.9),lv.ankle+.03*sh,-.014];
      t('leg',cone(Hj,K,.082*limb,.054*limb,{k:.065}));
      const fl=frame(sub(K,Hj),[0,0,1]);
      t('leg',ellipsoid(add(mix3(Hj,K,.42),[0,0,.022*limb]),[.066*limb,.17*sh,.063*limb],fl,{k:.04}));
      t('leg',ellipsoid(add(mix3(Hj,K,.3),[-s*.022*limb,0,-.004]),[.054*limb,.12*sh,.058*limb],fl,{k:.04}));
      t('leg',ellipsoid(add(K,[0,.008,.012]),[.037*limb,.044*sh,.038*limb],null,{k:.045}));
      t('leg',cone(K,Ak,.05*limb,.031*limb,{k:.03}));
      t('leg',ellipsoid(add(mix3(K,Ak,.27),[s*.004,0,-.022*limb]),[.047*limb,.1*sh,.045*limb],frame(sub(Ak,K),[0,0,1]),{k:.035}));
      t('foot',sphere(Ak,.031*limb,{k:.02}));
      const heel=[Ak[0],.036*sh,Ak[2]-.03*sh],ball=[Ak[0]+s*.012,.024*sh,Ak[2]+.13*sh];
      t('foot',cone(heel,ball,.033*sh,.027*sh,{k:.025}));
      t('foot',ellipsoid([Ak[0]+s*.006,.045*sh,Ak[2]+.055*sh],[.031*sh,.03*sh,.06*sh],frame([0,.35,1]),{k:.03}));
      t('foot',ellipsoid([Ak[0]+s*.016,.018*sh,Ak[2]+.165*sh],[.034*sh,.016*sh,.034*sh],null,{k:.018}));
      Object.assign(joints[s<0?'R':'L'],{hip:Hj,knee:K,ankle:Ak,heel,ball});
    }
    t('foot',plane([0,1,0],0,{sub:true,k:.004}));
    // arms: relaxed A-pose, slight elbow bend, palms toward the thighs, thumbs forward
    for(const s of[-1,1]){
      const J=[s*(ax-.036*limb),acr-.036*sh,-.006];
      const du=norm([s*Math.sin(.24),-Math.cos(.24),.05]);
      const upper=A*.565-.018,fore=A*.435;
      const E=add(J,mul(du,upper));
      let df=rotate(du,[s,0,0],.2);df=norm(add(df,[s*.02,0,0]));
      const W=add(E,mul(df,fore)),fu=frame(du,[0,0,1]),ff=frame(df,[0,0,1]);
      t('arm',cone(J,E,.045*limb,.034*limb,{k:.028}));
      t('arm',ellipsoid(at(J,fu,[0,.14,.012*limb]),[.036*limb,.082,.037*limb],fu,{k:.03}));
      t('arm',ellipsoid(at(J,fu,[0,.12,-.014*limb]),[.035*limb,.09,.034*limb],fu,{k:.03}));
      t('arm',sphere(E,.033*limb,{k:.02}));
      t('arm',cone(E,W,.034*limb,.0232*limb,{k:.02}));
      t('arm',ellipsoid(at(E,ff,[s*.004,.062,.003]),[.0355*limb,.072,.031*limb],ff,{k:.028}));
      const hsc=sh*(.9+.1*limb),n=norm(sub([-s,0,0],mul(df,dot([-s,0,0],df)))),w=norm(cross(n,df)),side=w[2]<0?mul(w,-1):w;
      const H3=v=>add(W,add(mul(df,v[0]*hsc),add(mul(side,v[1]*hsc),mul(n,v[2]*hsc))));
      t('hand',ellipsoid(H3([.004,0,.002]),[.018*hsc*limb,.02*hsc,.026*hsc*limb],frame(df,side),{k:.016}));
      t('hand',ellipsoid(H3([.048,.002,-.002]),[.039*hsc,.05*hsc,.0132*hsc],[side,df,n],{k:.016}));
      t('hand',ellipsoid(H3([.03,.022,.006]),[.021*hsc,.03*hsc,.013*hsc],[side,df,n],{k:.014}));
      for(const [o,l,r] of[[.0235,.071,.0086],[.0082,.078,.0089],[-.0072,.074,.0084],[-.0215,.06,.0075]]){
        let p=H3([.088-Math.abs(o)*.18,o,-.003]),dir=norm(add(df,mul(side,o*.9))),rad=r*hsc;
        [[.44,.14],[.31,.24],[.25,.2]].forEach(([part,curl],si)=>{
          dir=norm(rotate(dir,cross(dir,n),curl));
          const q=add(p,mul(dir,l*part*hsc)),r2=rad*(si===2?.8:.92);
          t('hand',cone(p,q,rad,r2,{k:si?.004:.008}));p=q;rad=r2;
        });
      }
      let tp=H3([.024,.026,.009]),td=norm(add(add(mul(df,.84),mul(side,.3)),mul(n,.44))),tr=.0112*hsc;
      for(const [l,rs,c] of[[.031,.9,.12],[.027,.88,.1],[.022,.82,.08]]){td=norm(rotate(td,cross(td,n),c));const q=add(tp,mul(td,l*hsc));t('hand',cone(tp,q,tr,tr*rs,{k:.004}));tp=q;tr*=rs;}
      Object.assign(joints[s<0?'R':'L'],{shoulder:J,elbow:E,wrist:W,upper:du,fore:df,acromion:[s*ax,acr,-.01],palm:n,thumbSide:side,handTip:add(W,mul(df,.19*hsc))});
    }
    // neck and head (heads vary less with height). Head frame: origin at eye level above the ear canal.
    const O=[0,lv.eye,-.004],h=v=>add(O,mul(v,hs)),r=v=>v*hs;
    t('neck',cone([0,lv.neck+.004,-.028],h([0,-.072,-.022]),.056*Math.pow(g,.5),.047*Math.pow(g,.35),{k:.03}));
    // abstract display-mannequin face: planes and proportions only, no fine features
    t('head',ellipsoid(h([0,.02,-.012]),[r(.07),r(.091),r(.092)],null,{k:.028}));
    t('head',ellipsoid(h([0,-.02,.03]),[r(.057),r(.062),r(.058)],null,{k:.034}));
    t('head',ellipsoid(h([0,-.07,.032]),[r(.043),r(.04),r(.046)],null,{k:.03}));
    t('head',ellipsoid(h([0,-.097,.061]),[r(.016),r(.013),r(.014)],null,{k:.02}));
    for(const s of[-1,1])t('head',ellipsoid(h([s*.043,-.016,.049]),[r(.02),r(.015),r(.02)],null,{k:.024}));
    t('head',ellipsoid(h([0,.018,.066]),[r(.05),r(.013),r(.02)],null,{k:.02}));
    t('head',cone(h([0,.0,.088]),h([0,-.035,.098]),r(.0055),r(.0082),{k:.012}));
    for(const s of[-1,1]){
      t('head',ellipsoid(h([s*.029,.0,.093]),[r(.017),r(.009),r(.01)],null,{sub:true,k:.014}));
      t('head',ellipsoid(h([s*.069,-.012,-.014]),[r(.007),r(.025),r(.015)],frame([0,1,-.27]),{k:.008}));
    }
    return{P,joints};
  };
  let built=build();
  // Match the requested chest girth (tape over the bust, arms excluded).
  if(chestFit)for(let it=0;it<3;it++){
    const measured=girthAt(sdfModel(built.P.filter(p=>p.tag==='torso')).eval,lv.bust,0),ratio=C/measured;
    if(Math.abs(ratio-1)<.002)break;
    girth*=1+(ratio-1)*1.05;built=build();
  }
  const pick=tags=>sdfModel(built.P.filter(p=>tags.includes(p.tag)));
  // Axis-aligned box that holds the posed body (hands, toes, bust, seat) with a margin.
  const J=built.joints,g=girth,xs=[],zs=[];
  for(const k of['L','R'])for(const p of[J[k].handTip,J[k].wrist,J[k].elbow,J[k].ankle]){xs.push(Math.abs(p[0]));zs.push(p[2]);}
  const bounds={min:[-(Math.max(...xs,.2*g,S/2+.06)+.05),-.012,Math.min(-(.17*g+.03),Math.min(...zs)-.06)],max:[Math.max(...xs,.2*g,S/2+.06)+.05,H+.03,Math.max(.2*g+.03,Math.max(...zs)+.06,J.L.ankle[2]+.2*sh+.04)]};
  return{H,C,S,A,levels:lv,joints:built.joints,prims:built.P,girthScale:girth,bounds,field:(tags=null)=>tags?pick(tags):sdfModel(built.P)};
}

// Horizontal tape measure: convex hull perimeter of the section at height y.
export function girthAt(f,y,zc=0,rays=180){
  const pts=[],step=.004;
  for(let i=0;i<rays;i++){
    const a=i/rays*Math.PI*2,dx=Math.sin(a),dz=Math.cos(a);
    let last=-1,prev=f(0,y,zc)<0;
    for(let r=step;r<.7;r+=step){const inside=f(dx*r,y,zc+dz*r)<0;if(prev&&!inside)last=r;prev=inside;}
    if(last<0)continue;
    let lo=last-step,hi=last;for(let s=0;s<22;s++){const m=(lo+hi)/2;if(f(dx*m,y,zc+dz*m)<0)lo=m;else hi=m;}
    pts.push([dx*lo,dz*lo]);
  }
  return pts.length>2?hullPerimeter(pts):0;
}
function hullPerimeter(pts){
  const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),c=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const q of p){while(lo.length>1&&c(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}
  for(const q of p.reverse()){while(up.length>1&&c(up.at(-2),up.at(-1),q)<=0)up.pop();up.push(q);}
  const h=lo.slice(0,-1).concat(up.slice(0,-1));let s=0;
  for(let i=0;i<h.length;i++){const a=h[i],b=h[(i+1)%h.length];s+=Math.hypot(a[0]-b[0],a[1]-b[1]);}
  return s;
}
