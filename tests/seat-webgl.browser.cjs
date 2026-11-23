// Isolated browser regression check. No Firebase, account, reservation or payment requests.
// Run with Playwright on NODE_PATH: node tests/seat-webgl.browser.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=`<!doctype html><style>#viewer{width:960px;height:650px;position:relative}.ts-seat-3d-canvas{width:100%;height:100%;position:relative}.ts-seat-webgl-surface{position:absolute;inset:0;width:100%;height:100%}</style><div id="viewer"></div>
<script src="/assets/js/seat-view-model.js"></script><script src="/assets/js/seat-view-people.js"></script><script src="/assets/js/seat-view-3d.js"></script>
<script type="module">import '/assets/js/seat-webgl.js';window.ready=true;</script>`;
(async()=>{
    const browser=await chromium.launch({channel:'msedge',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*',route=>{
            const url=new URL(route.request().url());
            if(url.hostname!=='seat-test.invalid')return route.abort();
            if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});
            const file=path.resolve(root,'.'+url.pathname);
            if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
            return route.fulfill({body:fs.readFileSync(file),contentType:'application/javascript'});
        });
        await page.goto('https://seat-test.invalid');await page.waitForFunction(()=>window.ready);
        const result=await page.evaluate(()=>{
            const model={eventName:'Local concert',geometry:{imageWidth:800,imageHeight:800,decorations:[{name:'STAGE',points:[{x:28,y:4},{x:76,y:4},{x:76,y:14},{x:28,y:14}]}]},seats:[]};
            for(let r=0;r<16;r++)for(let c=0;c<22;c++)model.seats.push({id:`seat-${r}-${c}`,seatLabel:`VIP-${r*22+c+1}`,status:r===0&&c===1?'HELD':'AVAILABLE',position:{x:12+c*3.5,y:23+r*4,width:2.6,height:2.6}});
            const before=JSON.stringify(model),scene=tsSeatViewModel.createScene(model,1,{concertTheme:true});
            const gpu=tsSeatWebGL.create();document.getElementById('viewer').append(gpu.canvas);
            const state={selected:['seat-5-5'],focusId:null,hoverId:null,viewSeatId:null,showPeople:false,stageTime:0};
            const camera=tsSeatViewModel.overviewCamera(scene,960/650,{});
            gpu.draw(scene,state,camera,960,650,[]);
            const picks=[];
            for(const seat of scene.seats.filter(s=>['seat-5-5','seat-10-10','seat-15-15','seat-0-1'].includes(s.id))) {
                const p=tsSeatViewModel.project([seat.x,.7,seat.z],camera,960,650);
                picks.push({expected:seat.id,actual:gpu.pick(p.x,p.y)});
            }
            const smallStats=gpu.stats();
            const stagePoint=tsSeatViewModel.project([scene.stage.x,scene.stage.screenY,scene.stage.z],camera,960,650);
            const stagePick=gpu.pick(stagePoint.x,stagePoint.y);
            state.viewSeatId='seat-5-5';gpu.draw(scene,state,tsSeatViewModel.seatCamera(scene,state.viewSeatId),960,650,[1,2,3]);
            // Untrusted artwork URLs are handled by the existing controller, never by this renderer.
            gpu.dispose();gpu.dispose();
            const big=structuredClone(model);big.seats=[];
            for(let r=0;r<40;r++)for(let c=0;c<50;c++)big.seats.push({id:`big-${r}-${c}`,seatLabel:`VIP-${r*50+c+1}`,status:'AVAILABLE',position:{x:5+c*1.8,y:20+r*2,width:1.3,height:1.3}});
            const bigScene=tsSeatViewModel.createScene(big,1,{concertTheme:true}),large=tsSeatWebGL.create();
            large.draw(bigScene,{...state,viewSeatId:null},tsSeatViewModel.overviewCamera(bigScene,960/650,{}),960,650,[]);
            const largeStats=large.stats();large.dispose();
            window.fixture=model;window.selectedCalls=[];
            window.control=tsSeatView3D.mount(document.getElementById('viewer'),{concertTheme:true,onSeatSelect:id=>selectedCalls.push(id)});
            control.update(model,[],true);
            return {picks,stagePick,smallStats,largeStats,unchanged:JSON.stringify(model)===before};
        });
        for(const pick of result.picks)assert.equal(pick.actual,pick.expected,'GPU picking must preserve exact seat ID');
        assert.equal(result.stagePick,null,'Stage must never select a seat behind it');
        assert.equal(result.unchanged,true,'Rendering must not mutate booking data');
        assert.ok(result.largeStats.calls<=result.smallStats.calls+4,'Seat count must not multiply draw calls');
        assert.equal(result.largeStats.seats,2000);
        await page.locator('.ts-seat-3d-canvas').focus();
        await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
        assert.deepEqual(await page.evaluate(()=>selectedCalls),[],'Busy/reserved selection stays locked');
        await page.evaluate(()=>control.update(fixture,[],false));await page.keyboard.press('Enter');
        assert.equal((await page.evaluate(()=>selectedCalls)).length,1);
        // Exercise a real lost GPU context; the CPU preview must remain interactive.
        await page.evaluate(()=>document.querySelector('.ts-seat-webgl-surface').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
        await page.waitForFunction(()=>!document.querySelector('.ts-seat-webgl-surface'));
        await page.evaluate(()=>{control.reset();control.dispose();});
        assert.equal(await page.locator('#viewer canvas').count(),0);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({passed:true,...result},null,2));
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
