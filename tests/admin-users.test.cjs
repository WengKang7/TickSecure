const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {execFileSync}=require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../admin/users.php'), 'utf8')
    .match(/<script type="module">([\s\S]*?)<\/script>/)[1];

const paginationUsers = [
    { id: 'faye', fullName: 'Faye', role: 'buyer', status: 'active', emailVerified: true },
    { id: 'glen', fullName: 'Glen', role: 'buyer', status: 'active', emailVerified: true },
    ...['Hal','Iris','Jade'].map(fullName=>({id:fullName.toLowerCase(),fullName,role:'buyer',status:'active',emailVerified:true}))
];

async function loadPage(extraUsers = [], accountRole = 'buyer') {
    const users = [
        { id: 'admin', fullName: 'System Administrator', role: 'admin', status: 'active', emailVerified: false },
        { id: 'alice', fullName: 'Alice', email: 'alice@example.com', role: 'buyer', status: 'active', emailVerified: true },
        { id: 'bob', fullName: 'Bob', email: 'bob@example.com', role: 'buyer', status: 'suspended', emailVerified: false },
        { id: 'claire', fullName: 'Claire', email: 'claire@example.com', role: 'organizer', status: 'active', emailVerified: false },
        { id: 'drew', fullName: 'Drew', email: 'drew@example.com', role: 'organizer', status: 'pending', emailVerified: true },
        { id: 'erin', fullName: 'Erin', email: 'erin@example.com', role: 'organizer', status: 'rejected' },
        ...extraUsers
    ];
    const elements = new Map();
    for (const id of ['users-table-body', 'users-count', 'user-search', 'user-status-filter', 'user-verification-filter', 'users-previous', 'users-next', 'users-page', 'users-export', 'users-print']) {
        elements.set(id, {
            dataset: {accountRole}, value: '', innerHTML: '', textContent: '', listeners: {},
            addEventListener(type, callback) { this.listeners[type] = callback; },
            contains: () => true
        });
    }
    const actions = [], requests = [], exports = [], blobs = [];
    let printed = 0;
    const confirmations = [];
    let confirmationResult = { reason: 'Test reason' };
    let load;
    let failLoad = false;
    const context = {
        console: { error() {} },
        document: { getElementById: id => elements.get(id), body: { append: element => exports.push(element) }, createElement: tag => ({ tag, click() {}, remove() {}, listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; }, style: {}, contentWindow: { addEventListener() {}, focus() {}, print() { printed++; } } }) },
        URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:report'; }, revokeObjectURL() {} }, Blob, setTimeout: callback => callback(),
        prompt: () => 'Test reason', confirm: () => true, alert: message => { throw new Error(message); },
        window: {
            addEventListener: (_, callback) => { load = callback; },
            tsAdminConfirm: async (action, subject) => {
                confirmations.push({ action, subject });
                return confirmationResult;
            },
            tsUsers: {
                getUsers: async filters => {
                    requests.push(filters);
                    if (failLoad) throw new Error('Service unavailable');
                    return users;
                },
                deleteUser: async id => {
                    actions.push({ id, action: 'delete' });
                    users.find(user => user.id === id).status = 'deleted';
                },
                reactivateUser: async id => {
                    actions.push({ id, action: 'reactivate' });
                    users.find(user => user.id === id).status = 'active';
                }
            }
        }
    };
    vm.runInNewContext(source, context);
    await load({ detail: { role: 'admin' } });
    const filter = (name, value) => {
        const id = name === 'search' ? 'user-search' : 'user-' + name + '-filter';
        const element = elements.get(id);
        element.value = value;
        element.listeners[name === 'search' ? 'input' : 'change']();
    };
    const rows = () => [...elements.get('users-table-body').innerHTML.matchAll(/<td class="cell-title">(.*?)<\/td>/g)].map(match => match[1]);
    const action = async (id, userAction) => {
        const button = { dataset: { id, userAction }, disabled: false };
        await elements.get('users-table-body').listeners.click({ target: { closest: () => button } });
    };
    const navigate = direction => elements.get('users-' + direction).listeners.click();
    return { elements, actions, requests, confirmations, exports, blobs, printed: () => printed, confirm: result => { confirmationResult = result; }, filter, rows, action, navigate, reload: () => load({ detail: { role: 'admin' } }), fail: () => { failLoad = true; } };
}


test('buyers and organizers have separate lists, counts and queries, with admin accounts excluded',async()=>{
    const buyers=await loadPage(),organizers=await loadPage([],'organizer');
    assert.deepEqual(buyers.rows(),['Alice','Bob']);assert.equal(buyers.elements.get('users-count').textContent,'Showing 1–2 of 2 users');
    assert.deepEqual(organizers.rows(),['Claire']);assert.equal(organizers.elements.get('users-count').textContent,'Showing 1–1 of 1 organizers');
    assert.equal(organizers.requests[0].status,'active');
    assert.equal(buyers.requests[0].role,'buyer');assert.equal(organizers.requests[0].role,'organizer');
    await buyers.action('admin','delete');await buyers.action('claire','delete');await organizers.action('alice','delete');
    assert.deepEqual(buyers.actions,[]);assert.deepEqual(organizers.actions,[]);
});

test('account status and verification filters stay within each list, excluding pending/rejected organizers',async()=>{
    const buyers=await loadPage(),organizers=await loadPage([],'organizer');
    for(const [page,cases] of [[buyers,[['active',['Alice']],['suspended',['Bob']],['pending',[]]]],[organizers,[['active',['Claire']],['pending',[]],['rejected',[]]]]]){
        for(const [status,names] of cases){page.filter('status',status);assert.deepEqual(page.rows(),names);}
        page.filter('status','');page.filter('verification','verified');assert.deepEqual(page.rows(),page===buyers?['Alice']:[]);
        page.filter('verification','unverified');assert.deepEqual(page.rows(),page===buyers?['Bob']:['Claire']);
    }
});

test('search combines with filters and clearing them restores only the selected account type',async()=>{
    const page=await loadPage();page.filter('search','  ALICE@EXAMPLE.COM  ');page.filter('status','active');page.filter('verification','verified');
    assert.deepEqual(page.rows(),['Alice']);assert.equal(page.elements.get('users-count').textContent,'Showing 1–1 of 1 users (filtered from 2)');
    page.filter('verification','unverified');assert.deepEqual(page.rows(),[]);assert.match(page.elements.get('users-table-body').innerHTML,/No users match your filters/);
    for(const name of ['search','status','verification'])page.filter(name,'');assert.deepEqual(page.rows(),['Alice','Bob']);
    const organizers=await loadPage([],'organizer');organizers.filter('search','alice');assert.deepEqual(organizers.rows(),[]);
});

test('buyer actions preserve filters and organizer deletion removes the account from the active list', async () => {
    const page = await loadPage(); page.filter('status', 'active'); await page.action('alice', 'delete');
    assert.deepEqual(page.rows(), []); assert.equal(page.elements.get('user-status-filter').value, 'active');
    await page.action('bob', 'reactivate'); assert.deepEqual(page.rows(), ['Bob']);
    const organizers = await loadPage([{id:'lara',fullName:'Lara',role:'organizer',status:'inactive'}], 'organizer');
    await organizers.action('lara', 'reactivate'); assert.deepEqual(organizers.actions, []);
    await organizers.action('claire', 'delete'); assert.deepEqual(organizers.rows(), []);
    assert.ok(organizers.requests.every(request => request.status === 'active'));
});

test('failed loads replace old rows with a visible error without restoring accounts from another list',async()=>{
    for(const role of ['buyer','organizer']){
        const page=await loadPage([],role);page.fail();await page.reload();assert.deepEqual(page.rows(),[]);
        assert.match(page.elements.get('users-table-body').innerHTML,/Unable to load/);page.filter('status','active');assert.deepEqual(page.rows(),[]);
    }
});

test('pagination reaches every account of the selected role and never includes the other role',async()=>{
    for(const role of ['buyer','organizer']){
        const extra=paginationUsers.map(user=>({...user,role})),page=await loadPage(extra,role);
        const expected=role==='buyer'?['Alice','Bob','Faye','Glen','Hal','Iris','Jade']:['Claire','Faye','Glen','Hal','Iris','Jade'];
        assert.deepEqual(page.rows(),expected.slice(0,5));assert.equal(page.elements.get('users-previous').disabled,true);
        page.navigate('next');assert.deepEqual(page.rows(),expected.slice(5));assert.equal(page.elements.get('users-next').disabled,true);
        page.navigate('next');assert.deepEqual(page.rows(),expected.slice(5));page.navigate('previous');assert.deepEqual(page.rows(),expected.slice(0,5));
    }
});

test('changing search or status returns to the first page of matching accounts',async()=>{
    const page=await loadPage(paginationUsers);page.navigate('next');page.filter('status','suspended');
    assert.deepEqual(page.rows(),['Bob']);assert.equal(page.elements.get('users-page').textContent,'Page 1 of 1');
    page.filter('status','');page.navigate('next');page.filter('search','alice');assert.deepEqual(page.rows(),['Alice']);
    page.filter('search','missing');assert.deepEqual(page.rows(),[]);assert.equal(page.elements.get('users-next').disabled,true);assert.equal(page.elements.get('users-previous').disabled,true);
});

test('cancelling account confirmation preserves the account status and current list',async()=>{
    const page=await loadPage();page.confirm(null);await page.action('alice','delete');await page.action('bob','reactivate');
    assert.deepEqual(page.actions,[]);assert.equal(page.confirmations[0].action,'deleteUser');assert.equal(page.confirmations[1].action,'reactivateUser');assert.deepEqual(page.rows(),['Alice','Bob']);
});

test('PHP pages and sidebar distinguish users, organizer accounts and organizer applications',()=>{
    const php=process.platform==='win32'?'C:/xampp/php/php.exe':'php';
    const buyer=execFileSync(php,['admin/users.php'],{encoding:'utf8'}),organizer=execFileSync(php,['admin/organizer-list.php'],{encoding:'utf8'});
    assert.match(buyer,/data-account-role="buyer"/);assert.match(organizer,/data-account-role="organizer"/);
    assert.match(organizer,/<h1[^>]*>Organizer Management<\/h1>/);assert.doesNotMatch(buyer+organizer,/id="user-role-filter"/);
    assert.match(organizer,/href="..\/admin\/organizer-list.php"/);assert.match(organizer,/Organizer Applications/);assert.match(organizer,/href="..\/admin\/organizers.php"/);
});


test('CSV export includes all filtered rows across pages and neutralizes spreadsheet formulas', async () => {
    const page = await loadPage([...paginationUsers, { id: 'formula', fullName: '=HYPERLINK("bad")', email: 'formula@example.com', role: 'buyer', status: 'active' }]);
    await page.elements.get('users-export').listeners.click();
    const csv = await page.blobs[0].text();
    assert.match(csv, /Alice/); assert.match(csv, /Jade/); assert.doesNotMatch(csv, /Claire|System Administrator|Last Activity/);
    assert.ok(csv.includes(`"'=HYPERLINK(""bad"")"`));
    assert.match(page.exports[0].download, /ticksecure-users-.*\.csv/);
    page.filter('search', 'Alice'); page.elements.get('users-export').listeners.click();
    assert.doesNotMatch(await page.blobs[1].text(), /Bob|Jade/);
    page.fail(); await page.reload(); page.elements.get('users-export').listeners.click(); assert.equal(page.blobs.length, 2);
});

test('print uses all filtered accounts and escapes user text in the report', async () => {
    const page = await loadPage([...paginationUsers, { id: 'html', fullName: '<script>bad()</script>', role: 'buyer' }]);
    page.elements.get('users-print').listeners.click();
    const frame = page.exports[0];
    assert.match(frame.srcdoc, /Jade/); assert.match(frame.srcdoc, /&lt;script&gt;/); assert.doesNotMatch(frame.srcdoc, /<script>|Claire|Last Activity/);
    frame.listeners.load(); assert.equal(page.printed(), 1);
    const org = await loadPage([], 'organizer'); org.elements.get('users-print').listeners.click();
    assert.match(org.exports[0].srcdoc, /Organizer Management/); assert.match(org.exports[0].srcdoc, /Claire/); assert.doesNotMatch(org.exports[0].srcdoc, /Drew|Erin|Alice/);
});


test('organizer applications query and display pending organizers only, including after approval or rejection', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../admin/organizers.php'), 'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    const records = [
        {id:'active',fullName:'Active Organizer',role:'organizer',status:'active'},
        {id:'pending',fullName:'Pending Organizer',role:'organizer',status:'pending'},
        {id:'rejected',fullName:'Rejected Organizer',role:'organizer',status:'rejected'},
        {id:'inactive',fullName:'Inactive Organizer',role:'organizer',status:'inactive'},
        {id:'buyer',fullName:'Pending Buyer',role:'buyer',status:'pending'}
    ];
    const elements = new Map(), requests = []; let load;
    vm.runInNewContext(source, { console, document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},window:{
        addEventListener:(_,callback)=>{load=callback;}, tsUsers:{getUsers:async filters=>{requests.push(filters);return records;}}
    }});
    await load();
    assert.equal(requests[0].role,'organizer'); assert.equal(requests[0].status,'pending');
    assert.match(elements.get('orgs-table-body').innerHTML,/Pending Organizer/);
    assert.doesNotMatch(elements.get('orgs-table-body').innerHTML,/Active Organizer|Rejected Organizer|Inactive Organizer|Pending Buyer/);
    for (const status of ['active','rejected']) {
        records[1].status=status; await load();
        assert.match(elements.get('orgs-table-body').innerHTML,/No pending organizer applications/);
    }
});
