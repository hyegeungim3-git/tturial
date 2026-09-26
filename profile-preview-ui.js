import {profileDimensions} from './profile-shape.js';

export function createProfilePreview(esc) {
  let viewer=null,generation=0,lastProfile=null;
  const control=(action,label,value='')=>`<button type="button" class="button small" data-action="lib-view-${action}" data-value="${value}">${label}</button>`;
  function markup(profile, editing=false) {
    return `<aside class="profile-avatar-panel" aria-label="3D 아바타 미리보기"><div class="profile-avatar-heading"><span class="eyebrow">MY AVATAR</span><h3 id="profile-preview-name">${esc(profile?.name || (editing ? '새 착용자' : '착용자를 선택해주세요'))}</h3><p>${editing ? '입력 중인 치수로 미리 보는 아바타' : '선택한 사람의 저장된 치수'}</p></div><div class="profile-avatar-stage"><span class="profile-avatar-caption">3D 치수 아바타</span><div id="profile-avatar-canvas" class="profile-avatar-canvas" role="img" aria-label="드래그하거나 좌우 방향키로 회전하는 3D 치수 아바타" aria-busy="true"><p class="avatar-load-message">${profile ? '아바타를 불러오는 중이에요' : '치수를 등록하면 아바타를 볼 수 있어요'}</p></div><span class="profile-avatar-hint">드래그 · 좌우 방향키로 돌려보세요</span></div><div class="profile-avatar-controls" aria-label="아바타 보기 방향">${control('angle','앞','0')}${control('angle','옆','90')}${control('angle','뒤','180')}${control('zoom','확대')}${control('reset','초기화')}</div><p id="profile-preview-measurements" class="profile-preview-measurements"></p><p id="profile-preview-status" class="profile-preview-status" role="status">${editing ? '치수를 바꾸면 모델에 바로 반영돼요. 아직 저장되지 않았어요.' : '아바타를 살펴봐도 작품에 적용한 치수는 바뀌지 않아요.'}</p><p class="profile-avatar-note">입력한 네 가지 치수를 반영한 형태예요. 얼굴과 체형의 세부 모습은 공통 모델을 사용해요.</p></aside>`;
  }
  function updateLabels(profile) {
    const name=document.getElementById('profile-preview-name'),summary=document.getElementById('profile-preview-measurements');
    if(name)name.textContent=profile.name || '새 착용자';
    if(summary)summary.textContent=`키 ${profile.height} · 가슴 ${profile.chest} · 팔 ${profile.arm} · 어깨 ${profile.shoulder} cm`;
  }
  async function mount(profile) {
    dispose();
    const target=document.getElementById('profile-avatar-canvas'),token=generation;
    if(!target || !profile){target?.setAttribute('aria-busy','false');return;}
    lastProfile={...profile};updateLabels(profile);
    try {
      const {createProfileAvatar}=await import('./profile-avatar.js?v=20260926a');
      if(token !== generation || !target.isConnected)return;
      viewer=createProfileAvatar(target,lastProfile);
      target.setAttribute('aria-busy','false');
    } catch(error) {
      if(token !== generation || !target.isConnected)return;
      target.setAttribute('aria-busy','false');
      target.innerHTML='<p class="avatar-load-message">이 브라우저에서 3D를 표시하지 못했어요.<br>치수 등록과 수정은 계속할 수 있어요.</p>';
      console.error('Profile avatar:',error);
    }
  }
  function input(event) {
    if(!['lib-name','lib-height','lib-chest','lib-arm','lib-shoulder'].includes(event.target.id))return;
    const p={name:document.getElementById('lib-name').value};
    for(const key of ['height','chest','arm','shoulder'])p[key]=Number(document.getElementById('lib-'+key).value);
    const status=document.getElementById('profile-preview-status');
    if(!profileDimensions(p)) {
      if(status)status.textContent='치수의 입력 범위를 확인해주세요. 모델은 마지막으로 입력한 유효한 치수를 보여주고 있어요.';
      return;
    }
    lastProfile=p;updateLabels(p);viewer?.update(p);
    if(status)status.textContent='입력한 치수를 미리 보고 있어요. 아직 저장되지 않았어요.';
  }
  function handle(action,value) {
    if(!action.startsWith('lib-view-'))return false;
    if(action==='lib-view-angle')viewer?.angle(Number(value));
    if(action==='lib-view-reset') {viewer?.reset();const b=document.querySelector('[data-action="lib-view-zoom"]');if(b)b.textContent='확대';}
    if(action==='lib-view-zoom') {const zoom=viewer?.zoom();const b=document.querySelector('[data-action="lib-view-zoom"]');if(b)b.textContent=zoom?'축소':'확대';}
    return true;
  }
  function dispose(){generation++;viewer?.dispose();viewer=null;lastProfile=null;}
  return {markup,mount,input,handle,dispose};
}
