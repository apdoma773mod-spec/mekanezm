import { encodeSegment, concatSegments } from './src/modules/web/video.js';
(async()=>{const d='C:/Users/AD30~1/AppData/Local/Temp/claude/43da37d06e601903/b2b690bc-e3b4-45d5-b000-ee8790b720db/scratchpad';const fs=[];const t=Date.now();
await Promise.all([0,1,2,3].map(async i=>{const o=d+'/s'+i+'.mp4';await encodeSegment(d+'/v.mov',i*4,4,o);fs[i]=o;}));
console.log('segs',Date.now()-t);await concatSegments(fs,d+'/final.mp4',d);console.log('done',Date.now()-t)})().catch(e=>console.log('ERR',e.message));
