import {GAUGE_STAGES,activeGaugeStage,gaugeReadings,gaugeDifference} from './saved-library.js?v=20260924c';

export function gaugeComparison(r) {
  const delta=gaugeDifference(r);
  if(!delta)return '<span>세탁 전·후 값을 모두 입력하면 변화를 비교할 수 있어요.</span>';
  const change=(value)=>Math.abs(value)<.05?'변화 없음':`${Math.abs(value).toFixed(1)}% ${value>0?'늘어남':'줄어듦'}`;
  return `<strong>가로 ${change(delta.widthPercent)} · 세로 ${change(delta.lengthPercent)}</strong><span>같은 코·단 수로 뜬 스와치의 길이 변화예요.</span>`;
}
export function gaugeCard(r) {
  const readings=gaugeReadings(r),active=activeGaugeStage(r);
  return `<div class="gauge-pair-summary">${['before','after'].map(stage=>`<div class="${active===stage?'is-active':''}"><span>${GAUGE_STAGES[stage]}</span><strong>${readings[stage]?readings[stage].stitches+'<small>코 × </small>'+readings[stage].rows+'<small>단</small>':'<small>미등록</small>'}</strong>${active===stage?'<small>도안 계산에 사용</small>':''}</div>`).join('')}</div><p class="library-source">${GAUGE_STAGES[active]} 사용 · 10cm당 ${r.stitches}코 × ${r.rows}단 · ${r.needle}mm</p>${readings.before&&readings.after?`<div class="gauge-change-summary">${gaugeComparison(r)}</div>`:''}`;
}
export function gaugeEditor(r,esc) {
  const readings=gaugeReadings(r),active=activeGaugeStage(r);
  const fields=stage=>`<div class="fields">${[['stitches','코 수',5,60],['rows','단 수',5,80]].map(([key,label,min,max])=>`<label class="field" for="gauge-${stage}-${key}">${GAUGE_STAGES[stage]} · 10cm ${label}<input type="number" id="gauge-${stage}-${key}" name="gauge-${stage}-${key}" value="${esc(readings[stage]?.[key]??'')}" min="${min}" max="${max}" step=".1" inputmode="decimal" placeholder="미입력"></label>`).join('')}</div>`;
  return `<div class="library-form-section gauge-pair-editor"><h3>같은 스와치, 세탁 전과 후</h3><p>같은 실·바늘·메리야스뜨기 기준으로 기록해요. 아직 측정하지 않은 쪽은 비워두어도 괜찮아요.</p><div class="gauge-measurement-panel"><h4>01 <span>세탁 전</span></h4>${fields('before')}</div><div class="gauge-measurement-panel after"><h4>02 <span>세탁·건조 후</span></h4><p>세탁 후 완전히 말린 스와치의 가운데 10 × 10cm를 측정해주세요.</p>${fields('after')}</div><details class="gauge-reference" ${active==='reference'?'open':''}><summary>실 라벨 참고값 ${readings.reference?'· 저장됨':'(선택)'}</summary>${fields('reference')}</details><label class="field" for="gauge-active">도안 계산에 사용할 게이지<select id="gauge-active" name="activeGaugeStage">${Object.entries(GAUGE_STAGES).map(([key,label])=>`<option value="${key}" ${key===active?'selected':''}>${label}</option>`).join('')}</select></label><div class="gauge-change-summary" id="gauge-live-comparison" role="status">${gaugeComparison(r)}</div><p class="gauge-selection-note">작품에 적용하면 선택한 값으로 코·단 수를 계산해요. 세탁 전·후 데이터는 모두 함께 저장돼요.</p></div>`;
}
export function readGaugeForm(form) {
  const values=new FormData(form),readings={};
  for(const stage of Object.keys(GAUGE_STAGES)) {
    const stitches=values.get(`gauge-${stage}-stitches`),rows=values.get(`gauge-${stage}-rows`);
    if(stitches!==''||rows!=='')readings[stage]={stitches:stitches===''?null:Number(stitches),rows:rows===''?null:Number(rows)};
  }
  return {gaugeReadings:readings,activeGaugeStage:values.get('activeGaugeStage')};
}
export function updateGaugeComparison(event) {
  if(!event.target.id.startsWith('gauge-'))return;
  const box=document.getElementById('gauge-live-comparison');
  if(box)box.innerHTML=gaugeComparison(readGaugeForm(event.target.form));
}
