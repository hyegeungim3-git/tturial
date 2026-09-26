// Builds mannequin/outfit meshes off the main thread. Results are transferred, not copied.
import {outfitBase,buildSweater,buildMannequin} from './outfit.js';
import {compileDesign,sleeveRings} from './design-engine.js';

export function buildRequest({type,profile,project,cell}){
  if(type==='mannequin')return buildMannequin(profile,{cell});
  const plan=compileDesign(project);
  if(!plan.valid)return{invalid:true,planId:plan.id};
  const base=outfitBase(project.profile);
  const sweater=buildSweater(base,plan,sleeveRings(plan));
  return{planId:plan.id,body:{H:base.body.H,levels:base.body.levels},skin:base.skin,trousers:base.trousers,sneakers:base.sneakers,sweater,stats:{base:base.stats,sweater:sweater.stats}};
}
export function transferables(value,out=new Set()){
  if(ArrayBuffer.isView(value))out.add(value.buffer);
  else if(Array.isArray(value))value.forEach(v=>transferables(v,out));
  else if(value&&typeof value==='object')Object.values(value).forEach(v=>transferables(v,out));
  return out;
}
if(typeof self!=='undefined'&&typeof window==='undefined'&&typeof self.postMessage==='function'){
  self.onmessage=e=>{
    const {id}=e.data;
    try{
      const result=buildRequest(e.data);
      // cached base meshes are reused by later requests, so send copies of those
      const safe=structuredClone(result);
      self.postMessage({id,ok:true,result:safe},[...transferables(safe)]);
    }catch(error){self.postMessage({id,ok:false,error:String(error?.stack||error)});}
  };
}
