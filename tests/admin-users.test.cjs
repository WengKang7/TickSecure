const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../admin/users.php'), 'utf8')
    .match(/<script type="module">([\s\S]*?)<\/script>/)[1];

const paginationUsers = [
    { id: 'faye', fullName: 'Faye', role: 'buyer', status: 'active', emailVerified: true },
    { id: 'glen', fullName: 'Glen', role: 'buyer', status: 'active', emailVerified: true }
];

async function loadPage(extraUsers = []) {
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
    for (const id of ['users-table-body', 'users-count', 'user-search', 'user-role-filter', 'user-status-filter', 'user-verification-filter', 'users-previous', 'users-next', 'users-page']) {
        elements.set(id, {
            value: '', innerHTML: '', textContent: '', listeners: {},
            addEventListener(type, callback) { this.listeners[type] = callback; },
            contains: () => true
        });
    }
    const actions = [];
    let load;
    let failLoad = false;
    const context = {
        console: { error() {} },
        document: { getElementById: id => elements.get(id) },
        prompt: () => 'Test reason', confirm: () => true, alert: message => { throw new Error(message); },
        window: {
            addEventListener: (_, callback) => { load = callback; },
            tsUsers: {
                getUsers: async () => {
                    if (failLoad) throw new Error('Service unavailable');
                    return users;
                },
                suspendUser: async (id, reason) => {
                    actions.push({ id, reason, action: 'suspend' });
                    users.find(user => user.id === id).status = 'suspended';
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
    return { elements, actions, filter, rows, action, navigate, reload: () => load({ detail: { role: 'admin' } }), fail: () => { failLoad = true; } };
}

test('the management list and count exclude administrator accounts', async () => {
    const page = await loadPage();
    assert.deepEqual(page.rows(), ['Alice', 'Bob', 'Claire', 'Drew', 'Erin']);
    assert.equal(page.elements.get('users-count').textContent, 'Showing 1–5 of 5 users');
    await page.action('admin', 'suspend');
    assert.deepEqual(page.actions, []);
});

test('each dropdown filters real records, including pending and rejected organizers', async () => {
    const page = await loadPage();
    page.filter('role', 'buyer');
    assert.deepEqual(page.rows(), ['Alice', 'Bob']);
    page.filter('role', 'organizer');
    assert.deepEqual(page.rows(), ['Claire', 'Drew', 'Erin']);
    page.filter('role', '');
    for (const [status, names] of [['active', ['Alice', 'Claire']], ['suspended', ['Bob']], ['pending', ['Drew']], ['rejected', ['Erin']]]) {
        page.filter('status', status);
        assert.deepEqual(page.rows(), names);
    }
    page.filter('status', '');
    page.filter('verification', 'verified');
    assert.deepEqual(page.rows(), ['Alice', 'Drew']);
    page.filter('verification', 'unverified');
    assert.deepEqual(page.rows(), ['Bob', 'Claire', 'Erin']);
});

test('search and all three dropdowns combine and clearing controls restores the list', async () => {
    const page = await loadPage();
    page.filter('search', '  ALICE@EXAMPLE.COM  ');
    page.filter('role', 'buyer');
    page.filter('status', 'active');
    page.filter('verification', 'verified');
    assert.deepEqual(page.rows(), ['Alice']);
    assert.equal(page.elements.get('users-count').textContent, 'Showing 1–1 of 1 users (filtered from 5)');
    page.filter('verification', 'unverified');
    assert.deepEqual(page.rows(), []);
    assert.match(page.elements.get('users-table-body').innerHTML, /No users match your filters/);
    assert.equal(page.elements.get('users-count').textContent, 'Showing 0 users (filtered from 5)');
    for (const name of ['search', 'role', 'status', 'verification']) page.filter(name, '');
    assert.equal(page.rows().length, 5);
});

test('suspend and reactivate refresh results while preserving the current filters', async () => {
    const page = await loadPage();
    page.filter('role', 'buyer');
    page.filter('status', 'active');
    await page.action('alice', 'suspend');
    assert.deepEqual(page.rows(), []);
    assert.equal(page.elements.get('user-status-filter').value, 'active');
    page.filter('status', 'suspended');
    assert.deepEqual(page.rows(), ['Alice', 'Bob']);
    await page.action('bob', 'reactivate');
    assert.deepEqual(page.rows(), ['Alice']);
    assert.equal(page.elements.get('user-role-filter').value, 'buyer');
    assert.equal(page.actions.length, 2);
});

test('a failed load replaces old rows with a visible error rather than stale results', async () => {
    const page = await loadPage();
    page.fail();
    await page.reload();
    assert.deepEqual(page.rows(), []);
    assert.match(page.elements.get('users-table-body').innerHTML, /Unable to load users/);
    page.filter('role', 'buyer');
    assert.deepEqual(page.rows(), []);
});

test('pagination shows at most five users per page and reaches every non-admin user', async () => {
    const page = await loadPage(paginationUsers);
    assert.deepEqual(page.rows(), ['Alice', 'Bob', 'Claire', 'Drew', 'Erin']);
    assert.equal(page.elements.get('users-previous').disabled, true);
    assert.equal(page.elements.get('users-next').disabled, false);
    assert.equal(page.elements.get('users-page').textContent, 'Page 1 of 2');
    const names = [...page.rows()];
    page.navigate('next');
    assert.deepEqual(page.rows(), ['Faye', 'Glen']);
    assert.equal(page.elements.get('users-count').textContent, 'Showing 6–7 of 7 users');
    names.push(...page.rows());
    assert.deepEqual(names, ['Alice', 'Bob', 'Claire', 'Drew', 'Erin', 'Faye', 'Glen']);
    assert.equal(page.elements.get('users-next').disabled, true);
    assert.equal(page.elements.get('users-page').textContent, 'Page 2 of 2');
    page.navigate('next');
    assert.deepEqual(page.rows(), ['Faye', 'Glen']);
    page.navigate('previous');
    assert.deepEqual(page.rows(), ['Alice', 'Bob', 'Claire', 'Drew', 'Erin']);
});

test('changing search or a dropdown returns to the first page of matching users', async () => {
    const page = await loadPage(paginationUsers);
    page.navigate('next');
    page.navigate('next');
    page.filter('role', 'buyer');
    assert.deepEqual(page.rows(), ['Alice', 'Bob', 'Faye', 'Glen']);
    assert.equal(page.elements.get('users-page').textContent, 'Page 1 of 1');
    assert.equal(page.elements.get('users-next').disabled, true);
    page.filter('role', '');
    page.navigate('next');
    page.filter('search', 'erin');
    assert.deepEqual(page.rows(), ['Erin']);
    assert.equal(page.elements.get('users-page').textContent, 'Page 1 of 1');
    page.filter('search', 'missing');
    assert.deepEqual(page.rows(), []);
    assert.equal(page.elements.get('users-previous').disabled, true);
    assert.equal(page.elements.get('users-next').disabled, true);
});
