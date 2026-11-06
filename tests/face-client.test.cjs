const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function client({fetch=async()=>{}, getIdToken=async()=>'token', frozen=false, timeout=false}={}) {
    let stops=0, drawings=0, created=0;const delays=[],sizes=[];
    const canvas={width:0,height:0,getContext:()=>({drawImage(){drawings++;sizes.push([canvas.width,canvas.height]);}}),toDataURL:()=> 'data:image/jpeg;base64,frame'+drawings};
    const video={currentTime:0,readyState:2,videoWidth:1280,videoHeight:720,play:async()=>{},
        requestVideoFrameCallback(fn){if(!frozen)return setImmediate(()=>{video.currentTime++;fn();});},cancelVideoFrameCallback:clearImmediate};
    const window={tsFirebase:{auth:{currentUser:{uid:'buyer',getIdToken}}},addEventListener(){}};
    const context=vm.createContext({window,document:{currentScript:{src:'http://localhost/ticksecure-ui/assets/js/face-client.js'},addEventListener(){},createElement(){created++;return canvas;}},
        navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stops++;}}]})}},URL,AbortController,
        fetch,setTimeout:(fn,ms)=>{delays.push(ms);return setTimeout(fn,ms>=2500?(timeout||frozen?5:ms):0);},clearTimeout});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/face-client.js'),'utf8'),context);
    return {api:window.tsFace,video,canvas,delays,sizes,get stops(){return stops;},get created(){return created;}};
}
test('captures three fresh frames with bounded resolution, progress and one cleared canvas',async()=>{
    const c=client(), camera=c.api.camera(c.video),progress=[];
    await camera.start();const frames=await camera.frames((n,total)=>progress.push([n,total]));
    assert.deepEqual([...frames],['frame1','frame2','frame3']);
    assert.deepEqual(progress,[[1,3],[2,3],[3,3]]);
    assert.deepEqual(c.sizes,[[960,540],[960,540],[960,540]]);
    assert.equal(c.created,1);assert.equal(c.canvas.width,0);
    assert.equal(c.delays.filter(ms=>ms===250).length,2);camera.stop();
});
test('frozen camera is rejected and tracks are released',async()=>{
    const c=client({frozen:true});await assert.rejects(c.api.camera(c.video).start(),/frozen/);assert.equal(c.stops,1);
});
test('closing camera during capture prevents images from being returned',async()=>{
    const c=client(),camera=c.api.camera(c.video);await camera.start();const pending=camera.frames();camera.stop();
    await assert.rejects(pending,/Start the camera/);assert.equal(c.canvas.width,0);
});
test('stalled request aborts and gives an uncertain-result warning without retrying',async()=>{
    let signal,calls=0;const c=client({timeout:true,fetch:async(_,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}});
    await assert.rejects(c.api.request('completeCheckIn'),/Check the ticket status/);
    assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('stalled authentication also times out without submitting images later',async()=>{
    let finish,calls=0;const c=client({timeout:true,getIdToken:()=>new Promise(resolve=>finish=resolve),fetch:async()=>{calls++;}});
    await assert.rejects(c.api.request('enroll'),/too long/);finish('late-token');await new Promise(setImmediate);assert.equal(calls,0);
});
test('specific backend quality guidance reaches the caller',async()=>{
    const c=client({fetch:async()=>({ok:false,json:async()=>({error:{message:'Your face is too dark.'}})})});
    await assert.rejects(c.api.request('enroll'),/too dark/);
});
