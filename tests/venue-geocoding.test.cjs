const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), {randomUUID}=require('node:crypto');
const root=path.join(__dirname,'..');
const php='C:/xampp/php/php.exe';
const literal=value=>"'"+String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
function run(code) {
    return JSON.parse(execFileSync(php,['-r',"require 'api/venue-geocoding-service.php'; "+code],{cwd:root,encoding:'utf8'}));
}
function temporaryFile(callback) {
    const file=path.join(os.tmpdir(),'ticksecure-geocoding-test-'+randomUUID()+'.json');
    try {return callback(file);} finally {if(fs.existsSync(file))fs.unlinkSync(file);}
}
test('only active canonical administrator profiles can use venue geocoding',()=>{
    const result=run(`$results=[]; foreach ([[['sub'=>'a'],['role'=>'admin','status'=>'active']],
        [['sub'=>'b'],['role'=>'buyer','status'=>'active']], [['sub'=>'c'],['role'=>'organizer','status'=>'active']],
        [['sub'=>'d'],['role'=>'admin','status'=>'inactive']], [['sub'=>'e'],null], [[],['role'=>'admin','status'=>'active']]] as [$claims,$profile]) {
        try {venue_geocode_require_admin($claims,$profile);$results[]='allowed';}catch(FirebaseBackendException $e){$results[]=$e->httpStatus;}}
        echo json_encode($results);`);
    assert.deepEqual(result,['allowed',403,403,403,403,401]);
});
test('query validation rejects unsupported actions and invalid coordinates; it never forwards arbitrary upstream parameters',()=>{
    const result=run(`$results=[]; foreach ([['action'=>'search','q'=>' x '],['action'=>'search','q'=>str_repeat('a',201)],
        ['action'=>'search','q'=>['x']],['action'=>'search','q'=>"Hall\nCity"],['action'=>'reverse','lat'=>91,'lon'=>0],
        ['action'=>'reverse','lat'=>1,'lon'=>181],['action'=>'reverse','lat'=>[],'lon'=>0],['action'=>'https://evil.example/']] as $input) {
        try {venue_geocode_query($input);$results[]='allowed';}catch(FirebaseBackendException $e){$results[]=$e->httpStatus;}}
        $results[]=venue_geocode_query(['action'=>'reverse','lat'=>'3.12345678','lon'=>'101.2','url'=>'https://evil.example','email'=>'private']);
        $results[]=venue_geocode_query(['action'=>'search','q'=>'  Merdeka Hall, Kuala Lumpur  ','limit'=>10000]);echo json_encode($results);`);
    assert.deepEqual(result.slice(0,8),Array(8).fill(400));
    assert.equal(result[8].params.lat,'3.123457');assert.equal(result[8].params.lon,'101.200000');assert.equal(result[8].params.url,undefined);
    assert.equal(result[9].params.q,'Merdeka Hall, Kuala Lumpur');assert.equal(result[9].params.limit,'5');
});
test('provider data is normalized to safe bounded venue fields and unnamed places use address components',()=>{
    const result=run(`echo json_encode(venue_geocode_normalize([
        ['lat'=>'3.1','lon'=>'101.7','display_name'=>'Hall address','name'=>'Named hall','extratags'=>['secret'=>'omit']],
        ['lat'=>'3.2','lon'=>'101.8','display_name'=>'Main Street, Town','address'=>['road'=>'Main Street']],
        ['lat'=>'999','lon'=>0,'display_name'=>'Invalid'], ['lat'=>0,'lon'=>0,'display_name'=>'']
    ],'search'));`);
    assert.deepEqual(result.results,[{name:'Named hall',address:'Hall address',latitude:3.1,longitude:101.7},
        {name:'Main Street',address:'Main Street, Town',latitude:3.2,longitude:101.8}]);
});
test('shared cache avoids duplicate upstream calls and distinct searches are spaced over one second apart',()=>temporaryFile(file=>{
    const result=run(`$starts=[];$transport=function($url)use(&$starts){$starts[]=microtime(true);return [['lat'=>'3','lon'=>'101','name'=>'Hall','display_name'=>'Hall, City']];};
        $query=venue_geocode_query(['action'=>'search','q'=>'Hall one']);
        $one=venue_geocode_cached($query,'https://nominatim.openstreetmap.org',${literal(file)},$transport);
        $two=venue_geocode_cached($query,'https://nominatim.openstreetmap.org',${literal(file)},$transport);
        venue_geocode_cached(venue_geocode_query(['action'=>'search','q'=>'Hall two']),'https://nominatim.openstreetmap.org',${literal(file)},$transport);
        echo json_encode(['same'=>$one===$two,'starts'=>$starts,'state'=>json_decode(file_get_contents(${literal(file)}),true)]);`);
    assert.equal(result.same,true);assert.equal(result.starts.length,2);assert.ok(result.starts[1]-result.starts[0]>=1.08);
    assert.equal(Object.keys(result.state.entries).length,2);
    for(const entry of Object.values(result.state.entries))assert.ok(entry.expires-Date.now()/1000>86390);
}));
test('cache expiry fetches fresh data and failed lookups retain the shared throttle',()=>temporaryFile(file=>{
    const result=run(`$query=venue_geocode_query(['action'=>'search','q'=>'Hall one']);
        $url='https://nominatim.openstreetmap.org/search?'.http_build_query($query['params'],'','&',PHP_QUERY_RFC3986);
        file_put_contents(${literal(file)},json_encode(['nextRequestAt'=>0,'entries'=>[hash('sha256',$url)=>['expires'=>time()-1,'response'=>['results'=>[]]]]]));
        $called=0;try {venue_geocode_cached($query,'https://nominatim.openstreetmap.org',${literal(file)},function()use(&$called){$called++;throw new RuntimeException('offline');});}catch(Throwable $e){}
        $state=json_decode(file_get_contents(${literal(file)}),true);echo json_encode(['called'=>$called,'throttled'=>$state['nextRequestAt']>microtime(true),'entries'=>$state['entries']]);`);
    assert.equal(result.called,1);assert.equal(result.throttled,true);assert.deepEqual(result.entries,[]);
}));
test('overlapping requests get a retry response instead of bypassing the shared lock',()=>temporaryFile(file=>{
    const result=run(`$lock=fopen(${literal(file)},'c+');flock($lock,LOCK_EX);try {
        venue_geocode_cached(venue_geocode_query(['action'=>'search','q'=>'Some Hall']),'https://nominatim.openstreetmap.org',${literal(file)},function(){throw new RuntimeException('must not run');});
        echo json_encode(['status'=>200]);}catch(FirebaseBackendException $e){echo json_encode(['status'=>$e->httpStatus]);}finally{flock($lock,LOCK_UN);fclose($lock);}`);
    assert.equal(result.status,429);
}));
test('public endpoint rejects missing authentication and non-POST requests before contacting any provider',()=>{
    for(const [method,status] of [['POST',401],['GET',405]]) {
        const result=JSON.parse(execFileSync(php,['-r',`$_SERVER['REQUEST_METHOD']=${literal(method)};require 'api/venue-geocoding.php';`],{cwd:root,encoding:'utf8'}));
        assert.equal(result.code,status===401?'unauthenticated':'method-not-allowed');
    }
});
