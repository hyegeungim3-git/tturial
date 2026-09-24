import {compileDesign,compareDesign} from './design-engine.js';
import {continuationDetails} from './measurement.js';
const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
const delta=n=>(n>0?'+':'')+n;
function productionScope(plan){
  if(!plan.valid)return `<section class="callout amber" aria-label="제작 범위"><strong>제작 범위 · ${plan.id}</strong><br>계산 조건을 확인한 뒤 제작 범위를 확정할 수 있어요. 현재 수치는 제작 지시로 사용하지 마세요.</section>`;
  const b=plan.body,s=plan.sleeve;
  return `<section class="callout" aria-label="제작 범위"><strong>제작 범위 · ${plan.id}</strong><br>몸판: 겨드랑이 아래 목표 ${b.stitches}코 × ${b.rows}단의 메리야스 반복 계산 예시입니다. 밑단에 배분할 단은 정해지지 않았어요.<br>소매: 겨드랑이에서 ${s.startStitches}코를 확보한 뒤 ${s.underarmRows}단을 떠서 ${s.cuffStitches}코로 마치는 단별 지시의 코 수·반복 규칙을 확인했어요.<br>요크·겨드랑이 분리와 연결·목선·몸판 밑단·코막음은 아직 설계되지 않았어요. 전체 스웨터 제작 도안과 실제 착용감은 별도 검증이 필요합니다.</section>`;
}
export function designSummary(original,shown=original,pending=false) {
  const plan=compileDesign(shown),base=compileDesign(original),s=plan.sleeve,diff=compareDesign(base,plan);
  if(!plan.valid||!s)return `<section class="knit-summary invalid" aria-label="도안 연동 계산 결과"><div class="knit-heading"><h3>설계 조건을 확인해 주세요</h3><span class="knit-id">${plan.id}</span></div><div class="knit-error" role="alert">${plan.errors.join('<br>')||'계산 규칙을 통과하지 못했어요.'}</div>${productionScope(plan)}<div class="knit-links"><button data-action="knit-edit">길이·소맷단 조정</button></div></section>`;
  return `<section class="knit-summary ${plan.valid?'':'invalid'}" aria-label="도안 연동 계산 결과"><div class="knit-heading"><div><span class="knit-eyebrow">PATTERN LINK</span><h3>${pending?'수정안을 코·단으로 계산했어요':'도안과 형태, 하나의 설계로'}</h3></div><span class="knit-id">${plan.id}</span></div>
  <div class="knit-metrics"><div><small>계산 소매 길이</small><strong>${fmt(s.actualCm)}<em>cm</em></strong><span>요청 ${s.requestedCm}cm</span></div><div><small>겨드랑이 아래</small><strong>${s.underarmRows}<em>단</em></strong><span>${pending&&diff?`${delta(diff.rows)}단 변경`:`메리야스 ${s.shapingRows} + 고무단 ${s.cuffRows}`}</span></div><div><small>소매 코 수</small><strong>${s.startStitches}<em> → </em>${s.cuffStitches}</strong><span>2코씩 ${s.decreaseCount}회 줄임</span></div></div>
  ${plan.valid?`<p class="knit-validation"><span class="knit-dot"></span>코 수 연결 · 고무뜨기 반복 · 줄임 간격 확인${pending&&diff?.cuffPreserved?' · 고무단 유지':''}</p>`:`<div class="knit-error" role="alert">${plan.errors.join('<br>')}</div>`}
  ${s.continuation?`<p class="measure-linked">완료 ${s.continuation.lockedRows}단 보존 · 실측 ${s.continuation.measurement.cm}cm 반영 · 금색선은 공통 보존 경계</p>`:''}${productionScope(plan)}<div class="knit-links"><button data-action="knit-edit">길이·소맷단 조정</button><button data-action="knit-details">계산 근거와 단별 도안 →</button></div></section>`;
}
export function designDetails(p) {
  const plan=compileDesign(p),s=plan.sleeve;
  if(!plan.valid||!s)return `<div class="knit-detail"><div class="knit-error" role="alert">${plan.errors.join('<br>')||'계산 규칙을 통과하지 못했어요.'}</div>${productionScope(plan)}</div>`;
  const t=plan.input.template,g=plan.gauge;
  return `<div class="knit-detail"><div class="knit-detail-head"><span class="knit-id">${plan.id}</span><span>${plan.valid?'계산 규칙 통과':'조건 조정 필요'} · 양쪽 소매에 동일 적용</span></div>${s.continuation?continuationDetails(plan):`<div class="knit-formulas"><p><b>01 길이를 정수 단으로</b> ${s.requestedCm}cm × ${g.rowsPerCm}단/cm → ${s.totalRows}단 → ${s.actualCm}cm</p><p><b>02 고정 구간 분리</b> 요크 측 소매 ${s.capRows}단 상당 + 메리야스 ${s.shapingRows}단 + 고무단 ${s.cuffRows}단</p><p><b>03 줄임 횟수</b> (${s.startStitches}코 − ${s.cuffStitches}코) ÷ 2 = ${s.decreaseCount}회</p><p><b>04 줄임 간격 재배치</b> ${s.decreaseRounds.join(' · ')||'없음'}단</p></div>`}
  <div class="knit-checks">${plan.checks.map(c=>`<span class="${c.ok?'pass':'fail'}">${c.ok?'✓':'!'} ${c.label}</span>`).join('')}</div>
  ${productionScope(plan)}
  <p class="knit-assumptions">소매 길이: 어깨에서 소맷단까지. 요크 측 소매 ${t.sleeveCapCm}cm는 템플릿 고정값이며 해당 구간의 코 배분은 별도 설계입니다. 아래 도안은 겨드랑이에서 ${s.startStitches}코를 확보한 이후부터 시작합니다. 소매 시작 둘레 ${s.actualUpperArmCm}cm, 소맷단 둘레 ${s.actualCuffCm}cm, 고무단 길이 ${s.actualCuffLengthCm}cm. 고무단에도 메리야스 게이지를 가정했으므로 제작 전 고무단 게이지와 여유량을 확인하세요.</p>
  ${plan.valid?`<details class="knit-rounds"><summary>소매 ${s.underarmRows}단 전체 도안 펼치기</summary><div class="knit-table-scroll"><table><thead><tr><th>단</th><th>뜨는 방법</th><th>완료 코 수</th></tr></thead><tbody>${s.rounds.map(r=>`<tr class="${r.round<=(s.continuation?.lockedRows||0)?'kept':r.operation==='paired-decrease'?'decrease':r.section==='cuff'?'rib':''}"><td>${r.round}${r.round<=(s.continuation?.lockedRows||0)?'<small class="kept-label">보존</small>':''}</td><td>${r.instruction}</td><td>${r.after}코</td></tr>`).join('')}</tbody></table></div><p>마지막 단 이후에는 별도로 선택한 탄성 코막음을 합니다. 코막음은 위 단 수에 포함하지 않습니다.</p></details>`:`<div class="knit-error">${plan.errors.join('<br>')}</div>`}
  <div class="knit-boundary">현재 확인하는 것은 템플릿의 수치·반복 규칙입니다. 전체 래글런 요크, 연결부와 실제 착용감은 시험 제작 검토가 필요합니다. 실사 착용 이미지는 별도로 생성된 참고 이미지이며 이 계산의 검증 결과가 아닙니다.</div></div>`;
}
export function structuralControls(plan) {
  return `<div class="structure-controls" aria-label="구조 보기 설정"><div class="structure-modes"><button data-action="structure-view" data-value="surface" class="active">의상</button><button data-action="structure-view" data-value="parts">부위</button><button data-action="structure-view" data-value="normal">표면 방향</button><button data-action="structure-view" data-value="depth">깊이</button></div><div class="structure-angles">${[[0,'앞'],[90,'옆'],[180,'뒤'],[270,'반대쪽']].map(([n,s])=>`<button data-action="structure-angle" data-value="${n}">${s}</button>`).join('')}<button data-action="structure-auto" aria-pressed="false">자동 회전</button></div><div class="structure-export"><span>동일 설계 ${plan.id} · 드래그로 360° 회전</span><button data-action="structure-export">생성 가이드 8시점 저장 ↓</button></div></div>`;
}
