import {ensureLibraries} from './saved-library.js?v=20260924c';
import {compileDesign} from './design-engine.js';

export const STORAGE_KEY = 'hanol-prototype-v1';
export const RECOVERY_KEY = `${STORAGE_KEY}-before-import`;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function requireValue(ok, label) {
  if (!ok) throw new Error(`${label} 형식을 확인할 수 없어요. 뜨리얼에서 내보낸 작업 기록 파일을 선택해 주세요.`);
}
const text = (v, label) => requireValue(typeof v === 'string', label);
const number = (v, label) => requireValue(Number.isFinite(v) && Math.abs(v) <= 100000, label);
const identifier = (v, label) => requireValue(typeof v === 'string' && /^[\w-]{1,150}$/.test(v), label);

function checkTree(value, depth = 0) {
  requireValue(depth < 60, '파일 구조');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    requireValue(!['__proto__','constructor','prototype'].includes(key), '파일 항목');
    checkTree(child, depth + 1);
  }
}
function profile(p) {
  requireValue(object(p), '치수');
  text(p.name, '착용자 이름');
  for (const key of ['height','chest','arm','shoulder']) number(p[key], '치수');
}
function gauge(g) {
  requireValue(object(g), '게이지');
  number(g.stitches, '코 게이지'); number(g.rows, '단 게이지');
  if (g.needle != null) number(g.needle, '바늘 굵기');
  if (g.activeGaugeStage != null) requireValue(['before','after','reference'].includes(g.activeGaugeStage), '게이지 기준');
  if (g.gaugeReadings != null) {
    requireValue(object(g.gaugeReadings), '게이지 기록');
    for (const [stage, pair] of Object.entries(g.gaugeReadings)) {
      requireValue(['before','after','reference'].includes(stage), '게이지 기준');
      if (pair != null) gauge(pair);
    }
  }
}
function design(d) {
  requireValue(object(d), '디자인');
  for (const key of ['length','sleeve','ease','needle']) number(d[key], '디자인 치수');
  for (const key of ['color','trim']) requireValue(typeof d[key] === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(d[key]), '디자인 색상');
  for (const key of ['material','colorName','trimName']) text(d[key], '디자인 설명');
  if (d.knit != null) {
    requireValue(object(d.knit), '소매 설계');
    for (const [key,value] of Object.entries(d.knit)) {
      if (key === 'id') identifier(value, '설계 번호'); else number(value, '소매 설계');
    }
  }
  if (d.sleeveRevision != null) {
    requireValue(object(d.sleeveRevision) && object(d.sleeveRevision.measurement), '실측 보정');
    number(d.sleeveRevision.measurement.rows, '실측 단 수');
    number(d.sleeveRevision.measurement.cm, '실측 길이');
  }
}
function progress(record) {
  requireValue(object(record), '소매 진도');
  for (const key of ['left','right','leftCheckpoint','rightCheckpoint']) {
    if (record[key] != null) requireValue(Number.isInteger(record[key]) && record[key] >= 0, '소매 진도');
  }
}
function snapshot(p) {
  requireValue(object(p), '작품');
  identifier(p.id, '작품·버전 번호'); text(p.name, '작품·버전 이름');
  profile(p.profile); gauge(p.gauge); design(p.design);
  if (p.rowsDone != null) requireValue(Number.isInteger(p.rowsDone) && p.rowsDone >= 0, '몸판 진도');
  try { compileDesign(p); } catch { requireValue(false, '도안 계산 기록'); }
}
function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    requireValue(object(item), label); identifier(item.id, label);
    requireValue(!ids.has(item.id), `${label} 중복`); ids.add(item.id);
  }
}

export function parseBackup(source) {
  requireValue(typeof source === 'string' && new Blob([source]).size <= MAX_BACKUP_BYTES, '파일 크기(20MB 이하)');
  let state;
  try { state = JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch { throw new Error('JSON 파일을 읽을 수 없어요. 뜨리얼에서 내보낸 작업 기록 파일을 선택해 주세요.'); }
  checkTree(state);
  requireValue(object(state) && Array.isArray(state.projects) && state.projects.length > 0, '작품 목록');
  profile(state.profile); uniqueIds(state.projects, '작품 번호');
  if (state.savedGauge != null) gauge(state.savedGauge);
  for (const p of state.projects) {
    snapshot(p); requireValue(['시작 전','진행 중','완료'].includes(p.status), '작품 상태');
    text(p.note, '제작 메모');
    requireValue(Number.isInteger(p.rowsDone) && p.rowsDone >= 0, '몸판 진도');
    if (p.knitting != null) {
      requireValue(object(p.knitting), '소매 진도');
      for (const record of Object.values(p.knitting)) progress(record);
    }
    requireValue(Array.isArray(p.messages) && Array.isArray(p.versions), '대화·버전 기록');
    uniqueIds(p.versions, '버전 번호');
    for (const v of p.versions) { snapshot(v); requireValue(typeof v.date === 'string' && Number.isFinite(Date.parse(v.date)), '버전 날짜'); }
    for (const m of p.messages) {
      requireValue(object(m) && ['user','assistant'].includes(m.role), '대화'); text(m.text, '대화 내용');
      if (m.attachments != null) {
        requireValue(Array.isArray(m.attachments), '첨부 자료');
        for (const a of m.attachments) {
          requireValue(object(a), '첨부 자료'); text(a.name, '첨부 자료 이름');
          if (a.data != null) requireValue(typeof a.data === 'string' && /^data:image\/(png|jpeg|webp|gif|bmp|avif);base64,[A-Za-z0-9+/=\r\n]+$/.test(a.data), '첨부 이미지');
        }
      }
    }
    if (p.pending != null) {
      requireValue(object(p.pending) && ['sleeve','length','ease','color','knit'].includes(p.pending.key), '수정안');
      if (p.pending.changes != null) requireValue(object(p.pending.changes), '수정안');
      snapshot({...p,design:{...p.design,...(p.pending.changes || {[p.pending.key]:p.pending.value}),...(p.pending.key === 'color' ? {colorName:p.pending.after} : {})}});
      if (p.pending.continuation != null) {
        requireValue(object(p.pending.continuation), '실측 수정안');
        identifier(p.pending.continuation.sourcePlanId, '실측 설계 번호');
        progress(p.pending.continuation.progress);
      }
    }
  }
  if (state.libraries != null) {
    const lib = state.libraries;
    requireValue(object(lib) && lib.version === 1 && Array.isArray(lib.profiles) && Array.isArray(lib.materials), '보관함');
    for (const kind of ['profiles','materials']) {
      uniqueIds(lib[kind], '보관함 번호');
      requireValue(lib[kind].some(r => !r.archived), '사용 중인 보관함');
    }
    for (const r of lib.profiles) profile(r);
    for (const r of lib.materials) { text(r.name, '재료 이름'); text(r.material, '소재'); gauge(r); }
    requireValue(lib.profiles.some(r => r.id === lib.defaultProfileId && !r.archived) && lib.materials.some(r => r.id === lib.defaultMaterialId && !r.archived), '보관함 기본값');
  }
  // Keep project snapshots and their measured design hashes untouched.
  ensureLibraries(state);
  if (!state.projects.some(p => p.id === state.currentId)) state.currentId = state.projects[0].id;
  return state;
}

export function backupSummary(state) {
  return {projects:state.projects.length, profiles:state.libraries.profiles.length,
    materials:state.libraries.materials.length, versions:state.projects.reduce((sum,p) => sum + p.versions.length, 0)};
}

export function commitBackup(storage, nextState, currentState) {
  const serialized = JSON.stringify(nextState);
  // Save the current in-memory workspace first, including edits not yet persisted.
  // A failed setItem leaves the previous main record intact; never swap UI state on failure.
  try {
    storage.setItem(RECOVERY_KEY, JSON.stringify(currentState));
    storage.setItem(STORAGE_KEY, serialized);
  } catch {
    throw new Error('브라우저에 기록을 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요. 현재 작업 기록은 바뀌지 않았어요.'); 
  }
}
