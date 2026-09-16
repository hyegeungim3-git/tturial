import {compileDesign,continuationContext,fingerprint} from './design-engine.js';
const name=side=>side==='left'?'왼쪽':'오른쪽';
const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
export function prepareMeasurement(project,input){
  const before=compileDesign(project),errors=[];
  if(!before.valid)return{valid:false,errors:['적용된 도안 조건을 먼저 확인해 주세요.']};
  const s=before.sleeve,record=project.knitting?.[before.id]||{},side=input.side,rows=Number(input.rows),cm=Number(input.cm),targetCm=Number(input.targetCm);
  if(!['left','right'].includes(side))errors.push('측정한 소매를 선택해 주세요.');
  if(!Number.isInteger(rows)||rows<10||rows>s.shapingRows)errors.push(`완료 단은 메리야스 구간의 10–${s.shapingRows}단 사이로 입력해 주세요.`);
  if(rows<(record[side]||0))errors.push('기록된 진도보다 작은 단 수예요. 풀어낸 구간이 있다면 이어뜨기에서 먼저 진도를 되돌려 주세요.');
  if(!Number.isFinite(cm)||cm<=0||cm>70)errors.push('겨드랑이 아래 실측 길이를 0보다 크고 70cm 이하로 입력해 주세요.');
  if(!Number.isFinite(targetCm)||targetCm<20||targetCm>70)errors.push('어깨 기준 목표 소매 길이는 20–70cm로 입력해 주세요.');
  if(!['working','washed'].includes(input.state))errors.push('측정 상태를 선택해 주세요.');
  const progress={...record,left:record.left||0,right:record.right||0};progress[side]=rows;
  const lockedRows=Math.max(progress.left,progress.right);
  if(lockedRows>s.shapingRows)errors.push('이미 고무단을 시작한 소매가 있어요. 고무단 전 구간에서만 남은 메리야스 도안을 조정할 수 있어요.');
  if(errors.length)return{valid:false,errors};
  const revision={schema:1,context:continuationContext(project),sourcePlanId:before.id,targetCm,measurement:{side,rows,cm,state:input.state},lockedRounds:s.rounds.slice(0,lockedRows).map(r=>({...r}))};
  const changes={sleeve:targetCm,sleeveRevision:revision},candidate={...project,design:{...project.design,...changes}},after=compileDesign(candidate);
  if(!after.valid)return{valid:false,errors:after.errors.length?after.errors:['완료 구간을 유지하는 줄임 규칙을 만들 수 없어요. 목표 길이를 다시 확인해 주세요.']};
  return{valid:true,errors:[],before,after,candidate,changes,side,progress,sourceProgressFingerprint:fingerprint(record),measurement:revision.measurement,
    comparison:{lockedRows,expectedMeasuredCm:rows/(s.rowsPerCm||before.gauge.rowsPerCm),measuredCm:cm,rowsDelta:after.sleeve.underarmRows-s.underarmRows,remainingRows:after.sleeve.underarmRows-rows}};
}
export function continuationIsFresh(project,pending){
  const c=pending.continuation;
  if(!c)return true;
  const source=compileDesign(project);
  return source.id===c.sourcePlanId&&fingerprint(project.knitting?.[source.id]||{})===c.sourceProgressFingerprint;
}
export function transferMeasurementProgress(project,pending,newPlan){
  const c=pending.continuation;if(!c)return;
  project.knitting||={};
  const progress={...c.progress,updatedAt:new Date().toISOString()};
  // A confirmed manual row count is also true for the source pattern.
  project.knitting[c.sourcePlanId]={...progress};
  project.knitting[newPlan.id]={...progress,measurement:{...c.measurement}};
  if(project.status==='시작 전'&&(progress.left>0||progress.right>0))project.status='진행 중';
}
export function measurementForm(project,side){
  const plan=compileDesign(project),s=plan.sleeve,record=project.knitting?.[plan.id]||{},done=record[side]||0;
  if(!plan.valid)return'<div class="knit-error">적용된 도안을 먼저 확인해 주세요.</div>';
  return `<div class="measure-intro"><span class="knit-eyebrow">KEEP YOUR STITCHES</span><h3>떠놓은 부분은 그대로,<br>남은 길이만 맞춰요.</h3><p>겨드랑이에서 시작해 완료한 단까지의 길이를 재주세요. 줄자를 당기거나 편물을 늘리지 않은 상태로 입력해요.</p></div><form id="measurement-form"><input type="hidden" name="side" value="${side}"><div class="measure-current">${name(side)} 소매 · 기록 ${done}단 / 메리야스 ${s.shapingRows}단<span>${plan.id}</span></div><div class="fields"><label class="field">실제로 완료한 단<input name="rows" type="number" min="10" max="${s.shapingRows}" step="1" value="${done>=10?done:''}" placeholder="예: 20" required></label><label class="field">겨드랑이 아래 실측 길이 (cm)<input name="cm" type="number" min="0.1" max="70" step="0.1" placeholder="예: 7" required></label><label class="field">어깨부터 목표 소매 길이 (cm)<input name="targetCm" type="number" min="20" max="70" step="0.1" value="${project.design.sleeve}" required></label><label class="field">측정 상태<select name="state"><option value="working">작업 중 · 세탁 전</option><option value="washed">세탁·건조 후</option></select></label></div><p class="measure-note">10단 이상 뜬 메리야스 구간에서 사용해요. 입력한 완료 단은 수정안을 적용할 때 진도에 반영해요. 목표 길이는 선택한 측정 상태 기준이며 세탁 전후 수치를 섞어 계산하지 않아요.</p><details class="measure-assumptions"><summary>계산에 사용하는 조건</summary><p>양쪽 소매 중 더 많이 뜬 단까지 기존 동작과 코 수를 고정해요. 한 소매에서 측정한 단 게이지가 다른 소매와 앞으로 뜰 구간에도 같다고 가정해요. 코 게이지·소맷단 코 수·고무단 단 수는 유지해요. 고무단의 실제 길이와 세탁 후 핏은 별도로 확인해 주세요.</p></details><div id="measurement-errors" role="alert"></div><div class="modal-actions"><button class="button primary" type="submit">남은 도안 계산하기</button></div></form>`;
}
export function measurementReview(result){
  const a=result.before.sleeve,b=result.after.sleeve,c=result.comparison,m=result.measurement,locked=c.lockedRows;
  const maximum=Math.max(a.underarmRows,b.underarmRows);
  const bar=(s)=>`<div class="measure-bar" style="width:${s.underarmRows/maximum*100}%"><i class="locked" style="flex:${locked}">${locked}단</i>${s.shapingRows>locked?`<i class="remaining" style="flex:${s.shapingRows-locked}">${s.shapingRows-locked}단</i>`:''}<i class="rib" style="flex:${s.cuffRows}">${s.cuffRows}단</i></div>`;
  return `<div class="measure-success">✓ 완료 ${locked}단의 뜨는 동작과 코 수가 모두 같아요</div><div class="measure-facts"><div><small>입력한 실측</small><strong>${m.rows}단 · ${fmt(m.cm)}cm</strong><span>${name(m.side)} 소매 · ${m.state==='working'?'세탁 전':'세탁·건조 후'}</span></div><div><small>남은 구간에 적용할 게이지</small><strong>${fmt(b.rowsPerCm*10)}단 / 10cm</strong><span>기존 길이 예상 ${fmt(c.expectedMeasuredCm)}cm</span></div></div><div class="measure-comparison"><div class="row between"><strong>현재 도안</strong><span>겨드랑이 아래 ${a.underarmRows}단</span></div>${bar(a)}<div class="row between"><strong>실측 수정안</strong><span>${b.underarmRows}단 · ${c.rowsDelta>0?'+':''}${c.rowsDelta}단</span></div>${bar(b)}<div class="measure-legend"><span>● 완료 구간 보존</span><span>● 남은 메리야스</span><span>● 고무단</span></div></div><div class="measure-next"><strong>${name(m.side)} 소매는 ${m.rows+1}단부터 이어 떠요</strong><p>남은 ${c.remainingRows}단 · 앞으로 줄임 ${b.decreaseRounds.filter(n=>n>m.rows).length}회<br>공통 보존 구간 뒤 첫 줄임 ${b.continuation.futureDecreases[0]?b.continuation.futureDecreases[0]+'단':'없음'} · 소맷단 ${b.cuffStitches}코 유지<br>목표 ${b.requestedCm}cm → 계산 ${fmt(b.actualCm)}cm</p></div><p class="measure-note">${locked>m.rows?'다른 소매의 진도가 더 앞서 있어 '+locked+'단까지 공통으로 보존했어요. ':''}고무단 ${b.cuffRows}단은 그대로이며 같은 단 게이지로 계산하면 ${fmt(b.actualCuffLengthCm)}cm입니다. 실제 길이는 확인이 필요해요. 적용 전에는 도안과 진도가 바뀌지 않습니다.</p>`;
}
export function continuationDetails(plan){
  const s=plan.sleeve,c=s.continuation;if(!c)return'';
  const m=c.measurement;
  return `<div class="measure-success">완료 ${c.lockedRows}단 보존 · ${name(m.side)} 소매 ${m.rows}단 / ${fmt(m.cm)}cm 실측 반영</div><div class="knit-formulas"><p><b>01 실측 단 게이지</b>${m.rows}단 ÷ ${fmt(m.cm)}cm = ${fmt(s.rowsPerCm)}단/cm (${m.state==='working'?'세탁 전':'세탁·건조 후'})</p><p><b>02 남은 길이 계산</b>요크 측 ${fmt(s.capLengthCm)}cm 고정 + 겨드랑이 아래 ${s.underarmRows}단 ÷ ${fmt(s.rowsPerCm)}단/cm → ${fmt(s.actualCm)}cm</p><p><b>03 보존한 구간</b>1–${c.lockedRows}단의 동작·코 수 유지. ${c.lockedRows+1}단 이후부터 다시 계산.</p><p><b>04 이후 줄임 단</b>${c.futureDecreases.join(' · ')||'없음'}단</p></div>`;
}
