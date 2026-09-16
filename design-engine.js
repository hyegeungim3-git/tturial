import {solveContinuation} from './sleeve-continuation.js';
// One deterministic specification feeds knitting instructions and 360° geometry.
// Scope: a top-down, circular stockinette sleeve AFTER a separately designed yoke.
export const ENGINE_VERSION = 'hanol-knit-1.0';
export const TEMPLATE = Object.freeze({id:'raglan-stockinette-v1', yokeCm:22, sleeveCapCm:18, upperArmCm:36, cuffCm:20, cuffLengthCm:5, ribRepeat:4, minDecreaseGap:2});
const rounded = n => Math.round(n * 100) / 100;
const multiple = (n, m) => Math.max(m, Math.round(n / m) * m);
export function fingerprint(value) {
  // Stable content identifier, not a cryptographic authenticity claim.
  let h = 2166136261;
  for (const c of JSON.stringify(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
}
export function continuationContext(project){
  const {sleeve,sleeveRevision,...design}=project.design;
  return fingerprint({design,gauge:project.gauge,profile:project.profile});
}
export function compileDesign(project) {
  const d = project.design, g = project.gauge, p = project.profile;
  const t = {...TEMPLATE, ...d.knit};
  const input = {template:t, design:{length:d.length,sleeve:d.sleeve,ease:d.ease,color:d.color,trim:d.trim}, gauge:{stitches:g.stitches,rows:g.rows}, body:{chest:p.chest,height:p.height,shoulder:p.shoulder,arm:p.arm}};
  if(d.sleeveRevision)input.continuation=d.sleeveRevision;
  const errors=[];
  for (const [label,n,min,max] of [['코 게이지',g.stitches,5,60],['단 게이지',g.rows,5,80],['소매 길이',d.sleeve,20,70],['총장',d.length,35,80],['가슴둘레',p.chest,50,160],['여유분',d.ease,0,40],['소매 시작 둘레',t.upperArmCm,24,60],['소맷단 둘레',t.cuffCm,12,36],['고무단 길이',t.cuffLengthCm,2,10]]) {
    if(!Number.isFinite(n)||n<min||n>max) errors.push(`${label}는 ${min}–${max} 범위의 숫자여야 해요.`);
  }
  if(errors.length) return {id:`HN-${fingerprint(input)}`,engine:ENGINE_VERSION,valid:false,errors,input};
  const sg=g.stitches/10, rg=g.rows/10;
  const totalRows=Math.round(d.sleeve*rg), capRows=Math.round(t.sleeveCapCm*rg);
  const cuffRows=Math.max(2,Math.round(t.cuffLengthCm*rg/2)*2);
  const underarmRows=totalRows-capRows, shapingRows=underarmRows-cuffRows;
  const startStitches=multiple(t.upperArmCm*sg,4), cuffStitches=multiple(t.cuffCm*sg,t.ribRepeat);
  const decreaseCount=(startStitches-cuffStitches)/2;
  if(decreaseCount<0) errors.push('소맷단 코 수가 소매 시작 코 수보다 많아요. 현재 템플릿은 줄임 소매만 지원해요.');
  if(shapingRows<2) errors.push('고무단 앞의 메리야스 구간이 부족해요. 소매 길이를 늘려주세요.');
  if(decreaseCount>0&&shapingRows<decreaseCount*t.minDecreaseGap) errors.push(`줄임 ${decreaseCount}회를 최소 ${t.minDecreaseGap}단 간격으로 배치하려면 메리야스 구간이 ${decreaseCount*t.minDecreaseGap}단 이상 필요해요. 소매 길이를 늘리거나 시작·끝 둘레 차이를 줄여주세요.`);
  const decreaseRounds = errors.length ? [] : Array.from({length:decreaseCount},(_,i)=>Math.floor((i+1)*shapingRows/decreaseCount));
  const decreasing=new Set(decreaseRounds), rounds=[];
  let current=startStitches;
  if(!errors.length) for(let n=1;n<=underarmRows;n++) {
    const before=current, rib=n>shapingRows, dec=decreasing.has(n);
    if(dec) current-=2;
    rounds.push({round:n,section:rib?'cuff':'sleeve',before,after:current,operation:rib?'rib2x2':dec?'paired-decrease':'knit',repeat:rib?current/4:null,
      instruction:rib?`[겉뜨기 2코, 안뜨기 2코] ${current/4}회` : dec?`겉뜨기 1코, SSK(왼쪽 기울기 2코 모아뜨기), 겉뜨기 ${before-6}코, k2tog(오른쪽 기울기 2코 모아뜨기), 겉뜨기 1코`:`겉뜨기 ${current}코`});
  }
  const bodyStitches=multiple((p.chest+d.ease)*sg,4), bodyRows=Math.max(1,Math.round((d.length-t.yokeCm)*rg));
  const spec={id:`HN-${fingerprint(input)}`,engine:ENGINE_VERSION,valid:!errors.length,errors,input,gauge:{stitchesPerCm:sg,rowsPerCm:rg},
    body:{stitches:bodyStitches,rows:bodyRows,actualChestCm:rounded(bodyStitches/sg),actualLengthCm:rounded(t.yokeCm+bodyRows/rg)},
    sleeve:{requestedCm:d.sleeve,actualCm:rounded(totalRows/rg),roundingCm:rounded(totalRows/rg-d.sleeve),totalRows,capRows,underarmRows,shapingRows,cuffRows,startStitches,cuffStitches,decreaseCount,decreaseRounds,actualUpperArmCm:rounded(startStitches/sg),actualCuffCm:rounded(cuffStitches/sg),actualCuffLengthCm:rounded(cuffRows/rg),rounds},
    regions:[{id:'body',label:'몸판',color:d.color},{id:'sleeve-left',label:'왼 소매',color:d.color},{id:'sleeve-right',label:'오른 소매',color:d.color},{id:'cuff',label:'고무단',color:d.trim},{id:'collar',label:'목선',color:d.trim}],
    scope:{validated:'integer stitch/row arithmetic and template constraints only',notValidated:['full yoke and armhole joins','physical fit and fabric stretch','AI image fidelity'],sleeveMeasurement:'shoulder along sleeve to cuff; fixed cap/yoke allocation, underarm rounds calculated',cuffGauge:'stockinette gauge reused; rib gauge must be measured before production'}};
  if(d.sleeveRevision){
    const revised=solveContinuation({revision:d.sleeveRevision,context:continuationContext(project),requestedCm:d.sleeve,baseline:spec.sleeve,gauge:spec.gauge});
    spec.valid=revised.valid;spec.errors=revised.errors;
    if(revised.valid)spec.sleeve=revised.sleeve;
  }
  spec.checks=verifyDesign(spec);
  if(spec.sleeve.continuation)spec.checks.push({label:'완료 구간의 동작·코 수 보존',ok:spec.sleeve.continuation.lockedPrefixPreserved});
  spec.valid=spec.valid&&spec.checks.every(c=>c.ok);
  return spec;
}
export function verifyDesign(spec) {
  const s=spec.sleeve;if(!s)return[];
  const rows=s.rounds;
  return [
    {label:'단별 코 수 연결',ok:rows.length===s.underarmRows&&rows.every((r,i)=>r.before===(i?rows[i-1].after:s.startStitches)&&r.after===r.before-(r.operation==='paired-decrease'?2:0))},
    {label:'줄임 후 소맷단 코 수',ok:rows.length>0&&rows.at(-1).after===s.cuffStitches&&s.startStitches-s.decreaseCount*2===s.cuffStitches},
    {label:'2×2 고무뜨기 반복',ok:s.cuffStitches%4===0&&s.cuffRows%2===0},
    {label:'고무단·배색 경계',ok:rows.filter(r=>r.section==='cuff').length===s.cuffRows&&s.capRows+s.shapingRows+s.cuffRows===s.totalRows},
    {label:'줄임 간격 확보',ok:s.decreaseRounds.every((n,i)=>n-(i?s.decreaseRounds[i-1]:0)>=TEMPLATE.minDecreaseGap)},
    {label:'목표 길이 반올림 오차',ok:Math.abs(s.actualCm-s.requestedCm)<=.5/(s.rowsPerCm||spec.gauge.rowsPerCm)+.011}
  ];
}
export function compareDesign(before,after) {
  if(!before.sleeve||!after.sleeve)return null;
  const a=before.sleeve,b=after.sleeve;
  return {rows:b.totalRows-a.totalRows,underarmRows:b.underarmRows-a.underarmRows,cuffPreserved:a.cuffRows===b.cuffRows&&a.cuffStitches===b.cuffStitches,topologyPreserved:a.startStitches===b.startStitches&&a.cuffStitches===b.cuffStitches&&a.decreaseCount===b.decreaseCount,decreasePositionsChanged:JSON.stringify(a.decreaseRounds)!==JSON.stringify(b.decreaseRounds)};
}
// Per-course radius comes from the SAME stitch counts as the written instructions.
// This is a rest geometry, not a cloth/fit simulation.
export function sleeveRings(spec) {
  if(!spec.valid)return[];
  const s=spec.sleeve,sg=spec.gauge.stitchesPerCm,rg=spec.gauge.rowsPerCm;
  const rings=[{row:0,yCm:0,stitches:s.startStitches,section:'cap'}];
  for(let n=1;n<=s.capRows;n++)rings.push({row:n,yCm:n/rg,stitches:s.startStitches,section:'cap'});
  for(const r of s.rounds)rings.push({row:s.capRows+r.round,yCm:s.capRows/rg+r.round/(s.rowsPerCm||rg),stitches:r.after,section:r.section});
  return rings.map(r=>({...r,radiusM:r.stitches/sg/100/(2*Math.PI)}));
}
