import {compileDesign} from './design-engine.js';
// Progress belongs to a compiled specification. A changed schedule never silently
// reinterprets stitches already knitted under another specification.
export function progressFor(project,side='left') {
  const plan=compileDesign(project),record=project.knitting?.[plan.id]||{};
  const done=Math.max(0,Math.min(record[side]||0,plan.sleeve?.underarmRows||0));
  const checkpoint=record[side+'Checkpoint'];
  return {plan,done,checkpoint,next:plan.sleeve?.rounds[done],nextDecrease:plan.sleeve?.decreaseRounds.find(n=>n>done),oldSpecs:Object.keys(project.knitting||{}).filter(k=>k!==plan.id)};
}
export function updateProgress(project,side,action) {
  if(!['left','right'].includes(side))throw new Error('Unknown sleeve');
  const {plan,done}=progressFor(project,side);if(!plan.valid)return;
  project.knitting||={};const record=project.knitting[plan.id]||={left:0,right:0};
  if(action==='plus')record[side]=Math.min(plan.sleeve.underarmRows,done+1);
  if(action==='minus')record[side]=Math.max(0,done-1);
  if(action==='checkpoint')record[side+'Checkpoint']=done;
  if(action==='minus'&&record[side+'Checkpoint']>record[side])delete record[side+'Checkpoint'];
  if(project.status==='시작 전'&&record[side]>0)project.status='진행 중';
  record.updatedAt=new Date().toISOString();
}
export function runnerMarkup(project,side) {
  const {plan,done,checkpoint,next,nextDecrease,oldSpecs}=progressFor(project,side);
  if(!plan.valid)return '<div class="knit-error">적용된 설계의 계산 조건을 먼저 확인해 주세요.</div>';
  return `<div class="runner-tabs"><button data-action="knit-side" data-value="left" aria-pressed="${side==='left'}" class="${side==='left'?'active':''}">왼쪽 소매</button><button data-action="knit-side" data-value="right" aria-pressed="${side==='right'}" class="${side==='right'?'active':''}">오른쪽 소매</button></div><div class="knit-runner"><span class="knit-id">${plan.id}</span><p class="runner-round">${next?next.round+'단':'뜨기 완료'}</p><div class="runner-instruction">${next?next.instruction:'마지막 고무단까지 기록했어요. 탄성 코막음과 마무리를 진행해 주세요.'}</div><p class="runner-counts">${next?'시작 '+next.before+'코 → 완료 '+next.after+'코':plan.sleeve.cuffStitches+'코'}</p><p class="runner-next">${next?.operation==='paired-decrease'?'이번 단은 2코 줄임 단이에요.':nextDecrease?'다음 줄임: '+nextDecrease+'단 · '+(nextDecrease-done)+'단째에 줄임':'남은 줄임 없음'}<br>${done} / ${plan.sleeve.underarmRows}단 완료 · ${side==='left'?'왼쪽':'오른쪽'} 소매만 기록</p><div class="row"><button class="button" data-action="knit-step" data-value="minus" ${done?'':'disabled'}>1단 되돌리기</button><button class="button primary" data-action="knit-step" data-value="plus" ${next?'':'disabled'}>이 단 완료</button></div>${checkpoint!==undefined?'<p class="runner-checkpoint">안전실 기록 · '+checkpoint+'단 완료 위치</p>':''}<div class="measure-entry"><div><strong>실제 길이는 잘 맞고 있나요?</strong><p>완료한 단을 보존하고 남은 도안을 맞춰요.</p></div><button class="button small" data-action="measurement-open">실측 입력 · 남은 도안 조정</button></div><p class="runner-hint">실제 편물에 안전실을 넣었다면 위치를 기록해 두세요. 기록 버튼이 실수 복구나 편물의 상태를 판별하지는 않아요.</p><button class="button small" data-action="knit-step" data-value="checkpoint">현재 위치에 안전실 기록</button></div><p class="runner-hint">진도는 설계별로 저장해요. 실측 수정은 완료 구간과 진도를 새 설계로 이어받아요. 일반 디자인 변경은 별도 진도로 기록해요.${oldSpecs.length?' 이전 설계 '+oldSpecs.length+'개의 기록을 보관하고 있어요.':''} 겨드랑이 아래 소매 구간이며 몸판 진도와는 별개예요.</p>`;
}
