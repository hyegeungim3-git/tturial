import {compileDesign} from './design-engine.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
const safeHex = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : fallback;
const round = value => Math.round(value * 10) / 10;
const point = (x, y) => round(x) + ' ' + round(y);
const fmt = value => Number(value).toLocaleString('ko-KR', {maximumFractionDigits: 2});

function sleeveGeometry(plan, bodyHalf, shoulderY) {
  const startX = 490 + bodyHalf + 1;
  const startY = shoulderY + 30;
  const dx = plan.sleeve.actualCm * 3.15 + 15;
  const dy = plan.sleeve.actualCm * 4.45;
  const magnitude = Math.hypot(dx, dy);
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const px = -uy;
  const py = ux;
  const upperRadius = plan.sleeve.actualUpperArmCm * 1.2;
  const cuffRadius = plan.sleeve.actualCuffCm * 1.2;
  const endX = startX + dx;
  const endY = startY + dy;
  const cX = endX - ux * Math.min(42, plan.sleeve.actualCuffLengthCm * 6);
  const cY = endY - uy * Math.min(42, plan.sleeve.actualCuffLengthCm * 6);
  const outerStart = [startX - px * upperRadius, startY - py * upperRadius];
  const innerStart = [startX + px * upperRadius, startY + py * upperRadius];
  const outerEnd = [endX - px * cuffRadius, endY - py * cuffRadius];
  const innerEnd = [endX + px * cuffRadius, endY + py * cuffRadius];
  const outerCuff = [cX - px * cuffRadius * 1.09, cY - py * cuffRadius * 1.09];
  const innerCuff = [cX + px * cuffRadius * 1.09, cY + py * cuffRadius * 1.09];
  const main = 'M' + point(...outerStart) +
    ' Q' + point(startX + dx * .58 - px * upperRadius * .8, startY + dy * .58 - py * upperRadius * .8) +
    ' ' + point(...outerEnd) + ' L' + point(...innerEnd) +
    ' Q' + point(startX + dx * .55 + px * upperRadius * .78, startY + dy * .55 + py * upperRadius * .78) +
    ' ' + point(...innerStart) + ' Z';
  const cuff = 'M' + point(...outerCuff) + ' L' + point(...outerEnd) +
    ' L' + point(...innerEnd) + ' L' + point(...innerCuff) + ' Z';
  return {main, cuff};
}

/**
 * A deterministic design illustration. It shares the compiled design with the
 * written instructions; the fixed AI photos remain separate references.
 */
export function designSchematicMarkup(project, pending = false) {
  const plan = compileDesign(project);
  if (!plan.valid || !plan.body || !plan.sleeve) {
    return '<section class="design-schematic design-schematic--invalid" role="status">' +
      '<strong>설계 예상도를 표시할 수 없어요.</strong><p>' +
      esc((plan.errors || ['설계 조건을 다시 확인해 주세요.']).join(' ')) +
      '</p></section>';
  }

  const design = project.design || {};
  const bodyColor = safeHex(design.color, '#aaa2d6');
  const trimColor = safeHex(design.trim, '#b86532');
  const token = plan.id.replace(/[^A-Za-z0-9_-]/g, '');
  const bodyHalf = Math.max(83, Math.min(215, plan.body.actualChestCm * 1.18));
  const shoulderHalf = Math.min(bodyHalf + 24, 235);
  const shoulderY = 158;
  const underarmY = shoulderY + Math.max(104, Math.min(165, plan.body.actualLengthCm * 2));
  const hemY = shoulderY + plan.body.actualLengthCm * 6;
  const bodyPath = 'M' + point(490 - shoulderHalf, shoulderY) +
    ' L' + point(490 - 50, shoulderY - 6) +
    ' Q' + point(490 - 35, shoulderY + 44) + ' ' + point(490, shoulderY + 47) +
    ' Q' + point(490 + 35, shoulderY + 44) + ' ' + point(490 + 50, shoulderY - 6) +
    ' L' + point(490 + shoulderHalf, shoulderY) +
    ' L' + point(490 + bodyHalf, underarmY) +
    ' L' + point(490 + bodyHalf * .96, hemY) +
    ' Q' + point(490, hemY + 7) + ' ' + point(490 - bodyHalf * .96, hemY) +
    ' L' + point(490 - bodyHalf, underarmY) + ' Z';
  const hemPath = 'M' + point(490 - bodyHalf * .963, hemY - 29) +
    ' L' + point(490 + bodyHalf * .963, hemY - 29) +
    ' L' + point(490 + bodyHalf * .96, hemY) +
    ' Q' + point(490, hemY + 7) + ' ' + point(490 - bodyHalf * .96, hemY) + ' Z';
  const sleeve = sleeveGeometry(plan, bodyHalf, shoulderY);
  const titleId = 'schematic-title-' + token;
  const descId = 'schematic-description-' + token;
  const knitId = 'schematic-knit-' + token;
  const ribId = 'schematic-rib-' + token;
  const glowId = 'schematic-light-' + token;
  const status = pending ? '수정안 · 적용 전' : '현재 적용한 설계';

  const svg = [
    '<svg class="design-schematic-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 760" role="img" aria-labelledby="' + titleId + ' ' + descId + '">',
    '<title id="' + titleId + '">', esc(status), '의 정면 스웨터 설계 예상도</title>',
    '<desc id="' + descId + '">설계 ', esc(plan.id), '. 완성 가슴둘레 ', fmt(plan.body.actualChestCm),
    '센티미터, 총장 ', fmt(plan.body.actualLengthCm), '센티미터, 소매 ',
    fmt(plan.sleeve.actualCm), '센티미터. 몸판과 소매의 색상, 길이, 너비를 수치에 맞춰 도식적으로 표현합니다. 실제 착용감은 예측하지 않습니다.</desc>',
    '<defs>',
    '<linearGradient id="' + glowId + '" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".23"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#271b29" stop-opacity=".16"/></linearGradient>',
    '<pattern id="' + knitId + '" width="15" height="18" patternUnits="userSpaceOnUse">',
    '<path d="M1 0 C2 4 5 6 7.5 12 C10 6 13 4 14 0 M-6 9 C-5 13 -2 15 .5 21 M14.5 9 C17 15 20 16 21 21" fill="none" stroke="#ffffff" stroke-opacity=".40" stroke-width="1.45" stroke-linecap="round"/>',
    '<path d="M1 1 C2.5 6 5 8 7.5 13 C10 8 12.5 6 14 1" fill="none" stroke="#34283d" stroke-opacity=".18" stroke-width=".7"/></pattern>',
    '<pattern id="' + ribId + '" width="11" height="18" patternUnits="userSpaceOnUse"><path d="M2 0V18 M8 0V18" stroke="#ffffff" stroke-opacity=".33" stroke-width="2"/><path d="M5 0V18" stroke="#34283d" stroke-opacity=".18" stroke-width="1.5"/></pattern>',
    '</defs>',
    '<rect x="0" y="0" width="980" height="760" rx="28" fill="#f7f4f7"/>',
    '<circle cx="490" cy="355" r="315" fill="#ffffff" opacity=".35"/>',
    '<path d="' + sleeve.main + '" fill="' + bodyColor + '" stroke="#514657" stroke-opacity=".3" stroke-width="2"/>',
    '<path d="' + sleeve.main + '" fill="url(#' + knitId + ')" opacity=".57"/>',
    '<path d="' + sleeve.main + '" fill="url(#' + glowId + ')"/>',
    '<path d="' + sleeve.cuff + '" fill="' + trimColor + '" stroke="#514657" stroke-opacity=".3" stroke-width="2"/>',
    '<path d="' + sleeve.cuff + '" fill="url(#' + ribId + ')" opacity=".65"/>',
    '<g transform="translate(980 0) scale(-1 1)">',
    '<path d="' + sleeve.main + '" fill="' + bodyColor + '" stroke="#514657" stroke-opacity=".3" stroke-width="2"/>',
    '<path d="' + sleeve.main + '" fill="url(#' + knitId + ')" opacity=".57"/>',
    '<path d="' + sleeve.main + '" fill="url(#' + glowId + ')"/>',
    '<path d="' + sleeve.cuff + '" fill="' + trimColor + '" stroke="#514657" stroke-opacity=".3" stroke-width="2"/>',
    '<path d="' + sleeve.cuff + '" fill="url(#' + ribId + ')" opacity=".65"/>',
    '</g>',
    '<path d="' + bodyPath + '" fill="' + bodyColor + '" stroke="#514657" stroke-opacity=".3" stroke-width="2.5"/>',
    '<path d="' + bodyPath + '" fill="url(#' + knitId + ')" opacity=".57"/>',
    '<path d="' + bodyPath + '" fill="url(#' + glowId + ')"/>',
    '<path d="' + hemPath + '" fill="' + trimColor + '" stroke="#514657" stroke-opacity=".25" stroke-width="1.5"/>',
    '<path d="' + hemPath + '" fill="url(#' + ribId + ')" opacity=".7"/>',
    '<path d="M' + point(490 - 50, shoulderY - 6) + ' Q' + point(490 - 35, shoulderY + 44) + ' ' + point(490, shoulderY + 47) +
    ' Q' + point(490 + 35, shoulderY + 44) + ' ' + point(490 + 50, shoulderY - 6) + '" fill="none" stroke="' + trimColor + '" stroke-width="15" stroke-linecap="round"/>',
    '<path d="M' + point(490 - 50, shoulderY - 6) + ' Q' + point(490 - 35, shoulderY + 44) + ' ' + point(490, shoulderY + 47) +
    ' Q' + point(490 + 35, shoulderY + 44) + ' ' + point(490 + 50, shoulderY - 6) + '" fill="none" stroke="#ffffff" stroke-opacity=".36" stroke-width="2"/>',
    '<path d="M' + point(490 - 55, shoulderY + 8) + ' Q' + point(490 - bodyHalf * .62, underarmY - 22) + ' ' + point(490 - bodyHalf, underarmY) +
    ' M' + point(490 + 55, shoulderY + 8) + ' Q' + point(490 + bodyHalf * .62, underarmY - 22) + ' ' + point(490 + bodyHalf, underarmY) +
    '" fill="none" stroke="#ffffff" stroke-opacity=".48" stroke-width="2" stroke-dasharray="5 6"/>',
    '<text x="490" y="706" text-anchor="middle" font-size="19" font-family="sans-serif" fill="#524c59">정면 설계 예상도 · 요크와 착용감은 도식적 표현</text>',
    '</svg>'
  ].join('');

  return [
    '<section class="design-schematic" data-design-id="' + esc(plan.id) + '" aria-label="도안 연동 2D 설계 예상도">',
    '<div class="design-schematic-head"><div><span class="design-schematic-kicker">PATTERN-LINKED 2D</span><strong>도안과 같은 설계의 정면 예상도</strong></div><span class="design-schematic-status">' + esc(status) + '</span></div>',
    svg + '<p class="design-schematic-caption">가슴둘레·총장·소매 치수와 배색을 반영한 도식입니다. 요크 구조와 원단 처짐, 실제 핏은 검증된 착용 결과가 아닙니다.</p>',
    '<dl class="design-schematic-metrics">',
    '<div><dt>설계 번호</dt><dd>' + esc(plan.id) + '</dd></div>',
    '<div><dt>완성 가슴둘레</dt><dd>' + fmt(plan.body.actualChestCm) + 'cm · 몸판 ' + fmt(plan.body.stitches) + '코</dd></div>',
    '<div><dt>계산 총장</dt><dd>' + fmt(plan.body.actualLengthCm) + 'cm</dd></div>',
    '<div><dt>계산 소매</dt><dd>' + fmt(plan.sleeve.actualCm) + 'cm · ' + fmt(plan.sleeve.startStitches) + '→' + fmt(plan.sleeve.cuffStitches) + '코</dd></div>',
    '<div><dt>10cm 게이지</dt><dd>' + fmt(project.gauge.stitches) + '코 × ' + fmt(project.gauge.rows) + '단</dd></div>',
    '<div><dt>배색</dt><dd><span class="design-schematic-swatch" style="background-color:' + bodyColor + '"></span>' +
    esc(design.colorName || '몸판') + ' <span class="design-schematic-swatch" style="background-color:' + trimColor + '"></span>' +
    esc(design.trimName || '시보리') + '</dd></div>',
    '</dl>',
    '</section>'
  ].join('');
}
