const angles = ['정면', '오른쪽 앞', '오른쪽 옆', '오른쪽 뒤', '뒷면', '왼쪽 뒤', '왼쪽 옆', '왼쪽 앞'];
const sources = { base: 'assets/tryon-base.png', long: 'assets/tryon-long.png' };
const hdSources = Object.fromEntries(['base','long'].map(variant => [variant, Array.from({length:8},(_,frame) => frame === 0
  ? `assets/tryon-front-${variant}-hd.png`
  : `assets/tryon-${variant}-${String(frame*45).padStart(3,'0')}-hd.png`)]));
// Enable only after both front 4K images pass visual QA and are published with this script.
const ENABLE_FRONT_4K = false;
const front4kSources = {base:'assets/tryon-front-base-4k.png',long:'assets/tryon-front-long-4k.png'};
const toolPaths = { texture:'M3 4h18v16H3zM3 10h18M9 4v16M15 4v16', plus:'M12 5v14M5 12h14', minus:'M5 12h14', expand:'M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4', collapse:'M4 8h4V4m8 0v4h4M8 20v-4H4m12 4v-4h4', download:'M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4' };
const toolIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${toolPaths[name]}"/></svg>`;
const cached = new Map();
const MAX_CANVAS_PIXELS = 16_000_000;
const MAX_CANVAS_EDGE = 8192;
function canvasScale(width, height) {
  const density = Math.max(1, window.devicePixelRatio || 1);
  return Math.min(density, MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
}
function loadImage(src, keepCached = true) {
  if (keepCached && cached.has(src)) return cached.get(src);
  const request = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { if (keepCached) cached.delete(src); reject(new Error('착용 이미지를 불러오지 못했어요.')); };
    img.src = src;
  });
  if (keepCached) cached.set(src, request);
  return request;
}
export function supportsTryOn(design) {
  const k=design.knit||{};
  return !design.sleeveRevision && (k.upperArmCm??36)===36 && (k.cuffCm??20)===20 && (k.cuffLengthCm??5)===5 && [48, 52].includes(design.sleeve) && design.length === 56 && design.ease === 12 && design.color === '#aaa2d6' && design.trim === '#b86532';
}
export function tryOnMarkup(p, pending) {
  const compatible = supportsTryOn(p.design);
  return `<div class="tryon-viewer" id="tryon-viewer">
    <div class="tryon-intro"><div><span class="tryon-eyebrow">VIRTUAL FITTING STUDIO</span><h3>한 바퀴, 나의 작품을 만나다</h3></div><span class="tryon-ai">AI 착용 이미지</span></div>
    <div class="tryon-options" role="group" aria-label="착용안 선택">
      <button data-tryon="base" aria-pressed="false">기본 소매</button><button data-tryon="long" aria-pressed="false">손등 덮는 소매</button><button data-tryon="compare" aria-pressed="false">나란히 비교</button>
    </div>
    <div class="tryon-viewport" tabindex="0" role="group" aria-label="360도 착용 보기. 좌우로 드래그해 회전하고, 확대 후 드래그해 이동하세요. 휠이나 두 손가락으로 확대할 수 있어요.">
      <canvas class="tryon-canvas" role="img" aria-label="실사형 모델의 스웨터 착용 이미지"></canvas>
      <div class="tryon-loading" role="status">착용 이미지를 불러오는 중이에요…</div>
      <div class="tryon-stage-top"><span class="tryon-look-label"></span><div class="tryon-stage-tools"><button class="tryon-zoom" data-tryon="zoom-out" aria-label="착용 이미지 축소" title="축소">${toolIcon('minus')}</button><output class="tryon-zoom-level" aria-live="polite">100%</output><button class="tryon-zoom" data-tryon="zoom-in" aria-label="착용 이미지 확대" title="확대">${toolIcon('plus')}</button><button class="tryon-texture-toggle" data-tryon="texture" aria-expanded="false" aria-controls="tryon-texture-panel" title="소재 조직 참고 보기">조직 보기</button><button class="tryon-zoom" data-tryon="fullscreen" aria-label="착용 보기 크게 열기" title="크게 보기">${toolIcon('expand')}</button><button class="tryon-zoom" data-tryon="save" aria-label="현재 착용 이미지 저장" title="이미지 저장">${toolIcon('download')}</button></div></div>
      <div class="tryon-compare-labels" hidden><span>기본 소매</span><span>손등 덮는 소매</span></div>
      <span class="tryon-hd-badge" hidden>정면 고화질 참고 컷</span>
      <span class="tryon-drag-hint">↔ 드래그해서 돌려보세요 · 휠/두 손가락으로 확대</span>
    </div>
    <section class="tryon-texture-panel" id="tryon-texture-panel" hidden aria-label="뜨개 조직 참고 이미지">
      <div class="tryon-texture-head"><div><strong>뜨개 조직 보기</strong><p>실제 뜨개 완성품과 현재 가상 디자인의 단품 이미지를 각각 확대해 볼 수 있어요. 서로 다른 옷이에요.</p></div><button type="button" data-tryon="texture-close" aria-label="뜨개 조직 참고 닫기">닫기</button></div>
      <div class="tryon-real-knit"><button type="button" class="tryon-real-knit-card" data-tryon="texture-detail" data-area="real" aria-label="실제 뜨개 완성품 착용 사진 원본 확대"><img src="assets/knitted-sweater-kyle-cassidy-preview.jpg" alt="실제 아이슬란드 니트 스웨터를 입은 사람" loading="lazy" decoding="async"><span><strong>실제 뜨개 완성품 예시</strong><small>착용 사진 · 원본 3984 × 5976px<br>눌러서 원본 질감 확대</small></span></button><p>위 가상 착용 디자인과 별개의 실제 스웨터입니다.</p><p class="tryon-real-knit-credit">사진: Kyle Cassidy · <a href="https://commons.wikimedia.org/wiki/File:Knitted_Sweater.jpg" target="_blank" rel="noopener noreferrer">원본 · Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a><br>원본은 편집하지 않았으며 미리보기만 축소·일부 표시했습니다.</p><button type="button" class="tryon-real-knit-card tryon-real-knit-card--macro" data-tryon="texture-detail" data-area="real-close" aria-label="실제 손뜨개 스웨터 조직 사진 원본 확대"><img src="assets/blue-gray-hand-knit-texture-preview.jpg" alt="실제 손뜨개 스웨터의 회청색 실과 뜨개 코를 가까이 찍은 사진" loading="lazy" decoding="async"><span><strong>실제 손뜨개 조직 확대</strong><small>스웨터 근접 사진 · 원본 3000 × 2000px<br>실과 코 모양 자세히 보기</small></span></button><p>위 착용 사진과도 별개의 손뜨개 스웨터입니다.</p><p class="tryon-real-knit-credit">사진: Photos Public Domain · <a href="https://commons.wikimedia.org/wiki/File:Blue_Gray_knit_texture.jpg" target="_blank" rel="noopener noreferrer">원본 · Wikimedia Commons</a> · 퍼블릭 도메인<br>원본은 편집하지 않았으며 미리보기만 축소·일부 표시했습니다.</p></div>
      <div class="tryon-ai-knit"><strong>현재 가상 디자인의 단품 참고</strong><p>아래 이미지는 AI로 만든 스웨터예요. 실제 완성품 사진과 별개입니다.</p><div class="tryon-texture-samples"><button type="button" class="tryon-texture-card" data-tryon="texture-detail" data-area="body"><span class="tryon-texture-crop tryon-texture-body" aria-hidden="true"></span><span>몸판 조직 자세히 보기</span></button><button type="button" class="tryon-texture-card" data-tryon="texture-detail" data-area="cuff"><span class="tryon-texture-crop tryon-texture-cuff" aria-hidden="true"></span><span>소매 끝 시보리 자세히 보기</span></button></div></div>
    </section>
    <dialog class="tryon-texture-dialog" aria-labelledby="tryon-texture-detail-title" aria-describedby="tryon-texture-detail-note">
      <div class="tryon-texture-detail-head"><div><strong id="tryon-texture-detail-title">몸판 조직</strong><p id="tryon-texture-detail-note">착용 사진과 별개의 AI 제작 스웨터 단품 참고 이미지예요.</p></div><button type="button" class="tryon-texture-detail-close" data-tryon="texture-detail-close" aria-label="소재 조직 확대 닫기">닫기</button></div>
      <div class="tryon-texture-detail-viewport" tabindex="0" role="region" aria-label="뜨개 조직 사진. 방향키로 이동하고 더하기와 빼기로 확대할 수 있습니다."><img class="tryon-texture-detail-image" src="assets/sweater.png" alt="연보라색 스웨터 몸판과 주황색 시보리의 뜨개 조직" draggable="false"><span class="tryon-texture-detail-loading" role="status" hidden></span></div>
      <div class="tryon-texture-detail-tools"><span>드래그해서 이동 · 휠·두 손가락으로 확대</span><div><button type="button" data-tryon="texture-detail-zoom-out" aria-label="소재 조직 축소">−</button><output class="tryon-texture-detail-zoom" aria-live="polite">100%</output><button type="button" data-tryon="texture-detail-zoom-in" aria-label="소재 조직 확대">＋</button><button type="button" data-tryon="texture-detail-reset">원래 보기</button></div></div>
      <p class="tryon-texture-detail-credit" data-credit="real" hidden>실제 뜨개 완성품 사진: Kyle Cassidy · <a href="https://commons.wikimedia.org/wiki/File:Knitted_Sweater.jpg" target="_blank" rel="noopener noreferrer">Wikimedia Commons 원본</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. 원본 사진은 편집하지 않았습니다.</p>
      <p class="tryon-texture-detail-credit" data-credit="real-close" hidden>실제 손뜨개 스웨터 조직 사진: Photos Public Domain · <a href="https://commons.wikimedia.org/wiki/File:Blue_Gray_knit_texture.jpg" target="_blank" rel="noopener noreferrer">Wikimedia Commons 원본</a> · 퍼블릭 도메인. 원본 사진은 편집하지 않았습니다.</p>
    </dialog>
    <div class="tryon-rotation"><button data-tryon="prev" aria-label="이전 각도">‹</button><button data-tryon="play" aria-label="자동 회전 시작" aria-pressed="false">▷</button><input type="range" min="0" max="7" step="1" value="0" aria-label="착용 이미지 회전 각도"><output class="tryon-angle" aria-live="polite">정면 · 0°</output><button data-tryon="next" aria-label="다음 각도">›</button></div>
    <div class="tryon-directions" role="group" aria-label="방향 바로 보기">${[[0,'앞'],[2,'오른쪽'],[4,'뒤'],[6,'왼쪽']].map(([n,label])=>`<button data-tryon="angle" data-angle="${n}" aria-pressed="${n===0}">${label}</button>`).join('')}<button data-tryon="reset">보기 초기화</button></div>
    <div class="tryon-selection"><div><span class="tryon-state">${pending ? '수정안 · 아직 적용 전' : compatible ? '현재 디자인' : '기본 디자인 참고 이미지'}</span><strong class="tryon-selection-title"></strong><p class="tryon-selection-description"></p></div><button class="button primary small" data-tryon="propose">이 소매로 수정안 만들기</button></div>
    ${compatible ? '' : '<div class="tryon-mismatch">현재 변경한 설계는 이 착용 이미지에 반영되지 않아요. <button data-action="preview-3d">도안 연동 360°에서 확인 →</button></div>'}
    <div class="tryon-disclosure"><span>기본 모델 참고 이미지 · 아래 계산값은 도안 연동 360°에 반영</span><button class="quiet-link" data-action="tryon-guide">착용 안내</button></div>
  </div>`;
}

export function createTryOn(root, options) {
  const { ui, sleeve, pending, onPropose } = options;
  const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
  const viewport = root.querySelector('.tryon-viewport');
  const abort = new AbortController(), signal = abort.signal;
  let images, hdFrames = {base: Array(8), long: Array(8)}, front4kFrames = {base:null,long:null}, disposed = false, timer = null, drag = null, raf = null;
  const hdRequested = new Set();
  const front4kRequested = new Set(), front4kLoading = new Map();
  const detailOrder = [];
  const MAX_DETAIL_FRAMES = 6;
  function touchDetail(variant, frame) {
    const key = `${variant}-${frame}`;
    const previous = detailOrder.indexOf(key);
    if (previous !== -1) detailOrder.splice(previous, 1);
    detailOrder.push(key);
    while (detailOrder.length > MAX_DETAIL_FRAMES) {
      const active = new Set((ui.variant === 'compare' ? ['base','long'] : [ui.variant]).map(current => `${current}-${ui.frame}`));
      const staleIndex = detailOrder.findIndex(entry => !active.has(entry));
      if (staleIndex === -1) break;
      const [stale] = detailOrder.splice(staleIndex, 1);
      const [oldVariant, oldFrame] = stale.split('-');
      hdFrames[oldVariant][Number(oldFrame)] = undefined;
      hdRequested.delete(stale);
    }
  }
  const listen = (el, name, fn, options={}) => el.addEventListener(name, fn, {signal,...options});
  ui.frame = ((ui.frame || 0) % 8 + 8) % 8;
  ui.variant ||= sleeve === 52 ? 'long' : 'base';
  ui.panX = Number(ui.panX) || 0;
  ui.panY = Number(ui.panY) || 0;
  const zoomStops = [1, 1.5, 2, 3, 4];
  const zoomFactor = () => Math.max(1, Math.min(4, ui.zoom === true ? 1.85 : Number(ui.zoom) || 1));
  const useFront4k = () => ENABLE_FRONT_4K && ui.frame === 0 && zoomFactor() >= 2;
  const activeDetail = variant => (useFront4k() && front4kFrames[variant]) || hdFrames[variant]?.[ui.frame];
  function viewBounds() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    const viewWidth = ui.variant === 'compare' ? width / 2 : width;
    const variants = ui.variant === 'compare' ? ['base','long'] : [ui.variant];
    const limits = variants.map(variant => {
      const detail = activeDetail(variant);
      const img = detail || images?.[variant];
      const frameWidth = img ? img.naturalWidth / (detail ? 1 : 4) : 384;
      const frameHeight = img ? img.naturalHeight / (detail ? 1 : 2) : 512;
      const fit = Math.min(viewWidth / frameWidth, height / frameHeight);
      return {x:Math.max(0,(frameWidth*fit*zoomFactor()-viewWidth)/2),y:Math.max(0,(frameHeight*fit*zoomFactor()-height)/2)};
    });
    return {width,height,viewWidth,limitX:Math.min(...limits.map(limit => limit.x)),limitY:Math.min(...limits.map(limit => limit.y))};
  }
  function clampPan() {
    const {limitX,limitY} = viewBounds();
    ui.panX = Math.max(-limitX,Math.min(limitX,ui.panX));
    ui.panY = Math.max(-limitY,Math.min(limitY,ui.panY));
  }
  function zoomTo(value, anchorX=viewport.clientWidth/2, anchorY=viewport.clientHeight/2) {
    const previous=zoomFactor(), next=Math.max(1,Math.min(4,value));
    if(Math.abs(next-previous)<.001)return;
    const {width,height,viewWidth}=viewBounds();
    const centerX=ui.variant==='compare' ? (anchorX<width/2 ? viewWidth/2 : width-viewWidth/2) : width/2;
    const centerY=height/2, ratio=next/previous;
    ui.panX=(anchorX-centerX)-(anchorX-centerX-ui.panX)*ratio;
    ui.panY=(anchorY-centerY)-(anchorY-centerY-ui.panY)*ratio;
    ui.zoom=next===1?false:next;
    clampPan();
    renderControls();
  }
  function stepZoom(direction) {
    const current=zoomFactor();
    const next=direction>0?zoomStops.find(stop=>stop>current+.01):[...zoomStops].reverse().find(stop=>stop<current-.01);
    zoomTo(next ?? (direction>0?4:1));
  }
  function localPoint(clientX,clientY) {
    const rect=viewport.getBoundingClientRect();
    return {x:clientX-rect.left,y:clientY-rect.top};
  }
  function drawView(img, x, y, w, h, detail=false) {
    const cw = detail ? img.naturalWidth : img.naturalWidth / 4;
    const ch = detail ? img.naturalHeight : img.naturalHeight / 2;
    const column = ui.frame % 4, row = Math.floor(ui.frame / 4);
    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    const scale = Math.min(w / cw, h / ch) * zoomFactor();
    const dw = cw * scale, dh = ch * scale;
    const dx = x + (w-dw)/2 + ui.panX;
    const dy = y + (h-dh)/2 + ui.panY;
    ctx.drawImage(img, detail ? 0 : column*cw, detail ? 0 : row*ch, cw, ch, dx, dy, dw, dh);
    ctx.restore();
  }
  function requestFrameHd() {
    const frame = ui.frame;
    const variants = ui.variant === 'compare' ? ['base','long'] : [ui.variant];
    for (const variant of variants) {
      const key = `${variant}-${frame}`;
      if (hdFrames[variant][frame]) {
        touchDetail(variant, frame);
        continue;
      }
      if (hdRequested.has(key)) continue;
      hdRequested.add(key);
      loadImage(hdSources[variant][frame], false).then(img => {
        if (disposed) return;
        hdFrames[variant][frame] = img;
        touchDetail(variant, frame);
        draw();
      }).catch(() => {}); // Keep the atlas frame visible if the individual HD image is unavailable.
    }
  }
  function requestFront4k() {
    if (!useFront4k()) return;
    const variants = ui.variant === 'compare' ? ['base','long'] : [ui.variant];
    for (const variant of variants) {
      if (front4kFrames[variant] || front4kRequested.has(variant)) continue;
      front4kRequested.add(variant);
      const pending = loadImage(front4kSources[variant], false);
      front4kLoading.set(variant, pending);
      pending.then(img => {
        if (disposed || front4kLoading.get(variant) !== pending) return;
        front4kLoading.delete(variant);
        front4kFrames[variant] = img;
        if (useFront4k() && (ui.variant === variant || ui.variant === 'compare')) draw();
      }).catch(() => {
        if (front4kLoading.get(variant) === pending) front4kLoading.delete(variant);
        // Keep the HD front image and do not repeatedly request an unavailable 4K file.
      });
    }
  }
  function draw() {
    if (disposed || !images) return;
    requestFrameHd();
    requestFront4k();
    const {width:w,height:h} = viewport.getBoundingClientRect();
    if (!w || !h) return;
    const dpr = canvasScale(w, h);
    clampPan();
    const pixelWidth=Math.round(w*dpr), pixelHeight=Math.round(h*dpr);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.fillStyle = '#f1f0ee'; ctx.fillRect(0,0,w,h);
    const baseHd = activeDetail('base'), longHd = activeDetail('long');
    if (ui.variant === 'compare') {
      drawView(baseHd || images.base,0,0,w/2,h,Boolean(baseHd));
      drawView(longHd || images.long,w/2,0,w/2,h,Boolean(longHd));
      ctx.fillStyle='#d8d4d0'; ctx.fillRect(Math.floor(w/2),22,1,h-44);
    } else {
      const hd = activeDetail(ui.variant);
      drawView(hd || images[ui.variant],0,0,w,h,Boolean(hd));
    }
    const hasHd = ui.variant === 'compare' ? Boolean(baseHd && longHd) : Boolean(activeDetail(ui.variant));
    const badge = root.querySelector('.tryon-hd-badge');
    badge.hidden = !hasHd;
    if (hasHd && useFront4k() && (ui.variant === 'compare' ? Boolean(front4kFrames.base && front4kFrames.long) : Boolean(front4kFrames[ui.variant]))) badge.textContent = '정면 4K 참고 컷';
    else if (hasHd) badge.textContent = `${angles[ui.frame]} 고화질 참고 컷`;
    canvas.setAttribute('aria-label',`${ui.variant==='compare'?'기본 소매와 긴 소매 비교':ui.variant==='long'?'손등 덮는 소매':'기본 소매'}, ${angles[ui.frame]}, ${ui.frame*45}도${zoomFactor()>1?', '+Math.round(zoomFactor()*100)+'% 확대':''}`);
  }
  function renderControls() {
    root.querySelectorAll('[data-tryon="base"],[data-tryon="long"],[data-tryon="compare"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tryon===ui.variant)));
    root.querySelectorAll('[data-tryon="angle"]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.angle)===ui.frame)));
    root.querySelector('input[type="range"]').value=ui.frame;
    root.querySelector('input[type="range"]').setAttribute('aria-valuetext',`${angles[ui.frame]} ${ui.frame*45}도`);
    root.querySelector('.tryon-angle').textContent=`${angles[ui.frame]} · ${ui.frame*45}°`;
    root.querySelector('.tryon-compare-labels').hidden=ui.variant!=='compare';
    root.querySelector('.tryon-look-label').textContent=ui.variant==='compare'?'같은 각도에서 비교':ui.variant==='long'?'LOOK 02 · 손등 덮는 소매':'LOOK 01 · 기본 소매';
    root.querySelector('.tryon-selection-title').textContent=ui.variant==='compare'?'손목에서 손등까지, 차이를 확인해요':ui.variant==='long'?'손등을 포근하게 덮는 소매':'손목에 가볍게 닿는 소매';
    root.querySelector('.tryon-selection-description').textContent=ui.variant==='compare'?'소매 디자인 48cm / 52cm · 같은 각도로 비교':ui.variant==='base'?'디자인 설정 48cm · 기본 소매':'디자인 설정 52cm · 여유 있는 긴 소매';
    const target=ui.variant==='base'?48:52, propose=root.querySelector('[data-tryon="propose"]');
    propose.disabled=target===sleeve;
    propose.textContent=target===sleeve?(pending?'확인 중인 수정안':'현재 적용한 소매'):'이 소매로 수정안 만들기';
    const zoom=zoomFactor();
    root.querySelector('.tryon-zoom-level').textContent=Math.round(zoom*100)+'%';
    root.querySelector('[data-tryon="zoom-out"]').disabled=zoom<=1;
    root.querySelector('[data-tryon="zoom-in"]').disabled=zoom>=4;
    root.querySelector('.tryon-drag-hint').textContent=zoom>1?'드래그해 이동 · 휠/두 손가락으로 확대':'↔ 드래그해서 돌려보세요 · 휠/두 손가락으로 확대';
    viewport.classList.toggle('is-zoomed',zoom>1);
    draw();
  }
  function stop() { clearInterval(timer); timer=null; const b=root.querySelector('[data-tryon="play"]'); b.textContent='▷'; b.setAttribute('aria-pressed','false'); b.setAttribute('aria-label','자동 회전 시작'); }
  function setFrame(n) { ui.frame=(n%8+8)%8; renderControls(); }
  function play() { if(timer){stop();return;} timer=setInterval(()=>setFrame(ui.frame+1),850); const b=root.querySelector('[data-tryon="play"]'); b.textContent='Ⅱ'; b.setAttribute('aria-pressed','true'); b.setAttribute('aria-label','자동 회전 멈춤'); }
  function reset() { stop(); ui.zoom=false; ui.panX=0; ui.panY=0; setFrame(0); }
  function saveImage(name='뜨리얼-착용예시.png') {if(!images)return;canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
  function updateFullscreenButton() {const expanded=document.fullscreenElement===root||root.classList.contains('tryon-expanded'),b=root.querySelector('[data-tryon="fullscreen"]');b.setAttribute('aria-label',expanded?'크게 보기 닫기':'착용 보기 크게 열기');b.innerHTML=toolIcon(expanded?'collapse':'expand');draw();}
  function fullScreen() {const expanded=root.classList.toggle('tryon-expanded');if(expanded){root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','실사 착용 크게 보기');}else{root.removeAttribute('role');root.removeAttribute('aria-modal');root.removeAttribute('aria-label');}updateFullscreenButton();root.querySelector('[data-tryon="fullscreen"]').focus();}
  const textureDialog = root.querySelector('.tryon-texture-dialog');
  const textureViewport = root.querySelector('.tryon-texture-detail-viewport');
  const textureImage = root.querySelector('.tryon-texture-detail-image');
  const textureLoading = root.querySelector('.tryon-texture-detail-loading');
  const textureCredits = root.querySelectorAll('.tryon-texture-detail-credit');
  const texturePointers = new Map();
  const textureSources = {
    body: {src:'assets/sweater.png', title:'몸판 조직', note:'착용 사진과 별개의 AI 제작 스웨터 단품 참고 이미지예요.', alt:'연보라색 스웨터 몸판과 주황색 시보리의 뜨개 조직', focus:{x:.5,y:.52}},
    cuff: {src:'assets/sweater.png', title:'소매 끝 시보리 조직', note:'착용 사진과 별개의 AI 제작 스웨터 단품 참고 이미지예요.', alt:'연보라색 스웨터의 주황색 소매 끝 시보리 조직', focus:{x:.11,y:.8}},
    real: {src:'assets/knitted-sweater-kyle-cassidy.jpg', title:'실제 뜨개 완성품', note:'현재 가상 착용 디자인과 다른 실제 아이슬란드 니트 스웨터 착용 사진입니다. 원본 3984 × 5976px.', alt:'실제 아이슬란드 니트 스웨터를 입은 사람. 원본 사진'},
    'real-close': {src:'assets/blue-gray-hand-knit-texture.jpg', title:'실제 손뜨개 스웨터 조직', note:'가상 디자인 및 위 착용 사진과 별개인 손뜨개 스웨터의 근접 사진입니다. 원본 3000 × 2000px.', alt:'실제 손뜨개 스웨터의 회청색 실과 뜨개 코를 가까이 찍은 원본 사진'}
  };
  let textureArea = 'body', textureZoom = 1, textureX = 0, textureY = 0, textureTrigger = null, textureDrag = null, texturePinch = null, textureFitted = false;
  function textureZoomStops() {
    if (!textureArea.startsWith('real') || !textureImage.naturalWidth) return [.5, .75, 1, 1.5, 2];
    const fit = Math.min(textureViewport.clientWidth / textureImage.naturalWidth, textureViewport.clientHeight / textureImage.naturalHeight);
    return [fit, .25, .5, .75, 1].filter((stop, index, list) => stop >= fit - .001 && list.findIndex(value => Math.abs(value - stop) < .001) === index).sort((a,b) => a-b);
  }
  function clampTexturePan() {
    if (!textureImage.naturalWidth || !textureViewport.clientWidth) return;
    const w = textureViewport.clientWidth, h = textureViewport.clientHeight;
    const iw = textureImage.naturalWidth * textureZoom, ih = textureImage.naturalHeight * textureZoom;
    textureX = iw <= w ? (w - iw) / 2 : Math.max(w - iw, Math.min(0, textureX));
    textureY = ih <= h ? (h - ih) / 2 : Math.max(h - ih, Math.min(0, textureY));
  }
  function renderTextureDetail() {
    const stops = textureZoomStops();
    textureDialog.querySelector('.tryon-texture-detail-zoom').textContent = Math.round(textureZoom * 100) + '%';
    textureDialog.querySelector('[data-tryon="texture-detail-zoom-out"]').disabled = !textureImage.naturalWidth || textureZoom <= stops[0] + .001;
    textureDialog.querySelector('[data-tryon="texture-detail-zoom-in"]').disabled = !textureImage.naturalWidth || textureZoom >= stops.at(-1) - .001;
    if (!textureImage.naturalWidth) return;
    textureImage.style.width = textureImage.naturalWidth + 'px';
    textureImage.style.height = textureImage.naturalHeight + 'px';
    textureImage.style.transform = 'translate3d(' + textureX + 'px,' + textureY + 'px,0) scale(' + textureZoom + ')';
  }
  function resetTextureDetail() {
    textureFitted = textureArea.startsWith('real');
    textureZoom = textureFitted && textureImage.naturalWidth ? textureZoomStops()[0] : 1;
    if (textureImage.naturalWidth) {
      if (textureFitted) {
        textureX = (textureViewport.clientWidth - textureImage.naturalWidth * textureZoom) / 2;
        textureY = (textureViewport.clientHeight - textureImage.naturalHeight * textureZoom) / 2;
      } else {
        const focus = textureSources[textureArea].focus;
        textureX = textureViewport.clientWidth / 2 - textureImage.naturalWidth * focus.x;
        textureY = textureViewport.clientHeight / 2 - textureImage.naturalHeight * focus.y;
      }
      clampTexturePan();
    }
    renderTextureDetail();
  }
  function zoomTextureDetail(value, anchorX = textureViewport.clientWidth / 2, anchorY = textureViewport.clientHeight / 2) {
    if (!textureImage.naturalWidth) return;
    const stops = textureZoomStops();
    const next = Math.max(stops[0], Math.min(stops.at(-1), value));
    if (Math.abs(next - textureZoom) < .001) return;
    const ratio = next / textureZoom;
    textureX = anchorX - (anchorX - textureX) * ratio;
    textureY = anchorY - (anchorY - textureY) * ratio;
    textureZoom = next;
    textureFitted = false;
    clampTexturePan();
    renderTextureDetail();
  }
  function stepTextureZoom(direction) {
    const stops = textureZoomStops();
    const next = direction > 0 ? stops.find(stop => stop > textureZoom + .01) : [...stops].reverse().find(stop => stop < textureZoom - .01);
    if (next !== undefined) zoomTextureDetail(next);
  }
  function openTextureDetail(area, trigger) {
    textureArea = textureSources[area] ? area : 'body';
    textureTrigger = trigger;
    const source = textureSources[textureArea];
    textureDialog.querySelector('#tryon-texture-detail-title').textContent = source.title;
    textureDialog.querySelector('#tryon-texture-detail-note').textContent = source.note;
    textureDialog.querySelector('[data-tryon="texture-detail-reset"]').textContent = textureArea.startsWith('real') ? '전체 보기' : '원래 보기';
    textureCredits.forEach(credit => { credit.hidden = credit.dataset.credit !== textureArea; });
    textureImage.alt = source.alt;
    textureLoading.textContent = textureArea.startsWith('real') ? '고해상도 사진을 불러오는 중이에요…' : '이미지를 불러오는 중이에요…';
    textureLoading.hidden = false;
    textureDialog.showModal();
    if (textureImage.getAttribute('src') !== source.src) textureImage.src = source.src;
    if (textureImage.complete && textureImage.naturalWidth) {
      textureLoading.hidden = true;
      resetTextureDetail();
    } else renderTextureDetail();
    textureViewport.focus({preventScroll:true});
  }
  listen(textureImage, 'load', () => {
    textureLoading.hidden = true;
    if (textureDialog.open) resetTextureDetail();
  });
  listen(textureImage, 'error', () => {
    textureLoading.textContent = '사진을 불러오지 못했어요. 잠시 후 다시 열어 주세요.';
    textureLoading.hidden = false;
    renderTextureDetail();
  });
  listen(textureDialog, 'close', () => {
    texturePointers.clear();
    textureDrag = texturePinch = null;
    textureViewport.classList.remove('dragging');
    if (!disposed && textureTrigger?.isConnected) textureTrigger.focus({preventScroll:true});
  });
  listen(textureViewport, 'pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    textureViewport.setPointerCapture(e.pointerId);
    texturePointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (texturePointers.size === 2) {
      const [a,b] = [...texturePointers.values()];
      texturePinch = {distance:Math.hypot(a.x-b.x, a.y-b.y), x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      textureDrag = null;
    } else if (texturePointers.size === 1) textureDrag = {x:e.clientX, y:e.clientY};
    textureViewport.classList.add('dragging');
    textureViewport.focus({preventScroll:true});
  });
  listen(textureViewport, 'pointermove', e => {
    if (!texturePointers.has(e.pointerId)) return;
    texturePointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (texturePointers.size === 2 && texturePinch) {
      const [a,b] = [...texturePointers.values()];
      const distance = Math.hypot(a.x-b.x, a.y-b.y), x = (a.x+b.x)/2, y = (a.y+b.y)/2;
      const rect = textureViewport.getBoundingClientRect();
      if (texturePinch.distance) zoomTextureDetail(textureZoom * distance / texturePinch.distance, x - rect.left, y - rect.top);
      textureX += x - texturePinch.x; textureY += y - texturePinch.y;
      clampTexturePan(); renderTextureDetail();
      texturePinch = {distance, x, y};
    } else if (texturePointers.size === 1 && textureDrag) {
      textureX += e.clientX - textureDrag.x; textureY += e.clientY - textureDrag.y;
      textureDrag = {x:e.clientX, y:e.clientY};
      clampTexturePan(); renderTextureDetail();
    }
  });
  function endTexturePointer(e) {
    texturePointers.delete(e.pointerId);
    texturePinch = null;
    if (texturePointers.size === 1) {
      const point = [...texturePointers.values()][0];
      textureDrag = {x:point.x, y:point.y};
    } else if (!texturePointers.size) {
      textureDrag = null;
      textureViewport.classList.remove('dragging');
    }
  }
  listen(textureViewport, 'pointerup', endTexturePointer);
  listen(textureViewport, 'pointercancel', endTexturePointer);
  listen(textureViewport, 'lostpointercapture', endTexturePointer);
  listen(textureViewport, 'wheel', e => {
    if (!textureImage.naturalWidth || !e.deltaY) return;
    e.preventDefault();
    const rect = textureViewport.getBoundingClientRect();
    zoomTextureDetail(textureZoom * Math.exp(-e.deltaY * .0015), e.clientX - rect.left, e.clientY - rect.top);
  }, {passive:false});
  listen(textureViewport, 'keydown', e => {
    if (e.target !== textureViewport) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','0'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft') textureX += 70;
    if (e.key === 'ArrowRight') textureX -= 70;
    if (e.key === 'ArrowUp') textureY += 70;
    if (e.key === 'ArrowDown') textureY -= 70;
    if (e.key.startsWith('Arrow')) {clampTexturePan(); renderTextureDetail();}
    if (e.key === '+' || e.key === '=') stepTextureZoom(1);
    if (e.key === '-') stepTextureZoom(-1);
    if (e.key === 'Home' || e.key === '0') resetTextureDetail();
  });
  const textureObserver = new ResizeObserver(() => {
    if (!textureDialog.open) return;
    if (textureArea.startsWith('real') && textureFitted) resetTextureDetail();
    else {clampTexturePan(); renderTextureDetail();}
  });
  textureObserver.observe(textureViewport);
  listen(root,'click',e=>{
    const b=e.target.closest('[data-tryon]'); if(!b) return;
    switch(b.dataset.tryon){
      case 'base': case 'long': case 'compare': ui.variant=b.dataset.tryon; renderControls(); break;
      case 'prev': stop();setFrame(ui.frame-1);break;
      case 'next': stop();setFrame(ui.frame+1);break;
      case 'angle': stop();setFrame(Number(b.dataset.angle));break;
      case 'play':play();break;
      case 'reset':reset();break;
      case 'zoom-out':stepZoom(-1);break;
      case 'zoom-in':stepZoom(1);break;
      case 'texture':{const panel=root.querySelector('.tryon-texture-panel');panel.hidden=!panel.hidden;b.setAttribute('aria-expanded',String(!panel.hidden));break;}
      case 'texture-close':{root.querySelector('.tryon-texture-panel').hidden=true;const toggle=root.querySelector('[data-tryon="texture"]');toggle.setAttribute('aria-expanded','false');toggle.focus();break;}
      case 'texture-detail':openTextureDetail(b.dataset.area,b);break;
      case 'texture-detail-close':textureDialog.close();break;
      case 'texture-detail-zoom-out':stepTextureZoom(-1);break;
      case 'texture-detail-zoom-in':stepTextureZoom(1);break;
      case 'texture-detail-reset':resetTextureDetail();break;
      case 'fullscreen':fullScreen();break;
      case 'save':saveImage();break;
      case 'propose':stop();onPropose(ui.variant==='base'?48:52);break;
    }
  });
  listen(root.querySelector('input[type="range"]'),'input',e=>{stop();setFrame(Number(e.target.value));});
  listen(viewport,'keydown',e=>{
    if(e.target!==viewport)return;
    if(['ArrowLeft','ArrowRight','Home',' ','+','=','-','0'].includes(e.key))e.preventDefault();
    if(e.key==='ArrowLeft'){stop();setFrame(ui.frame-1);}
    if(e.key==='ArrowRight'){stop();setFrame(ui.frame+1);}
    if(e.key==='Home'||e.key==='0')reset();
    if(e.key===' ')play();
    if(e.key==='+'||e.key==='=')stepZoom(1);
    if(e.key==='-')stepZoom(-1);
  });
  const pointers=new Map();
  let pinch=null;
  listen(viewport,'pointerdown',e=>{
    if(e.target.closest('button')||(e.pointerType==='mouse'&&e.button!==0))return;
    stop();
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    viewport.setPointerCapture(e.pointerId);
    if(pointers.size===2){
      const [a,b]=[...pointers.values()];
      pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      drag=null;
    }else if(pointers.size===1){
      drag={mode:zoomFactor()>1?'pan':'rotate',x:e.clientX,y:e.clientY,frame:ui.frame};
    }
    viewport.classList.add('dragging');
    viewport.focus({preventScroll:true});
  });
  listen(viewport,'pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinch){
      const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const point=localPoint(x,y);
      if(pinch.distance>0)zoomTo(zoomFactor()*distance/pinch.distance,point.x,point.y);
      ui.panX+=x-pinch.x; ui.panY+=y-pinch.y; clampPan(); draw();
      pinch={distance,x,y};
    }else if(pointers.size===1&&drag){
      if(drag.mode==='pan'){
        ui.panX+=e.clientX-drag.x;ui.panY+=e.clientY-drag.y;
        drag.x=e.clientX;drag.y=e.clientY;clampPan();draw();
      }else{
        const frame=drag.frame+Math.round((drag.x-e.clientX)/Math.max(26,viewport.clientWidth/9));
        if((frame%8+8)%8!==ui.frame)setFrame(frame);
      }
    }
  });
  function endPointer(e){
    pointers.delete(e.pointerId);
    if(pointers.size===1){
      const remaining=[...pointers.values()][0];
      drag={mode:zoomFactor()>1?'pan':'rotate',x:remaining.x,y:remaining.y,frame:ui.frame};
    }else if(!pointers.size){
      drag=null;viewport.classList.remove('dragging');
    }
    pinch=null;
  }
  listen(viewport,'pointerup',endPointer);
  listen(viewport,'pointercancel',endPointer);
  listen(viewport,'lostpointercapture',endPointer);
  listen(viewport,'wheel',e=>{
    if(!images || !e.deltaY)return;
    const current=zoomFactor();
    if((e.deltaY>0&&current<=1)||(e.deltaY<0&&current>=4)){
      if(e.ctrlKey)e.preventDefault(); // Avoid browser page zoom from a trackpad pinch at the limit.
      return;
    }
    e.preventDefault();
    const point=localPoint(e.clientX,e.clientY);
    zoomTo(current*Math.exp(-e.deltaY*.0015),point.x,point.y);
  },{passive:false});
  listen(viewport,'dblclick',e=>{
    if(e.target.closest('button'))return;
    const point=localPoint(e.clientX,e.clientY);
    zoomTo(zoomFactor()>1?1:2,point.x,point.y);
  });
  listen(document,'visibilitychange',()=>{if(document.hidden)stop();});
  listen(document,'keydown',e=>{if(textureDialog.open||!root.classList.contains('tryon-expanded')||document.querySelector('#modal-root .modal'))return;if(e.key==='Escape')fullScreen();if(e.key==='Tab'){const a=[...root.querySelectorAll('button,input,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length),first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} });
  listen(document,'fullscreenchange',updateFullscreenButton);
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);});observer.observe(viewport);
  listen(window,'resize',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);});
  renderControls();
  Promise.all([loadImage(sources.base),loadImage(sources.long)]).then(([base,long])=>{if(disposed)return;images={base,long};root.querySelector('.tryon-loading').hidden=true;renderControls();}).catch(err=>{if(!disposed)root.querySelector('.tryon-loading').textContent=err.message+' 새로고침해 주세요.';});
  return {reset,zoom(){zoomTo(zoomFactor()>1?1:2);},save:saveImage,dispose(){disposed=true;if(textureDialog.open)textureDialog.close();textureObserver.disconnect();stop();abort.abort();observer.disconnect();cancelAnimationFrame(raf);hdFrames={base:[],long:[]};front4kFrames={base:null,long:null};front4kLoading.clear();detailOrder.length=0;}};
}
