const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const php='C:/xampp/php/php.exe';

test('display cache reuses layouts, expires, invalidates by version and does not cache failures',()=>{
    const script=`require $argv[1]; $key=bin2hex(random_bytes(12));$calls=0;
        $load=function()use(&$calls){return ['load'=>++$calls];};
        $a=display_read_cache('test',$key,300,$load);
        $b=display_read_cache('test',$key,300,$load);
        $c=display_read_cache('test',$key,0,$load);
        $d=display_read_cache('test',$key.'-new-version',300,$load);
        $errors=0;for($i=0;$i<2;$i++)try{display_read_cache('test',$key.'-failure',300,function()use(&$errors){$errors++;throw new RuntimeException('offline');});}catch(RuntimeException $e){}
        echo json_encode([$a,$b,$c,$d,$calls,$errors]);
        $dir=sys_get_temp_dir().DIRECTORY_SEPARATOR.'ticksecure-display-'.hash('sha256',realpath(dirname($argv[1])).'|'.(getenv('FIREBASE_PROJECT_ID')?:'tick-c12a1'));
        foreach([$key,$key.'-new-version',$key.'-failure']as$k)@unlink($dir.DIRECTORY_SEPARATOR.hash('sha256','test|'.$k).'.json');`;
    const result=JSON.parse(execFileSync(php,['-r',script,path.resolve('api/display-read-cache.php')],{encoding:'utf8'}));
    assert.deepEqual(result,[{load:1},{load:1},{load:2},{load:3},3,2]);
});

function seed(){
    const records={
        'Users/buyer':{role:'buyer',status:'active',emailVerified:true},
        'Events/event':{venueId:'venue',status:'PUBLISHED',categories:{A:{name:'VIP',price:100,quantity:2},B:{name:'Standard',price:50,quantity:300}}},
        'Venues/venue':{name:'Hall',sections:[]}
    };
    for(let i=0;i<302;i++)records['EventSeats/s'+i]={eventId:'event',venueId:'venue',sectionId:i<2?'A':'B',seatLabel:'s'+i,status:i===0?'SOLD':'AVAILABLE'};
    return records;
}
test('PHP seat map reads only the chosen category and keeps current sold/held state without writes',()=>{
    const records=seed();
    records['EventSeats/s1']={...records['EventSeats/s1'],status:'RESERVED',reservedBy:'other',reservationExpiry:'2099-01-01T00:00:00Z'};
    const output=JSON.parse(execFileSync(php,['tests/resale-backend-fixture.php'],{encoding:'utf8',input:JSON.stringify([
        {action:'getSeatMap',uid:'buyer',data:{eventId:'event',sectionId:'A'},records,traceReads:true}
    ])}))[0];
    assert.equal(output.error,undefined);
    assert.deepEqual(output.queries,[{collection:'EventSeats',filters:{eventId:'event',sectionId:'A'}}]);
    assert.deepEqual(output.result.seats.map(s=>s.status),['SOLD','HELD']);
    assert.deepEqual(output.records,records);
});

test('Functions seat map also queries only selected category, preserving lazy initialization',async()=>{
    const source=fs.readFileSync('functions/index.js','utf8');
    const definition=source.slice(source.indexOf('exports.getSeatMap ='),source.indexOf('exports.holdSelectedSeats ='));
    assert.ok(definition.length>100);
    const records=seed(),queries=[];let initialized=0;
    let missing=false;
    const collection=(name,filters=[],cap=Infinity)=>({
        doc:id=>({get:async()=>({data:()=>records[name+'/'+id]})}),
        where:(field,op,value)=>collection(name,[...filters,[field,value]],cap),
        limit:value=>collection(name,filters,value),
        get:async()=>{queries.push({name,filters});const docs=Object.entries(records).filter(([key,data])=>key.startsWith(name+'/')&&filters.every(([field,value])=>data[field]===value)).slice(0,cap).map(([key,data])=>({id:key.split('/')[1],data:()=>data}));return {size:missing?0:docs.length,docs:missing?[]:docs};}
    });
    const context=vm.createContext({exports:{},onCall:(_,fn)=>fn,region:'test',db:{collection},requireAuth:()=> 'buyer',requireDataObject:r=>r.data,
        requireId:v=>v,getActor:async()=>records['Users/buyer'],salesAreOpen:e=>e.status==='PUBLISHED',
        requireTicketCategory:c=>({name:c.name,price:c.price}),categoryForSection:(c,s)=>c[s],requirePositiveInteger:Number,maxInventoryPerCategory:100000,
        HttpsError:Error,configuredMaxTickets:()=>4,visibleSeat:s=>s,layoutContext:()=>[],ensureEventInventory:async()=>{initialized++;missing=false;}});
    vm.runInContext(definition,context);
    const result=await context.exports.getSeatMap({data:{eventId:'event',sectionId:'A'}});
    assert.equal(result.seats.length,2);assert.equal(initialized,0);
    assert.deepEqual(queries.map(q=>JSON.parse(JSON.stringify(q))),[{name:'EventSeats',filters:[['eventId','event'],['sectionId','A']]}]);
    missing=true;await context.exports.getSeatMap({data:{eventId:'event',sectionId:'A'}});assert.equal(initialized,1);
});
