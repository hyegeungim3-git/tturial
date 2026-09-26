// Asks the mesh worker for geometry; falls back to building on the main thread when module
// workers are unavailable. Each call resolves with its own result; callers drop stale ones.
let worker=null,seq=0;
const waiting=new Map();
function fallback(msg){return import('./mesh-worker.js').then(m=>m.buildRequest(msg));}
function getWorker(){
  if(worker!==null)return worker;
  try{
    worker=new Worker(new URL('./mesh-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=e=>{const w=waiting.get(e.data.id);if(!w)return;waiting.delete(e.data.id);e.data.ok?w.resolve(e.data.result):w.reject(new Error(e.data.error));};
    worker.onerror=e=>{
      e.preventDefault?.();worker.terminate();worker=false;
      for(const [id,w] of waiting){waiting.delete(id);fallback(w.msg).then(w.resolve,w.reject);}
    };
  }catch{worker=false;}
  return worker;
}
export function requestMesh(msg){
  const w=getWorker();
  if(!w)return fallback(msg);
  return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject,msg});w.postMessage({...msg,id});});
}
