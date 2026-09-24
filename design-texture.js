import {compileDesign} from './design-engine.js';
import {activeGaugeStage, GAUGE_STAGES, validSwatchPhoto} from './saved-library.js?v=20260924c';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
const hex = value => {
  if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
  if (/^#[0-9a-f]{3}$/i.test(value || '')) return '#' + [...value.slice(1)].map(char => char + char).join('');
  return '#8d7eaa';
};
const rgb = value => [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));
const colorMix = (from, to, amount) => {
  const a = rgb(from), b = rgb(to);
  return '#' + a.map((part, index) => Math.round(part * (1 - amount) + b[index] * amount).toString(16).padStart(2, '0')).join('');
};
const n = value => Number(value.toFixed(2));

// The SVG shows the input stitch/row density. It is a vector diagram, not a
// rendering of the yarn, a measured rib gauge, or a physical cloth simulation.
export function bodyGaugeSvg(stitches, rows, color, id = 'body') {
  const size = 600, width = size / stitches, height = size / rows;
  const base = hex(color), background = colorMix(base, '#ffffff', .17);
  const dark = colorMix(base, '#251a30', .37), light = colorMix(base, '#ffffff', .38);
  const x = fraction => n(width * fraction), y = fraction => n(height * fraction);
  const loop = 'M ' + x(.18) + ' ' + y(.05) +
    ' C ' + x(.13) + ' ' + y(.43) + ' ' + x(.36) + ' ' + y(.77) + ' ' + x(.5) + ' ' + y(.94) +
    ' C ' + x(.64) + ' ' + y(.77) + ' ' + x(.87) + ' ' + y(.43) + ' ' + x(.82) + ' ' + y(.05);
  const stroke = n(Math.min(width, height) * .2);
  const pattern = 'dt-body-' + id.replace(/[^a-z0-9_-]/gi, '');
  return '<svg class="design-texture-svg" viewBox="0 0 600 600" role="img" aria-label="' +
    esc(stitches + '코 × ' + rows + '단의 몸판 메리야스 구성 도식') + '">' +
    '<defs><pattern id="' + pattern + '" width="' + n(width) + '" height="' + n(height) +
    '" patternUnits="userSpaceOnUse"><path d="' + loop + '" fill="none" stroke="' + dark +
    '" stroke-width="' + n(stroke * 1.3) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="' + loop + '" fill="none" stroke="' + base + '" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="' + loop + '" fill="none" stroke="' + light + '" stroke-opacity=".58" stroke-width="' +
    n(stroke * .2) + '" stroke-linecap="round" stroke-linejoin="round"/></pattern></defs>' +
    '<rect width="600" height="600" fill="' + background + '"/>' +
    '<rect width="600" height="600" fill="url(#' + pattern + ')"/></svg>';
}

export function ribRepeatSvg(color, id = 'rib') {
  const base = hex(color), dark = colorMix(base, '#251a30', .38);
  const light = colorMix(base, '#ffffff', .36), background = colorMix(base, '#ffffff', .18);
  const pattern = 'dt-rib-' + id.replace(/[^a-z0-9_-]/gi, '');
  const knit = column => {
    const left = column * 37.5;
    return '<path d="M ' + n(left + 7) + ' 2 C ' + n(left + 6) + ' 10 ' +
      n(left + 14) + ' 19 ' + n(left + 18.75) + ' 24 C ' + n(left + 23.5) +
      ' 19 ' + n(left + 31.5) + ' 10 ' + n(left + 30.5) +
      ' 2" fill="none" stroke="' + dark + '" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M ' + n(left + 7) + ' 2 C ' + n(left + 6) + ' 10 ' +
      n(left + 14) + ' 19 ' + n(left + 18.75) + ' 24 C ' + n(left + 23.5) +
      ' 19 ' + n(left + 31.5) + ' 10 ' + n(left + 30.5) +
      ' 2" fill="none" stroke="' + light + '" stroke-opacity=".48" stroke-width="2" stroke-linecap="round"/>';
  };
  return '<svg class="design-texture-svg design-texture-svg--rib" viewBox="0 0 600 450" role="img" ' +
    'aria-label="겉뜨기 2코와 안뜨기 2코의 반복 도식">' +
    '<defs><pattern id="' + pattern + '" width="150" height="25" patternUnits="userSpaceOnUse">' +
    '<rect width="150" height="25" fill="' + background + '"/>' +
    '<rect width="75" height="25" fill="' + base + '" opacity=".22"/>' +
    knit(0) + knit(1) +
    '<path d="M 82 14 Q 94 9 105 14 M 119 14 Q 131 9 143 14" fill="none" stroke="' +
    dark + '" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M 83 11 Q 94 7 104 11 M 120 11 Q 131 7 142 11" fill="none" stroke="' +
    light + '" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/></pattern></defs>' +
    '<rect width="600" height="450" fill="url(#' + pattern + ')"/></svg>';
}

export function designTextureMarkup(project, pending = false) {
  const plan = compileDesign(project);
  if (!plan.valid) return '<section class="design-texture" aria-label="설계 연동 조직 도식">' +
    '<div class="design-texture-heading"><strong>설계 연동 조직 도식</strong><span>조건 확인 필요</span></div>' +
    '<p>입력한 설계 조건을 계산할 수 없어 조직 도식을 표시하지 않았어요.</p></section>';

  const design = project.design, gauge = project.gauge;
  const stage = activeGaugeStage({...gauge, ...project.materialInfo});
  const gaugeSource = GAUGE_STAGES[stage] || '게이지';
  const body = bodyGaugeSvg(gauge.stitches, gauge.rows, design.color, plan.id);
  const rib = ribRepeatSvg(design.trim, plan.id);
  const bodyColor = esc(design.colorName || design.color);
  const trimColor = esc(design.trimName || design.trim);
  const material = esc(project.materialInfo?.name || design.material || '소재 미입력');
  const isDraft = pending ? '<span class="design-texture-draft">수정안 · 미적용</span>' : '';
  const swatchPhoto = validSwatchPhoto(project.materialInfo?.swatchPhoto) ? project.materialInfo.swatchPhoto : '';
  const swatchCard = swatchPhoto ? '<button type="button" class="design-texture-sample design-texture-sample--photo" data-tryon="texture-detail" data-area="swatch" aria-label="현재 작품에 적용한 실물 편물 견본 확대"><span class="design-texture-visual"><img class="design-texture-photo" src="' + esc(swatchPhoto) + '" alt="사용자가 올린 실제 편물 견본 사진"></span><span class="design-texture-copy"><strong>내 실물 편물 견본</strong><span>현재 작품에 적용한 재료 사진 · 눌러서 확대</span><small>실의 결·색을 비교하는 참고 사진이며 완성옷의 핏을 예측하지 않아요.</small></span></button>' : '';
  return '<section class="design-texture" aria-label="현재 설계에 연동된 조직 도식" data-design-id="' +
    esc(plan.id) + '">' +
    '<div class="design-texture-heading"><div><span class="design-texture-kicker">PATTERN LINK</span>' +
    '<strong>설계 연동 조직 도식</strong></div>' + isDraft + '</div>' +
    '<p class="design-texture-intro">도안과 같은 색·게이지·반복 규칙을 사용한 벡터 도식입니다. 실제 편물이나 AI 착용 사진은 아닙니다.</p>' +
    '<div class="design-texture-grid">' +
    '<div class="design-texture-sample"><div class="design-texture-visual">' + body + '</div>' +
    '<div class="design-texture-copy"><strong>몸판 · 메리야스</strong><span>' + bodyColor +
    ' · 10cm당 ' + esc(gauge.stitches) + '코 × ' + esc(gauge.rows) + '단</span>' +
    '<small>계산 몸판 ' + esc(plan.body.stitches) + '코 × ' + esc(plan.body.rows) + '단</small></div></div>' +
    '<div class="design-texture-sample"><div class="design-texture-visual">' + rib + '</div>' +
    '<div class="design-texture-copy"><strong>소맷단 · 2×2 고무뜨기</strong><span>' + trimColor +
    ' · 겉뜨기 2코 / 안뜨기 2코</span><small>소매 ' + esc(plan.sleeve.startStitches) +
    '코 → 소맷단 ' + esc(plan.sleeve.cuffStitches) + '코 · ' +
    esc(plan.sleeve.cuffRows) + '단</small></div></div>' + swatchCard + '</div>' +
    '<div class="design-texture-meta"><span>동일 설계 <strong>' + esc(plan.id) + '</strong></span>' +
    '<span>' + esc(gaugeSource) + ' · ' + material + '</span></div>' +
    '<p class="design-texture-limit">고무단의 실제 게이지, 실 결·광택·보풀, 세탁 후 변화와 착용 시 늘어짐은 표현하지 않아요. 실제 질감은 같은 실로 뜬 스와치와 비교해 주세요.</p>' +
    '</section>';
}
