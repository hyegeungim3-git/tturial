import {activeGaugeStage, GAUGE_STAGES, activeRecords, saveRecord, setDefault, archiveRecord, matchesProject, prepareSelection, applySelection} from './saved-library.js';

import {createProfilePreview} from './profile-preview-ui.js';
import {gaugeCard,gaugeEditor,readGaugeForm,updateGaugeComparison} from './gauge-library-ui.js';

export function createLibraryUI({getState, project, save, modal, closeModal, render, toast, afterApply, esc, ico}) {
  let kind = 'profiles', editingId = null, showArchived = false, viewedProfileId = null;
  const profilePreview=createProfilePreview(esc);
  const title = () => kind === 'profiles' ? '치수 · 아바타 보관함' : '재료 · 게이지 보관함';
  const ref = () => kind === 'profiles' ? 'profilePresetId' : 'materialPresetId';
  const defaultKey = () => kind === 'profiles' ? 'defaultProfileId' : 'defaultMaterialId';
  const records = () => getState().libraries[kind];
  const button = (action, label, value = '', cls = 'button small', attrs = '') => `<button type="button" class="${cls}" data-action="lib-${action}" data-value="${esc(value)}" ${attrs}>${label}</button>`;
  const field = (label, name, value, extra = '') => `<label class="field" for="lib-${name}">${label}<input id="lib-${name}" name="${name}" value="${esc(value)}" ${extra}></label>`;
  const number = (label, name, value, min, max, step = '.1') => field(label, name, value, `type="number" min="${min}" max="${max}" step="${step}" required inputmode="decimal"`);
  const badge = (text, cls = '') => `<span class="library-badge ${cls}">${text}</span>`;
  const details = r => kind === 'profiles'
    ? `<dl class="library-metrics">${[['키',r.height],['가슴둘레',r.chest],['팔 길이',r.arm],['어깨너비',r.shoulder]].map(([label,value]) => `<div><dt>${label}</dt><dd>${value}<small> cm</small></dd></div>`).join('')}</dl>`
    : `<div class="library-yarn"><strong>${esc(r.material)}</strong><span>${esc([r.brand,r.colorLabel,r.lot ? '로트 '+r.lot : ''].filter(Boolean).join(' · ') || '메리야스뜨기')}</span></div>${gaugeCard(r)}`;

  function open(nextKind = kind) {
    kind = nextKind;
    editingId = null;
    const p = project(), state = getState();
    const available = activeRecords(state, kind), archived = records().filter(r => r.archived);
    const list = showArchived ? archived : available;
    const selectedProfile=kind==='profiles'?(list.find(r=>r.id===viewedProfileId)||list.find(r=>r.id===p.profilePresetId)||list[0]):null;
    if(selectedProfile)viewedProfileId=selectedProfile.id;
    const applied = records().find(r => r.id === p[ref()]);
    const currentName = kind === 'profiles' ? p.profile.name : p.materialInfo?.name || p.design.material;
    modal(title(), `<div class="library-intro"><p>${kind === 'profiles' ? '나와 가족, 선물할 사람의 치수를 따로 저장해두세요.' : '실과 바늘이 달라질 때마다 게이지를 따로 기록해두세요.'}<br>작품마다 필요한 항목을 골라 적용할 수 있어요.</p>${button('add',ico('plus') + (kind === 'profiles' ? '착용자 등록' : '재료 등록'),'','button primary')}</div><div class="library-current"><span>지금 만드는 작품 · ${esc(p.name)}</span><strong>${ico(kind === 'profiles' ? 'person' : 'layers')}${esc(currentName)}</strong><small>${applied?.archived ? '보관한 항목의 적용 당시 정보를 사용 중이에요.' : applied && !matchesProject(p,kind,applied) ? '보관함에서 수정한 내용은 아직 작품에 반영되지 않았어요.' : '작품에 적용한 정보는 따로 보관돼요.'}</small></div>${kind==='profiles'?'<div class="profile-library-layout"><div class="profile-library-list">':''}<div class="library-list-head"><h3>${showArchived ? '보관한 항목' : '사용 중인 항목'} <span>${list.length}</span></h3>${button('toggle',showArchived ? '사용 중인 항목 보기' : `보관한 항목 ${archived.length}개`,'','quiet-link')}</div><div class="library-grid">${list.map(r => {
      const current = p[ref()] === r.id, unchanged = matchesProject(p,kind,r);
      return `<article class="library-card ${current && !r.archived ? 'is-current' : ''}" aria-label="${esc(r.name)}"><div class="library-card-title"><span class="library-symbol">${ico(kind === 'profiles' ? 'person' : 'layers')}</span><h3>${esc(r.name)}</h3></div><div class="library-badges">${current ? badge(unchanged ? '현재 작품에 적용' : '수정 내용 미적용','current') : ''}${state.libraries[defaultKey()] === r.id ? badge('새 작품 기본값') : ''}</div>${kind==='profiles'?button('avatar',r.id===viewedProfileId?'3D 아바타 보는 중':'3D 아바타 보기',r.id,'button small avatar-select-button',`aria-pressed="${r.id===viewedProfileId}"`):''}${details(r)}${r.note ? `<p class="library-note">${esc(r.note)}</p>` : ''}<div class="library-card-actions">${r.archived ? button('unarchive','다시 꺼내기',r.id,'button soft') : button('review',current && unchanged ? ico('check')+' 적용 중' : '현재 작품에 적용',r.id,'button '+(current && unchanged ? 'soft' : 'primary'),current && unchanged ? 'disabled' : '') + button('edit','수정',r.id)}</div>${!r.archived ? `<div class="library-secondary">${state.libraries[defaultKey()] !== r.id ? button('default','새 작품 기본값으로',r.id,'quiet-link') : '<span>새 작품에서 먼저 선택돼요</span>'}${button('archive','보관',r.id,'quiet-link')}</div>` : ''}</article>`;
    }).join('') || '<p class="library-empty">보관한 항목이 없어요.<br>잠시 쓰지 않는 항목은 보관했다가 다시 꺼낼 수 있어요.</p>'}</div>${kind==='profiles'?'</div>'+profilePreview.markup(selectedProfile)+'</div>':''}<p class="library-footnote">${kind === 'profiles' ? '치수는 도안 연동 360° 모델에 반영돼요. 실사 착용 이미지는 고정된 가상 모델을 사용해요.' : '색상명은 재료 기록에 저장돼요. 작품의 디자인 색상은 디자인 대화에서 바꿀 수 있어요.'}<br>이 브라우저에 저장되며, 작업실 설정에서 기록을 파일로 내보낼 수 있어요.</p>`, '', true);
    if(kind==='profiles'){document.querySelector('#modal-root .modal').classList.add('profile-library-modal');profilePreview.mount(selectedProfile);}
  }

  function editor(recordId) {
    editingId = recordId || null;
    const p = project();
    const r = recordId ? records().find(r => r.id === recordId) : kind === 'profiles'
      ? {...p.profile, name:'', note:''}
      : {...p.gauge, ...p.materialInfo, needle:p.design.needle, material:p.design.material, name:'', brand:'',colorLabel:'',lot:'',note:''};
    if (!r) return;
    const isProfile = kind === 'profiles';
    modal(`${isProfile ? '착용자' : '재료·게이지'} ${editingId ? '수정' : '등록'}`, `<p class="modal-description">${isProfile ? '옷을 입을 사람의 신체 치수를 입력해주세요. 여유분은 작품에서 따로 정해요.' : '실과 바늘을 한 묶음으로 저장해요. 같은 실도 바늘이나 손땀이 다르면 따로 등록할 수 있어요.'}</p><form id="library-form">${isProfile?'<div class="profile-editor-layout"><div>':''}${field(isProfile ? '착용자 이름' : '재료 이름','name',r.name,`required maxlength="40" placeholder="${isProfile ? '예: 나 · 기본 치수, 엄마' : '예: 봄 카디건용 메리노 · 4.5mm'}"`)}${isProfile ? `<div class="fields">${number('키 (cm)','height',r.height,100,220)}${number('가슴둘레 (cm)','chest',r.chest,50,160)}${number('팔 길이 (cm)','arm',r.arm,30,80)}${number('어깨너비 (cm)','shoulder',r.shoulder,25,65)}</div>` : `<div class="fields">${field('실 소재','material',r.material,'required maxlength="80" placeholder="예: 메리노 울 100%"')}${field('브랜드 · 제품명 (선택)','brand',r.brand,'maxlength="80"')}${field('색상명 · 색상 번호 (선택)','colorLabel',r.colorLabel,'maxlength="80"')}${field('염색 로트 (선택)','lot',r.lot,'maxlength="80"')}</div>${number('대바늘 굵기 (mm)','needle',r.needle,1,15,'.25')}${gaugeEditor(r,esc)}`}<label class="field" for="lib-note">기억해둘 내용 (선택)<textarea id="lib-note" name="note" maxlength="500" placeholder="${isProfile ? '예: 편안한 품을 좋아하고 소매는 조금 길게' : '예: 세탁 후 단 게이지가 달라져 다시 측정함'}">${esc(r.note || '')}</textarea></label>${isProfile?'</div>'+profilePreview.markup(r,true)+'</div>':''}<p class="library-footnote">저장만 하면 보관함에 담겨요. 현재 작품에 적용하기 전에는 바뀌는 조건을 한 번 더 보여드려요.</p><p class="error-text" id="library-error" role="alert"></p><div class="modal-actions library-form-actions">${button('back','목록으로')}<button type="submit" name="intent" value="save" class="button">보관함에 저장</button><button type="submit" name="intent" value="apply" class="button primary">저장하고 적용 확인</button></div></form>`, '', true);
    if(isProfile){document.querySelector('#modal-root .modal').classList.add('profile-editor-modal');profilePreview.mount(r);}
    document.getElementById('lib-name')?.focus();
  }

  function review(recordId) {
    const r = records().find(r => r.id === recordId);
    if (!r || r.archived) return;
    const p = project(), result = prepareSelection(p,kind,r), before = result.before, after = result.after;
    const rows = kind === 'profiles'
      ? [['착용자',p.profile.name,r.name], ...[['키','height'],['가슴둘레','chest'],['팔 길이','arm'],['어깨너비','shoulder']].map(([label,k]) => [label,p.profile[k]+'cm',r[k]+'cm'])]
      : [['소재',p.design.material,r.material],['대바늘',p.design.needle+'mm',r.needle+'mm'],['10cm 게이지',`${p.gauge.stitches}코 × ${p.gauge.rows}단`,`${r.stitches}코 × ${r.rows}단`]];
    if(kind==='materials')rows.push(['계산 기준',GAUGE_STAGES[activeGaugeStage({...p.gauge,...p.materialInfo})],GAUGE_STAGES[activeGaugeStage(r)]]);
    if (after.body && before.body) rows.push(['몸판 코 수',before.body.stitches+'코',after.body.stitches+'코'],['몸판 단 수',before.body.rows+'단',after.body.rows+'단'],['소매 단 수',before.sleeve.totalRows+'단',after.sleeve.totalRows+'단']);
    modal('작품에 적용할 정보 확인', `<p class="modal-description">선택한 정보는 <strong>${esc(r.name)}</strong>입니다.<br><strong>${esc(p.name)}</strong>에만 적용하고, 다른 작품의 정보는 그대로 유지해요.</p><div class="compare-scroll"><table class="version-comparison"><thead><tr><th>항목</th><th>현재</th><th>적용 후</th></tr></thead><tbody>${rows.map(([label,a,b]) => `<tr class="${a !== b ? 'different' : ''}"><th>${label}</th><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div><div class="callout">${result.bodyChanged ? '몸판 코·단 수가 바뀌어 몸판 진도를 0단부터 기록해요. 지금의 진도는 이전 버전에 남겨둘게요.' : '몸판 코·단 수가 같아 현재 몸판 진도를 유지해요.'}${before.id !== after.id ? '<br>소매는 적용 후 설계에 저장된 진도를 불러와요. 처음 쓰는 설계라면 0단부터 시작해요.' : '<br>소매 진도도 그대로 유지해요.'}${result.revisionCleared ? '<br><strong>제작 중 실측 보정은 해제돼요.</strong> 새 조건으로 적용한 뒤 실측을 다시 입력해주세요.' : ''}${result.conditionsChanged && p.pending ? '<br>대기 중인 디자인 수정안은 취소돼요.' : ''}</div>${!result.valid ? `<p class="error-text" role="alert">${esc(result.errors.join(' '))}<br>보관함에는 저장되어 있어요. 재료의 게이지나 작품 조건을 조정한 뒤 다시 적용해주세요.</p>` : ''}`, button('back','보관함으로')+button('apply','현재 작품에 적용',r.id,'button primary',result.valid ? '' : 'disabled'), true);
  }

  function handle(action, value) {
    if(profilePreview.handle(action,value))return true;
    if (!action.startsWith('lib-')) return false;
    try {
      switch (action.slice(4)) {
        case 'avatar': {viewedProfileId=value;const scroll=document.querySelector('#modal-root .modal')?.scrollTop||0;open();const m=document.querySelector('#modal-root .modal');m.scrollTop=scroll;m.querySelector('[data-action="lib-avatar"][aria-pressed="true"]')?.focus({preventScroll:true});break;}
        case 'add': editor(); break;
        case 'edit': editor(value); break;
        case 'back': open(); break;
        case 'toggle': showArchived = !showArchived; open(); break;
        case 'review': review(value); break;
        case 'default': setDefault(getState(),kind,value); save(); render(); open(); toast('새 작품을 시작할 때 먼저 선택돼요.'); break;
        case 'archive': archiveRecord(getState(),kind,value); save(); render(); open(); toast('목록에서 보관했어요. 작품에 적용한 정보는 유지돼요.'); break;
        case 'unarchive': archiveRecord(getState(),kind,value,false); showArchived = false; save(); open(); toast('다시 사용할 수 있어요.'); break;
        case 'apply': {
          const r = records().find(r => r.id === value);
          if (!r) throw new Error('저장된 항목을 찾지 못했어요.');
          const result = applySelection(project(),kind,r);
          save(); closeModal(); afterApply(kind,result); render();
          toast(result.changed ? '선택한 정보를 현재 작품에 적용했어요.' : '이미 같은 정보가 적용되어 있어요.');
          break;
        }
      }
    } catch (error) { toast(error.message); }
    return true;
  }

  function submit(event) {
    if (event.target.id !== 'library-form') return false;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    for (const name of kind === 'profiles' ? ['height','chest','arm','shoulder'] : ['needle']) data[name] = Number(data[name]);
    if(kind==='materials'){Object.assign(data,readGaugeForm(event.target));for(const name of Object.keys(data))if(name.startsWith('gauge-'))delete data[name];}
    for (const [name,value] of Object.entries(data)) if (typeof value === 'string') data[name] = value.trim();
    try {
      const r = saveRecord(getState(),kind,data,editingId);
      save(); render(); showArchived = false;
      if (event.submitter?.value === 'apply') review(r.id); else {open();toast('보관함에 저장했어요. 작품에 적용한 정보는 유지돼요.');}
    } catch(error) { document.getElementById('library-error').textContent = error.message; }
    return true;
  }

  function newProjectFields() {
    const state = getState(),lib = state.libraries;
    return `<div class="library-new-fields"><p>저장한 정보로 바로 시작해요</p>${[['profiles','착용자 · 치수','new-profile',lib.defaultProfileId],['materials','재료 · 게이지','new-material',lib.defaultMaterialId]].map(([type,label,inputId,selected]) => `<label class="field" for="${inputId}">${label}<select id="${inputId}" required>${activeRecords(state,type).map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)} · ${type === 'profiles' ? '가슴 '+r.chest+'cm' : r.stitches+'코 × '+r.rows+'단'}</option>`).join('')}</select></label>`).join('')}</div><p class="error-text" id="new-project-error" role="alert"></p>`;
  }
  function input(event){if(event.target.form?.id!=='library-form')return;if(kind==='profiles')profilePreview.input(event);else updateGaugeComparison(event);}
  return {input,disposePreview:()=>profilePreview.dispose(),open: nextKind => {showArchived=false;open(nextKind);}, handle, submit, newProjectFields};
}
