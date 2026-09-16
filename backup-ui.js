import {parseBackup, backupSummary, commitBackup, RECOVERY_KEY, MAX_BACKUP_BYTES} from './backup.js';

export function createBackupUI({getState, applyState, modal, closeModal, toast, esc}) {
  let draft = null;
  let revision = 0;
  const button = (action, label, primary = false) => `<button type="button" class="button${primary ? ' primary' : ''}" data-action="${action}">${label}</button>`;
  const summary = state => {
    const s = backupSummary(state);
    return `작품 ${s.projects}개 · 착용자 ${s.profiles}명 · 재료 ${s.materials}개 · 디자인 버전 ${s.versions}개`;
  };
  function open() {
    revision++; draft = null;
    modal('작업 기록 불러오기', `<p class="modal-description">이전에 내보낸 JSON 파일을 선택해 주세요. 내용을 확인한 뒤 복원할 수 있어요.</p><label class="field">작업 기록 파일<input id="backup-file" type="file" accept=".json,application/json" aria-describedby="backup-file-help backup-error"></label><p class="modal-description" id="backup-file-help">뜨리얼-작업기록.json · 최대 20MB<br>파일은 이 브라우저에서만 읽으며 서버에 전송하지 않아요.</p><p class="error-text" id="backup-error" role="alert"></p>`, button('close','취소'));
  }
  function review(next, filename, recovery = false) {
    draft = next;
    modal(recovery ? '직전 기록으로 되돌리기' : '불러올 기록 확인', `<p class="modal-description">${esc(filename)}</p><div class="callout"><strong>${summary(next)}</strong><br>작품: ${next.projects.slice(0,5).map(p => esc(p.name)).join(', ')}${next.projects.length > 5 ? ' 외' : ''}</div><p class="modal-description">현재 기록(${summary(getState())})을 위 기록으로 바꿉니다. 현재 기록은 별도로 보관해 설정에서 다시 되돌릴 수 있어요. 기록을 합치지는 않아요.</p><p class="error-text" id="backup-error" role="alert"></p>`, button('close','취소') + button('backup-apply',recovery ? '직전 기록으로 되돌리기' : '이 기록으로 복원',true));
  }
  async function change(event) {
    if (event.target.id !== 'backup-file') return;
    const input = event.target, file = input.files?.[0], token = ++revision;
    draft = null;
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('20MB 이하의 작업 기록 파일을 선택해 주세요.');
      const next = parseBackup(await file.text());
      if (token !== revision || !input.isConnected) return;
      review(next, file.name);
    } catch (error) {
      if (token === revision && input.isConnected) {
        document.querySelector('#backup-error').textContent = error.message;
        input.value = '';
      }
    }
  }
  function handle(action) {
    if (action === 'backup-import') { open(); return true; }
    if (action === 'backup-recover') {
      try {
        const source = localStorage.getItem(RECOVERY_KEY);
        if (!source) { toast('아직 복원 전 기록이 없어요.'); return true; }
        review(parseBackup(source), '마지막 복원 직전의 작업 기록', true);
      } catch (error) { toast(error.message); }
      return true;
    }
    if (action === 'backup-apply') {
      if (!draft) return true;
      try { commitBackup(localStorage, draft, getState()); }
      catch (error) { document.querySelector('#backup-error').textContent = error.message; return true; }
      const next = draft; draft = null;
      closeModal(); applyState(next); toast('작업 기록을 복원했어요. 직전 기록은 설정에서 되돌릴 수 있어요.');
      return true;
    }
    return false;
  }
  function cancel() { draft = null; revision++; }
  function recoveryButton() {
    try { return localStorage.getItem(RECOVERY_KEY) ? button('backup-recover','직전 기록으로 되돌리기') : ''; }
    catch { return ''; }
  }
  return {handle, change, cancel, recoveryButton};
}