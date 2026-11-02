import{expect,test}from'bun:test';
import{recordTurntable}from'../client/src/lib/record-3d-video.ts';
test('aborted recording always closes stream, cancels RAF and removes copy canvas',async()=>{
 const names=['document','MediaRecorder','requestAnimationFrame','cancelAnimationFrame']as const;const previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]as const);let stopped=0,removed=0,cancelled=0;
 const canvas={width:100,height:100,style:{},remove:()=>removed++,getContext:()=>({drawImage:()=>{}}),captureStream:()=>({getTracks:()=>[{stop:()=>stopped++}],getVideoTracks:()=>[{requestFrame:()=>{}}]})};
 class Recorder{static isTypeSupported(){return true;}state='inactive';onstop?:()=>void;start(){this.state='recording';}stop(){this.state='inactive';this.onstop?.();}}
 const values={document:{createElement:()=>canvas,body:{appendChild:()=>{}}},MediaRecorder:Recorder,requestAnimationFrame:()=>42,cancelAnimationFrame:()=>cancelled++};for(const name of names)Object.defineProperty(globalThis,name,{value:values[name],configurable:true});
 try{const abort=new AbortController(),recording=recordTurntable(canvas as unknown as HTMLCanvasElement,()=>{},{signal:abort.signal});abort.abort();await expect(recording).rejects.toThrow('Rekaman dibatalkan');expect(stopped).toBe(1);expect(removed).toBe(1);expect(cancelled).toBe(1);}finally{for(const[name,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}
});
