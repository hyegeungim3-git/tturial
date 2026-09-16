const angles = ['정면', '오른쪽 앞', '오른쪽 옆', '오른쪽 뒤', '뒷면', '왼쪽 뒤', '왼쪽 옆', '왼쪽 앞'];
const sources = { base: 'assets/tryon-base.png', long: 'assets/tryon-long.png' };
const toolPaths = { plus:'M12 5v14M5 12h14', minus:'M5 12h14', expand:'M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4', collapse:'M4 8h4V4m8 0v4h4M8 20v-4H4m12 4v-4h4', download:'M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4' };
const toolIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${toolPaths[name]}"/></svg>`;
const cached = new Map();
function loadImage(src) {
  if (!cached.has(src)) cached.set(src, new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => { cached.delete(src); reject(new Error('착용 이미지를 불러오지 못했어요.')); }; img.src = src;
  }));
  return cached.get(src);
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
    <div class="tryon-viewport" tabindex="0" role="group" aria-label="360도 착용 보기. 좌우로 드래그하거나 방향키로 회전하세요.">
      <canvas class="tryon-canvas" role="img" aria-label="실사형 모델의 스웨터 착용 이미지"></canvas>
      <div class="tryon-loading" role="status">착용 이미지를 불러오는 중이에요…</div>
      <div class="tryon-stage-top"><span class="tryon-look-label"></span><div class="tryon-stage-tools"><button class="tryon-zoom" data-tryon="zoom" aria-label="소매와 조직 확대" title="소매와 조직 확대">${toolIcon('plus')}</button><button class="tryon-zoom" data-tryon="fullscreen" aria-label="착용 보기 크게 열기" title="크게 보기">${toolIcon('expand')}</button><button class="tryon-zoom" data-tryon="save" aria-label="현재 착용 이미지 저장" title="이미지 저장">${toolIcon('download')}</button></div></div>
      <div class="tryon-compare-labels" hidden><span>기본 소매</span><span>손등 덮는 소매</span></div>
      <span class="tryon-drag-hint">↔ 드래그해서 돌려보세요</span>
    </div>
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
  let images, disposed = false, timer = null, drag = null, raf = null;
  const listen = (el, name, fn) => el.addEventListener(name, fn, {signal});
  ui.frame = ((ui.frame || 0) % 8 + 8) % 8;
  ui.variant ||= sleeve === 52 ? 'long' : 'base';
  function drawView(img, x, y, w, h) {
    const cw = img.naturalWidth / 4, ch = img.naturalHeight / 2;
    const column = ui.frame % 4, row = Math.floor(ui.frame / 4);
    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    const scale = Math.min(w / cw, h / ch) * (ui.zoom ? 1.85 : 1);
    const dw = cw * scale, dh = ch * scale;
    const dx = x + (w-dw)/2;
    const dy = ui.zoom ? y + h*.46 - dh*.41 : y + (h-dh)/2;
    ctx.drawImage(img, column*cw, row*ch, cw, ch, dx, dy, dw, dh);
    ctx.restore();
  }
  function draw() {
    if (disposed || !images) return;
    const {width:w,height:h} = viewport.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h) return;
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = '#f1f0ee'; ctx.fillRect(0,0,w,h);
    if (ui.variant === 'compare') {
      drawView(images.base,0,0,w/2,h); drawView(images.long,w/2,0,w/2,h);
      ctx.fillStyle='#d8d4d0'; ctx.fillRect(Math.floor(w/2),22,1,h-44);
    } else drawView(images[ui.variant],0,0,w,h);
    canvas.setAttribute('aria-label',`${ui.variant==='compare'?'기본 소매와 긴 소매 비교':ui.variant==='long'?'손등 덮는 소매':'기본 소매'}, ${angles[ui.frame]}, ${ui.frame*45}도${ui.zoom?', 확대':''}`);
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
    root.querySelector('[data-tryon="zoom"]').innerHTML=toolIcon(ui.zoom?'minus':'plus');
    root.querySelector('[data-tryon="zoom"]').setAttribute('aria-label',ui.zoom?'전신 보기':'소매와 조직 확대');
    draw();
  }
  function stop() { clearInterval(timer); timer=null; const b=root.querySelector('[data-tryon="play"]'); b.textContent='▷'; b.setAttribute('aria-pressed','false'); b.setAttribute('aria-label','자동 회전 시작'); }
  function setFrame(n) { ui.frame=(n%8+8)%8; renderControls(); }
  function play() { if(timer){stop();return;} timer=setInterval(()=>setFrame(ui.frame+1),850); const b=root.querySelector('[data-tryon="play"]'); b.textContent='Ⅱ'; b.setAttribute('aria-pressed','true'); b.setAttribute('aria-label','자동 회전 멈춤'); }
  function reset() { stop(); ui.zoom=false; setFrame(0); }
  function saveImage(name='뜨리얼-착용예시.png') {if(!images)return;canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
  function updateFullscreenButton() {const expanded=document.fullscreenElement===root||root.classList.contains('tryon-expanded'),b=root.querySelector('[data-tryon="fullscreen"]');b.setAttribute('aria-label',expanded?'크게 보기 닫기':'착용 보기 크게 열기');b.innerHTML=toolIcon(expanded?'collapse':'expand');draw();}
  function fullScreen() {const expanded=root.classList.toggle('tryon-expanded');if(expanded){root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','실사 착용 크게 보기');}else{root.removeAttribute('role');root.removeAttribute('aria-modal');root.removeAttribute('aria-label');}updateFullscreenButton();root.querySelector('[data-tryon="fullscreen"]').focus();}
  listen(root,'click',e=>{
    const b=e.target.closest('[data-tryon]'); if(!b) return;
    switch(b.dataset.tryon){
      case 'base': case 'long': case 'compare': ui.variant=b.dataset.tryon; renderControls(); break;
      case 'prev': stop();setFrame(ui.frame-1);break;
      case 'next': stop();setFrame(ui.frame+1);break;
      case 'angle': stop();setFrame(Number(b.dataset.angle));break;
      case 'play':play();break;
      case 'reset':reset();break;
      case 'zoom':ui.zoom=!ui.zoom;renderControls();break;
      case 'fullscreen':fullScreen();break;
      case 'save':saveImage();break;
      case 'propose':stop();onPropose(ui.variant==='base'?48:52);break;
    }
  });
  listen(root.querySelector('input[type="range"]'),'input',e=>{stop();setFrame(Number(e.target.value));});
  listen(viewport,'keydown',e=>{
    if(e.target!==viewport)return;
    if(['ArrowLeft','ArrowRight','Home',' '].includes(e.key))e.preventDefault();
    if(e.key==='ArrowLeft'){stop();setFrame(ui.frame-1);} if(e.key==='ArrowRight'){stop();setFrame(ui.frame+1);} if(e.key==='Home')reset();if(e.key===' ')play();
  });
  listen(viewport,'pointerdown',e=>{if(e.target.closest('button')||e.button>0)return;stop();drag={x:e.clientX,frame:ui.frame};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');viewport.focus({preventScroll:true});});
  listen(viewport,'pointermove',e=>{if(!drag)return;const frame=drag.frame+Math.round((drag.x-e.clientX)/Math.max(26,viewport.clientWidth/9));if((frame%8+8)%8!==ui.frame)setFrame(frame);});
  const endDrag=()=>{drag=null;viewport.classList.remove('dragging');};listen(viewport,'pointerup',endDrag);listen(viewport,'pointercancel',endDrag);listen(viewport,'lostpointercapture',endDrag);
  listen(document,'visibilitychange',()=>{if(document.hidden)stop();});
  listen(document,'keydown',e=>{if(!root.classList.contains('tryon-expanded')||document.querySelector('#modal-root .modal'))return;if(e.key==='Escape')fullScreen();if(e.key==='Tab'){const a=[...root.querySelectorAll('button,input,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length),first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} });
  listen(document,'fullscreenchange',updateFullscreenButton);
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);});observer.observe(viewport);
  renderControls();
  Promise.all([loadImage(sources.base),loadImage(sources.long)]).then(([base,long])=>{if(disposed)return;images={base,long};root.querySelector('.tryon-loading').hidden=true;renderControls();}).catch(err=>{if(!disposed)root.querySelector('.tryon-loading').textContent=err.message+' 새로고침해 주세요.';});
  return {reset,zoom(){ui.zoom=!ui.zoom;renderControls();},save:saveImage,dispose(){disposed=true;stop();abort.abort();observer.disconnect();cancelAnimationFrame(raf);}};
}
