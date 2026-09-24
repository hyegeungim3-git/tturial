import {compileDesign} from './design-engine.js';

const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const id = () => crypto.randomUUID();
export const profileValues = r => ({name:r.name, height:r.height, chest:r.chest, arm:r.arm, shoulder:r.shoulder});
export const gaugeValues = r => ({stitches:r.stitches, rows:r.rows, needle:r.needle, source:r.source});
export const GAUGE_STAGES = {before:'세탁 전', after:'세탁·건조 후', reference:'실 라벨 참고값'};
export const activeGaugeStage = r => r.activeGaugeStage || (r.source === 'measured' ? 'after' : 'reference');
export const gaugeReadings = r => copy(r.gaugeReadings || {[activeGaugeStage(r)]:{stitches:r.stitches,rows:r.rows}});
export function resolveGaugeRecord(r) {
  const readings = gaugeReadings(r), stage = activeGaugeStage(r), selected = readings[stage];
  return {...r,gaugeReadings:readings,activeGaugeStage:stage,stitches:selected?.stitches,rows:selected?.rows,source:stage === 'reference' ? 'reference' : 'measured'};
}
export function gaugeDifference(r) {
  const {before,after} = gaugeReadings(r);
  if (!before || !after || ![before.stitches,before.rows,after.stitches,after.rows].every(n => Number.isFinite(n) && n > 0)) return null;
  // Same stitch/row count: physical dimension is inversely proportional to gauge.
  return {stitches:after.stitches-before.stitches,rows:after.rows-before.rows,widthPercent:(before.stitches/after.stitches-1)*100,lengthPercent:(before.rows/after.rows-1)*100};
}
export const MAX_SWATCH_PHOTO_BYTES = 240 * 1024;
export function validSwatchPhoto(value) {
  if (typeof value !== 'string' || value.length > 330000) return false;
  const encoded = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)?.[1];
  if (!encoded || encoded.length % 4 !== 0) return false;
  return encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0) <= MAX_SWATCH_PHOTO_BYTES;
}
export const materialInfo = r => ({name:r.name, brand:r.brand || '', colorLabel:r.colorLabel || '', lot:r.lot || '', note:r.note || '',gaugeReadings:gaugeReadings(r),activeGaugeStage:activeGaugeStage(r),...(validSwatchPhoto(r.swatchPhoto) ? {swatchPhoto:r.swatchPhoto} : {})});
const materialValues = r => ({material:r.material, ...gaugeValues(r)});
const fromProject = p => ({name:p.materialInfo?.name || `${p.design.material} · ${p.gauge.needle || p.design.needle}mm`, material:p.design.material, ...p.gauge, needle:p.gauge.needle || p.design.needle, ...p.materialInfo});
const key = kind => kind === 'profiles' ? 'defaultProfileId' : 'defaultMaterialId';
const refKey = kind => kind === 'profiles' ? 'profilePresetId' : 'materialPresetId';
export const activeRecords = (state, kind) => state.libraries[kind].filter(r => !r.archived);

// Migrate references separately: the original snapshots and measured sleeve context stay untouched.
export function ensureLibraries(state) {
  const normalize = lib => {
    delete state.profile.level;
    for (const r of lib.profiles) delete r.level;
    for (const r of lib.materials) Object.assign(r,resolveGaugeRecord(r));
    return lib;
  };
  // Legacy project/history profiles retain their original shape because measured
  // sleeve contexts hash those snapshots. The retired field is never used by new UI/data.
  if (state.libraries?.version === 1) return normalize(state.libraries);
  const lib = {version:1, profiles:[], materials:[], defaultProfileId:null, defaultMaterialId:null};
  function add(kind, values) {
    const signature = kind === 'profiles' ? profileValues : materialValues;
    let record = lib[kind].find(r => same(signature(r), signature(values)));
    if (!record) { record = {...copy(values), id:id(), archived:false}; lib[kind].push(record); }
    return record.id;
  }
  lib.defaultProfileId = add('profiles', state.profile);
  for (const p of state.projects) {
    p.profilePresetId = add('profiles', p.profile);
    p.materialPresetId = add('materials', fromProject(p));
  }
  const current = state.projects.find(p => p.id === state.currentId) || state.projects[0];
  lib.defaultMaterialId = current.materialPresetId;
  if (state.savedGauge) add('materials', {...fromProject(current), ...state.savedGauge, name:'이전에 저장한 게이지'});
  state.libraries = lib;
  return normalize(lib);
}

export function validateRecord(kind, r) {
  const errors = [];
  if (!String(r.name || '').trim() || r.name.length > 40) errors.push('알아보기 쉬운 이름을 40자 이내로 적어주세요.');
  const ranges = kind === 'profiles'
    ? [['키',r.height,100,220],['가슴둘레',r.chest,50,160],['팔 길이',r.arm,30,80],['어깨너비',r.shoulder,25,65]]
    : [['코 수',r.stitches,5,60],['단 수',r.rows,5,80],['바늘 굵기',r.needle,1,15]];
  for (const [label, value, min, max] of ranges) if (!Number.isFinite(value) || value < min || value > max) errors.push(`${label}는 ${min}–${max} 범위로 입력해주세요.`);
  if (kind === 'materials') {
    if (r.swatchPhoto != null && r.swatchPhoto !== '' && !validSwatchPhoto(r.swatchPhoto)) errors.push('편물 사진 형식이나 용량을 확인해주세요. 사진을 다시 선택해 주세요.');
    if (!String(r.material || '').trim() || r.material.length > 80) errors.push('실의 소재를 80자 이내로 적어주세요.');
    if (!['measured','reference'].includes(r.source)) errors.push('게이지 측정 상태를 골라주세요.');
    const readings = gaugeReadings(r), stage = activeGaugeStage(r);
    if (!GAUGE_STAGES[stage] || !readings[stage]) errors.push('도안 계산에 사용할 게이지를 입력하고 선택해주세요.');
    for (const [name,pair] of Object.entries(readings)) {
      if (!pair) continue;
      if (!GAUGE_STAGES[name] || !Number.isFinite(pair.stitches) || pair.stitches < 5 || pair.stitches > 60 || !Number.isFinite(pair.rows) || pair.rows < 5 || pair.rows > 80) errors.push(`${GAUGE_STAGES[name] || '게이지'}의 코 수(5–60)와 단 수(5–80)를 모두 입력해주세요.`);
    }
    if (readings[stage] && (r.stitches !== readings[stage].stitches || r.rows !== readings[stage].rows)) errors.push('선택한 게이지와 계산값이 맞지 않아요. 다시 저장해주세요.');
  }
  for (const field of ['brand','colorLabel','lot']) if ((r[field] || '').length > 80) errors.push('재료의 상세 정보는 항목별로 80자 이내로 적어주세요.');
  if ((r.note || '').length > 500) errors.push('메모는 500자 이내로 적어주세요.');
  return errors;
}

export function saveRecord(state, kind, values, recordId) {
  values = kind === 'materials' ? resolveGaugeRecord(values) : {...values};
  if (kind === 'materials' && !values.swatchPhoto) delete values.swatchPhoto;
  if (kind === 'profiles') delete values.level;
  const errors = validateRecord(kind, values);
  if (errors.length) throw new Error(errors.join(' '));
  const list = state.libraries[kind];
  const index = recordId ? list.findIndex(r => r.id === recordId) : -1;
  if (recordId && index < 0) throw new Error('저장된 항목을 찾지 못했어요. 보관함을 다시 열어주세요.');
  const record = {...copy(values), name:values.name.trim(), id:recordId || id(), archived:false, updatedAt:new Date().toISOString()};
  if (index < 0) list.push(record); else list[index] = record;
  if (state.libraries[key(kind)] === record.id) setDefault(state, kind, record.id);
  return record;
}

export function setDefault(state, kind, recordId) {
  const r = activeRecords(state, kind).find(r => r.id === recordId);
  if (!r) throw new Error('사용 중인 항목을 골라주세요.');
  state.libraries[key(kind)] = r.id;
  if (kind === 'profiles') state.profile = profileValues(r);
  else state.savedGauge = gaugeValues(r);
}

export function archiveRecord(state, kind, recordId, archived = true) {
  const r = state.libraries[kind].find(r => r.id === recordId);
  if (!r) throw new Error('저장된 항목을 찾지 못했어요.');
  if (archived && !r.archived && activeRecords(state, kind).length <= 1) throw new Error('사용할 항목을 하나 이상 남겨주세요. 새 항목을 등록한 뒤 보관할 수 있어요.');
  r.archived = archived;
  if (archived && state.libraries[key(kind)] === r.id) setDefault(state, kind, activeRecords(state, kind)[0].id);
}

export function matchesProject(p, kind, record) {
  return kind === 'profiles'
    ? same(profileValues(p.profile), profileValues(record))
    : same(materialValues(fromProject(p)), materialValues(record)) && same(materialInfo(fromProject(p)), materialInfo(record));
}

export function prepareSelection(p, kind, record) {
  const errors = validateRecord(kind, record);
  if (record.archived) errors.push('보관한 항목은 꺼낸 뒤 적용해주세요.');
  const next = copy(p);
  const contentChanged = !matchesProject(p, kind, record);
  if (kind === 'profiles') {
    if (!same(profileValues(p.profile), profileValues(record))) next.profile = {...p.profile, ...profileValues(record)};
  } else {
    if (!same(gaugeValues({...p.gauge, needle:p.gauge.needle || p.design.needle}), gaugeValues(record))) next.gauge = {...p.gauge, ...gaugeValues(record)};
    next.design.material = record.material;
    next.design.needle = record.needle;
    next.materialInfo = materialInfo(record);
  }
  next[refKey(kind)] = record.id;
  const conditionsChanged = !same([p.profile,p.gauge,p.design], [next.profile,next.gauge,next.design]);
  if (conditionsChanged) { next.design.sleeveRevision = null; next.pending = null; }
  const before = compileDesign(p), after = compileDesign(next);
  if (!after.valid) errors.push(...after.errors);
  const bodyChanged = before.body?.stitches !== after.body?.stitches || before.body?.rows !== after.body?.rows;
  if (bodyChanged) next.rowsDone = 0;
  return {next, before, after, errors, valid:!errors.length, conditionsChanged, bodyChanged,
    revisionCleared:conditionsChanged && Boolean(p.design.sleeveRevision),
    changed:contentChanged || p[refKey(kind)] !== record.id};
}

export function versionSnapshot(p, name) {
  return {id:id(),name,date:new Date().toISOString(),design:copy(p.design),gauge:copy(p.gauge),profile:copy(p.profile),rowsDone:p.rowsDone,
    profilePresetId:p.profilePresetId,materialPresetId:p.materialPresetId,materialInfo:copy(p.materialInfo)};
}

export function applySelection(p, kind, record) {
  const result = prepareSelection(p, kind, record);
  if (!result.valid) throw new Error(result.errors.join(' '));
  if (!result.changed) return result;
  p.versions.push(versionSnapshot(p, '적용 조건 변경 전'));
  for (const field of ['design','gauge','profile','rowsDone','pending','profilePresetId','materialPresetId','materialInfo']) p[field] = result.next[field];
  p.versions.push(versionSnapshot(p, `${kind === 'profiles' ? '착용자' : '재료·게이지'} · ${record.name} 적용`));
  return result;
}

export function initializeProject(state, p, profileId, materialId) {
  const wearer = activeRecords(state,'profiles').find(r => r.id === profileId);
  const yarn = activeRecords(state,'materials').find(r => r.id === materialId);
  if (!wearer || !yarn) throw new Error('착용자와 재료를 각각 골라주세요.');
  const errors = [...validateRecord('profiles',wearer), ...validateRecord('materials',yarn)];
  const candidate = {...p, profile:profileValues(wearer), gauge:gaugeValues(yarn), design:{...p.design,material:yarn.material,needle:yarn.needle},
    profilePresetId:wearer.id,materialPresetId:yarn.id,materialInfo:materialInfo(yarn)};
  const spec = compileDesign(candidate);
  if (!spec.valid) errors.push(...spec.errors);
  if (errors.length) throw new Error(errors.join(' '));
  Object.assign(p, candidate);
  p.versions = [versionSnapshot(p,'첫 디자인')];
  return p;
}
