// Pure constrained continuation: retain the knitted prefix; solve only the tail.
export function makeSleeveRound(round,before,operation){
  const rib=operation==='rib2x2',after=before-(operation==='paired-decrease'?2:0);
  return {round,section:rib?'cuff':'sleeve',before,after,operation,repeat:rib?after/4:null,
    instruction:rib?`[겉뜨기 2코, 안뜨기 2코] ${after/4}회`:operation==='paired-decrease'?`겉뜨기 1코, SSK(왼쪽 기울기 2코 모아뜨기), 겉뜨기 ${before-6}코, k2tog(오른쪽 기울기 2코 모아뜨기), 겉뜨기 1코`:`겉뜨기 ${after}코`};
}
const near=(a,b)=>Math.abs(a-b)<1e-8;
const round2=n=>Math.round(n*100)/100;
export function solveContinuation({revision,context,requestedCm,baseline,gauge}){
  const errors=[],r=revision,s=baseline,fail=message=>({valid:false,errors:[message]});
  if(!r||r.schema!==1||r.context!==context||r.targetCm!==requestedCm)return fail('실측 보정 이후 치수·게이지 조건이 바뀌었어요. 현재 조건에서 실측 수정안을 다시 만들어 주세요.');
  const m=r.measurement,locks=r.lockedRounds;
  if(!m||!['left','right'].includes(m.side)||!['working','washed'].includes(m.state)||!Number.isInteger(m.rows)||m.rows<10||!Number.isFinite(m.cm)||m.cm<=0)return fail('메리야스 구간을 10단 이상 뜬 뒤, 완료 단과 실제 길이를 입력해 주세요.');
  if(!Array.isArray(locks)||locks.length<m.rows||locks.length>2000)return fail('완료 구간의 기록을 확인할 수 없어요. 수정안을 다시 만들어 주세요.');
  const rate=m.rows/m.cm;
  if(rate<.5||rate>8)return fail('실측으로 계산한 게이지가 10cm당 5–80단 범위를 벗어나요. 겨드랑이 아래 길이와 단 수를 확인해 주세요.');
  let current=s.startStitches;
  for(let i=0;i<locks.length;i++){
    const row=locks[i];
    if(!['knit','paired-decrease'].includes(row.operation))return fail('이미 고무단을 시작한 소매가 있어요. 이 기능은 고무단 전 메리야스 구간에서 사용할 수 있어요.');
    const expected=makeSleeveRound(i+1,current,row.operation);
    if(JSON.stringify(expected)!==JSON.stringify(row))return fail('완료 구간의 코 수 연결이 맞지 않아요. 기존 도안을 확인해 주세요.');
    current=row.after;
  }
  const capLengthCm=s.capRows/gauge.rowsPerCm;
  const underarmRows=Math.round((requestedCm-capLengthCm)*rate);
  const shapingRows=underarmRows-s.cuffRows,lockedRows=locks.length;
  const remainingDecreases=(current-s.cuffStitches)/2;
  if(!Number.isInteger(remainingDecreases)||remainingDecreases<0)return fail('현재 코 수에서 기존 소맷단 코 수로 줄일 수 없어요. 코 수 기록을 확인해 주세요.');
  const lockedDecrease=locks.filter(row=>row.operation==='paired-decrease').map(row=>row.round);
  const lastDecrease=lockedDecrease.at(-1)||0;
  const earliest=Math.max(lockedRows+1,lastDecrease+2);
  const minimumEnd=remainingDecreases?earliest+(remainingDecreases-1)*2:lockedRows;
  const minimumCm=Math.ceil((capLengthCm+(minimumEnd+s.cuffRows)/rate)*10)/10;
  if(shapingRows<lockedRows)return fail(`목표 길이가 짧아 완료 ${lockedRows}단과 기존 고무단 ${s.cuffRows}단을 함께 유지할 수 없어요. 남은 줄임도 포함하려면 목표를 ${minimumCm}cm 이상으로 늘려주세요.`);
  if(minimumEnd>shapingRows)return fail(`남은 줄임 ${remainingDecreases}회를 2단 이상 간격으로 배치할 공간이 부족해요. 목표를 ${minimumCm}cm 이상으로 늘려주세요.`);
  const slack=shapingRows-minimumEnd;
  const futureDecreases=Array.from({length:remainingDecreases},(_,i)=>earliest+i*2+Math.floor((i+1)*slack/remainingDecreases));
  const decreasing=new Set(futureDecreases),rounds=locks.map(row=>({...row}));
  for(let n=lockedRows+1;n<=underarmRows;n++){
    const row=makeSleeveRound(n,current,n>shapingRows?'rib2x2':decreasing.has(n)?'paired-decrease':'knit');
    rounds.push(row);current=row.after;
  }
  const actualCm=capLengthCm+underarmRows/rate;
  return {valid:errors.length===0,errors,sleeve:{...s,requestedCm,actualCm:round2(actualCm),roundingCm:round2(actualCm-requestedCm),rowsPerCm:rate,capLengthCm,totalRows:s.capRows+underarmRows,underarmRows,shapingRows,actualCuffLengthCm:round2(s.cuffRows/rate),decreaseRounds:[...lockedDecrease,...futureDecreases],rounds,
    continuation:{sourcePlanId:r.sourcePlanId,lockedRows,measurement:{...m},remainingDecreases,futureDecreases,currentStitches:locks.at(-1).after,lockedPrefixPreserved:locks.every((row,i)=>JSON.stringify(row)===JSON.stringify(rounds[i])),capLengthPreserved:near(capLengthCm,s.capRows/gauge.rowsPerCm)}}};
}
