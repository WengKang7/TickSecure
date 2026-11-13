const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = {window:{}, URL, document:{currentScript:{src:'http://localhost/assets/js/face-movement.js'}}};
vm.runInNewContext(fs.readFileSync('assets/js/face-movement.js','utf8'), context);
const {valid,accepts,pose} = context.window.tsFaceMovement;
test('browser guidance rejects static face, wrong direction, missing face and tilt', () => {
    assert.equal(valid(['center','right','center','left','center']),true);
    assert.equal(valid(['center','center','center','center','center']),false);
    assert.equal(accepts({yaw:0,offset:0,roll:0},'left'),false);
    assert.equal(accepts({yaw:22,offset:.2,roll:0},'left'),true);
    assert.equal(accepts({yaw:22,offset:.2,roll:0},'right'),false);
    assert.equal(accepts({yaw:22,offset:.2,roll:30},'left'),false);
    assert.equal(accepts(null,'center'),false);
});
test('pose handles matrix layouts consistently and rejects multiple faces', () => {
    const points=Array.from({length:478},()=>({x:.5,y:.5,z:0})); points[234].x=.2;points[454].x=.8;
    const angle=.35, c=Math.cos(angle),s=Math.sin(angle);
    const row=[c,0,s,1, 0,1,0,2, -s,0,c,-60, 0,0,0,1];
    const col=row.map((_,i)=>row[(i%4)*4+Math.floor(i/4)]);
    const result=data=>pose({faceLandmarks:[points],facialTransformationMatrixes:[{data}]});
    assert.deepEqual(result(row),result(col));
    assert.ok(Math.abs(result(row).yaw-angle*180/Math.PI)<.001);
    assert.equal(pose({faceLandmarks:[points,points]}),null);
});
