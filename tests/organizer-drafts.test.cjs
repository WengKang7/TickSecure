const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'assets/js', name), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

class Element {
    constructor() { this.style = {}; this.listeners = {}; this.children = []; this.buttons = []; this.dataset = {}; this.attributes = new Map(); this.files = []; this.checked = false; this.hidden = false; this.value = ''; this.classList = { toggle() {}, add() {}, remove() {} }; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    removeAttribute(name) { this.attributes.delete(name); }
    set value(value) { this.rawValue = String(value ?? ''); }
    get value() { return this.rawValue; }
    get options() { return this.children; }
    set innerHTML(value) {
        this.html = value;
        this.buttons = [...value.matchAll(/data-(edit|remove)-category="(\d+)"/g)].map(match => {
            const button = new Element(); button.dataset[match[1] + 'Category'] = match[2]; return button;
        });
    }
    get innerHTML() { return this.html || ''; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    async dispatchEvent(event) { event.target ||= this; for (const callback of this.listeners[event.type] || []) await callback(event); }
    click() { return this.dispatchEvent({ type: 'click', currentTarget: this, target: this, preventDefault() {} }); }
    querySelectorAll(selector) { return this.buttons.filter(button => selector === 'button' || (selector === '[data-edit-category]' ? 'editCategory' : 'removeCategory') in button.dataset); }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = [...children]; }
    scrollIntoView(options) { this.scrollOptions = options; }
    focus(options) { this.focusOptions = options; this.onFocus?.(); }
}
const venue = { id: 'venue-1', name: 'Test hall', layoutStatus: 'ACTIVE', address: 'Test address', sections: [{ sectionId: 'A', name: 'Section A', seatCount: 10 }] };
const event = { id: 'event-1', organizerUid: 'organizer-1', status: 'DRAFT', name: 'Test show', description: 'A full event description', eventCategory: 'Concert',
    date: '2099-12-20', time: '20:00', venueId: venue.id, venueName: venue.name,
    categories: { A: { name: 'VIP', price: 100, quantity: 10 } }, maxTicketsPerBuyer: 4,
    salesStartDate: '2099-10-01T10:00', salesEndDate: '2099-12-19T20:00', resaleStartDate: '2099-11-01T10:00', resaleDeadline: '2099-12-19T20:00',
    maxResaleMarkup: 5, maxResalePrice: 0, transferEnabled: true, resaleEnabled: true };

async function configPage(overrides = {}, options = {}) {
    const php = fs.readFileSync(path.join(root, 'organizer/configuration.php'), 'utf8');
    let focused;
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => {
        const element = new Element();
        element.id = match[1];
        element.hidden = element.id.endsWith('-error');
        element.onFocus = () => { focused = element.id; };
        return [element.id, element];
    }));
    const handlers = {}, calls = { drafts: [], completed: [], submits: 0 };
    elements.get('configuration-review').hidden = true;
    const window = { location: { search: '?id=event-1', href: 'initial' }, tsCurrentUser: { uid: 'organizer-1' },
        addEventListener(type, callback) { handlers[type] = callback; }, tsShowToast() {}, tsVenueRenderer: { renderBoard() {} },
        tsDecision: async () => options.cancelDecision ? null : {},
        tsEvents: {
            getEvent: async () => ({ ...event, ...overrides }),
            saveConfigurationDraft: async (id, data) => { calls.drafts.push(clone(data)); },
            saveCompletedConfiguration: async (id, categories, rules) => { calls.completed.push(clone({ categories, rules })); },
            submitForApproval: async () => { calls.submits++; }
        }, tsVenues: { getVenue: async () => options.venue || venue }
    };
    const context = vm.createContext({ window, document: { getElementById: id => elements.get(id), querySelector: () => new Element(), createElement: () => new Element() }, URLSearchParams, Intl, Event: class { constructor(type) { this.type = type; } } });
    vm.runInContext(source('event-policy.js'), context);
    if (options.seatTools) {
        vm.runInContext(source('seat-category-model.js'), context);
        vm.runInContext(source('organizer-seat-categories.js'), context);
    }
    vm.runInContext(source('organizer-configuration.js'), context);
    await handlers['ts-auth-ready']();
    return { elements, calls, window, focused: () => focused, input: async (id, value) => { const element = elements.get(id); element.value = value; await element.dispatchEvent({ type: 'input' }); } };
}

const positionedVenue = { ...venue, sections: [{ sectionId: 'A', name: 'Main hall', seatCount: 12, geometry: {
    page: 1, imageWidth: 632, imageHeight: 710,
    seatMarkers: Array.from({ length: 12 }, (_, i) => ({ label: 'A' + (i + 1), row: 'A', number: String(i + 1), x: 10 + i * 3, y: 40 }))
} }] };
async function chooseRange(p, from, to) {
    await p.input('catSection', 'A');
    await p.elements.get('catSection').dispatchEvent({ type: 'change' });
    await p.input('category-from', 'A-' + from); await p.input('category-to', 'A-' + to);
    await p.elements.get('category-select-range').click();
}
test('organizer assigns two exact ranges in the same physical section and submits those seats', async () => {
    const p = await configPage({ categories: {} }, { venue: positionedVenue, seatTools: true });
    await chooseRange(p, 'A1', 'A3');
    await p.input('catName', 'VIP'); await p.input('catPrice', '200');
    assert.equal(p.elements.get('catQuantity').value, '3');
    await p.elements.get('add-cat-btn').click();
    await chooseRange(p, 'A4', 'A12');
    await p.input('catName', 'Standard'); await p.input('catPrice', '100');
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
    await p.elements.get('submit-config-btn').click();
    assert.equal(p.calls.submits, 1);
    const cats = p.calls.completed[0].categories;
    assert.equal(cats.length, 2);
    assert.notEqual(cats[0].sectionId, cats[1].sectionId);
    assert.deepEqual(cats[0].seatLabels, ['A-A1','A-A2','A-A3']);
    assert.deepEqual(cats[1].seatLabels, ['A-A4','A-A5','A-A6','A-A7','A-A8','A-A9','A-A10','A-A11','A-A12']);
});
test('unfinished exact-seat category survives Save Draft and reopening, including its colour', async () => {
    const p = await configPage({ categories: {} }, { venue: positionedVenue, seatTools: true });
    await chooseRange(p, 'A2', 'A5');
    await p.input('catName', 'VIP'); await p.input('category-color', '#4c9b98');
    await p.elements.get('save-config-draft').click();
    const draft = p.calls.drafts[0];
    assert.equal(draft.category.price, '');
    assert.deepEqual(draft.category.seatLabels, ['A-A2','A-A3','A-A4','A-A5']);
    const restored = await configPage({ categories: {}, configurationDraft: { rules: draft.rules, category: draft.category } }, { venue: positionedVenue, seatTools: true });
    assert.equal(restored.elements.get('catQuantity').value, '4');
    assert.equal(restored.elements.get('catName').value, 'VIP');
    assert.equal(restored.elements.get('category-color').value, '#4c9b98');
    await restored.elements.get('save-config-draft').click();
    assert.deepEqual(restored.calls.drafts[0].category.seatLabels, draft.category.seatLabels);
});
test('assigned seats are excluded from a new category range and remain editable in their original category', async () => {
    const category = { name: 'VIP', price: 200, quantity: 3, seatLabels: ['A-A1','A-A2','A-A3'], color: '#9170ca' };
    const p = await configPage({ categories: { CAT_VIP: category } }, { venue: positionedVenue, seatTools: true });
    await chooseRange(p, 'A1', 'A5');
    assert.equal(p.elements.get('catQuantity').value, '2');
    await p.elements.get('categories-tbody').querySelectorAll('[data-edit-category]')[0].click();
    assert.equal(p.elements.get('catQuantity').value, '3');
    await p.input('catPrice', '250');
    await p.elements.get('add-cat-btn').click();
    await p.elements.get('save-config-draft').click();
    assert.equal(p.calls.drafts[0].categories[0].sectionId, 'CAT_VIP');
    assert.deepEqual(p.calls.drafts[0].categories[0].seatLabels, category.seatLabels);
    assert.equal(p.calls.drafts[0].categories[0].price, 250);
});

test('Save Draft preserves unfinished rule/category fields and never submits or navigates', async () => {
    const p = await configPage();
    await p.input('salesStart', '');
    await p.input('maxTickets', '');
    await p.input('catName', 'Half written category');
    await p.elements.get('save-config-draft').click();
    assert.equal(p.calls.drafts[0].rules.salesStartDate, '');
    assert.equal(p.calls.drafts[0].rules.maxTicketsPerBuyer, '');
    assert.equal(p.calls.drafts[0].category.name, 'Half written category');
    assert.equal(p.calls.drafts[0].category.price, '');
    assert.equal(p.calls.submits, 0);
    assert.equal(p.calls.completed.length, 0);
    assert.equal(p.window.location.href, 'initial');
});

test('reopening a draft restores deliberately blank fields instead of replacing them with defaults', async () => {
    const p = await configPage({ configurationDraft: { category: { name: 'Unfinished', sectionId: 'A', price: '', quantity: '' },
        rules: { salesStartDate: '', salesEndDate: '', maxTicketsPerBuyer: '', maxResaleMarkup: '', maxResalePrice: '', resaleStartDate: '', resaleDeadline: '', resaleEnabled: false, transferEnabled: false } } });
    assert.equal(p.elements.get('catName').value, 'Unfinished');
    assert.equal(p.elements.get('maxTickets').value, '');
    assert.equal(p.elements.get('salesStart').value, '');
    assert.equal(p.elements.get('resaleEnabled').checked, false);
    assert.equal(p.elements.get('resaleStart').disabled, true);
    assert.equal(p.elements.get('transferEnabled').checked, false);
});

test('category edit/remove stays in the current draft and does not reload or write until Save Draft', async () => {
    const p = await configPage();
    await p.elements.get('categories-tbody').querySelectorAll('[data-edit-category]')[0].click();
    await p.input('catName', 'Front seats');
    await p.elements.get('add-cat-btn').click();
    assert.match(p.elements.get('categories-tbody').innerHTML, /Front seats/);
    assert.equal(p.calls.drafts.length, 0);
    await p.elements.get('save-config-draft').click();
    assert.equal(p.calls.drafts[0].categories[0].name, 'Front seats');
    await p.elements.get('categories-tbody').querySelectorAll('[data-remove-category]')[0].click();
    await p.elements.get('save-config-draft').click();
    assert.equal(p.calls.drafts[1].categories.length, 0);
});

test('returning to event details saves unfinished configuration before navigating', async () => {
    const p = await configPage();
    await p.input('catName', 'Pending');
    await p.elements.get('edit-event-details').click();
    assert.equal(p.calls.drafts[0].category.name, 'Pending');
    assert.equal(p.window.location.href, 'event-new.php?id=event-1');
    assert.equal(p.calls.submits, 0);
});

test('Review does not submit; only the separate final action submits valid complete configuration', async () => {
    const p = await configPage();
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
    assert.equal(p.calls.submits, 0);
    await p.elements.get('submit-config-btn').click();
    assert.equal(p.calls.submits, 1);
    assert.equal(p.calls.completed[0].rules.maxTicketsPerBuyer, 4);
    assert.equal(p.calls.completed[0].rules.maxResaleMarkup, 5);
    assert.equal(p.window.location.href, 'events.php');
});

test('review accepts the shown quantities without requiring all 250 seats in any section', async () => {
    const sections = ['A', 'B', 'C', 'D'].map(sectionId => ({ sectionId, name: 'Section ' + sectionId, seatCount: 250 }));
    const categories = Object.fromEntries([25, 100, 90, 159].map((quantity, index) => [sections[index].sectionId, { name: 'Category ' + index, price: 100, quantity }]));
    const p = await configPage({ categories }, { venue: { ...venue, sections } });
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
    assert.match(p.elements.get('categories-tbody').innerHTML, /25 tickets/);
    await p.elements.get('submit-config-btn').click();
    assert.deepEqual(p.calls.completed[0].categories.map(category => category.quantity), [25, 100, 90, 159]);
});

test('an organizer may sell only 25 tickets in one section and leave other sections entirely off sale', async () => {
    const p = await configPage({ categories: { A: { name: 'VIP', price: 100, quantity: 25 } } }, {
        venue: { ...venue, sections: [{ sectionId: 'A', name: 'A', seatCount: 250 }, { sectionId: 'B', name: 'B', seatCount: 250 }] }
    });
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
    await p.elements.get('submit-config-btn').click();
    assert.equal(p.calls.completed[0].categories.length, 1);
    assert.equal(p.calls.completed[0].categories[0].quantity, 25);
    assert.equal(p.calls.submits, 1);
});

test('an unchanged Edit selection or stale copy of a configured category never blocks review', async () => {
    const edited = await configPage();
    await edited.elements.get('categories-tbody').querySelectorAll('[data-edit-category]')[0].click();
    await edited.elements.get('review-config-btn').click();
    assert.equal(edited.elements.get('configuration-review').hidden, false);
    assert.equal(edited.elements.get('catName').value, '');
    const stale = await configPage({ configurationDraft: { category: { name: 'VIP', sectionId: 'A', price: '100.00', quantity: '10' } } });
    await stale.elements.get('review-config-btn').click();
    assert.equal(stale.elements.get('configuration-review').hidden, false);
});

test('review automatically includes a complete new category or an edited quantity without a separate Add click', async () => {
    const p = await configPage({ categories: {} });
    for (const [id, value] of [['catName', 'Standard'], ['catSection', 'A'], ['catPrice', '100'], ['catQuantity', '5']]) await p.input(id, value);
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
    assert.match(p.elements.get('review-category-summary').textContent, /Standard.*5 tickets/);
    assert.equal(p.calls.submits, 0);
    const edited = await configPage();
    await edited.elements.get('categories-tbody').querySelectorAll('[data-edit-category]')[0].click();
    await edited.input('catQuantity', '5');
    await edited.elements.get('review-config-btn').click();
    assert.equal(edited.elements.get('configuration-review').hidden, false);
    assert.match(edited.elements.get('review-category-summary').textContent, /5 tickets/);
});

test('choosing only a section does not block reviewing configured tickets, while over-capacity quantities are still rejected', async () => {
    const p = await configPage();
    await p.input('catSection', 'A');
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
    const over = await configPage();
    await over.elements.get('categories-tbody').querySelectorAll('[data-edit-category]')[0].click();
    await over.input('catQuantity', '11');
    await over.elements.get('review-config-btn').click();
    assert.equal(over.elements.get('configuration-review').hidden, true);
    assert.match(over.elements.get('catQuantity-error').textContent, /between 1 and 10/);
    assert.equal(over.focused(), 'catQuantity');
    assert.equal(over.elements.get('catQuantity').value, '11');
});

test('unfinished event details, categories, or invalid rule dates cannot be submitted', async () => {
    for (const [override, target] of [[{ name: '' }, 'edit-event-details'], [{ date: '2020-01-01' }, 'edit-event-details'], [{ categories: {} }, 'catName']]) {
        const p = await configPage(override);
        await p.elements.get('review-config-btn').click();
        assert.equal(p.elements.get(target === 'catName' ? 'catName-error' : 'config-error').hidden, false);
        assert.equal(p.focused(), target);
        assert.equal(p.elements.get('configuration-review').hidden, true);
        assert.equal(p.calls.submits, 0);
    }
    const p = await configPage();
    await p.input('resaleEnd', '2099-01-01T10:00');
    await p.elements.get('review-config-btn').click();
    assert.match(p.elements.get('resaleEnd-error').textContent, /Resale must close/);
    assert.equal(p.focused(), 'resaleEnd');
});

test('the sales-opening error appears below its field, scrolls to it, and gives it keyboard focus', async () => {
    const p = await configPage();
    await p.input('salesStart', '2020-01-01T10:00');
    await p.elements.get('review-config-btn').click();
    const input = p.elements.get('salesStart');
    assert.match(p.elements.get('salesStart-error').textContent, /Sales must open in the future/);
    assert.equal(p.elements.get('salesStart-error').hidden, false);
    assert.equal(p.elements.get('config-error').hidden, true);
    assert.equal(p.focused(), 'salesStart');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.match(input.getAttribute('aria-describedby'), /salesStart-error/);
    assert.equal(input.scrollOptions.block, 'center');
    assert.equal(input.focusOptions.preventScroll, true);
    await p.input('salesStart', event.salesStartDate);
    assert.equal(p.elements.get('salesStart-error').hidden, true);
    assert.equal(input.getAttribute('aria-invalid'), null);
    assert.equal(input.getAttribute('aria-describedby'), null);
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('configuration-review').hidden, false);
});

test('each sales/resale rule error targets its own field and only the first invalid input receives focus', async () => {
    for (const [field, value] of [['salesEnd', '2099-01-01T10:00'], ['maxTickets', '0'], ['resaleStart', '2099-01-01T10:00'],
        ['resaleEnd', '2099-01-01T10:00'], ['maxResaleMarkup', '101'], ['maxResalePrice', '0']]) {
        const p = await configPage();
        await p.input(field, value);
        await p.elements.get('review-config-btn').click();
        assert.equal(p.elements.get(`${field}-error`).hidden, false, field);
        assert.equal(p.focused(), field);
        assert.equal(p.elements.get('config-error').hidden, true);
    }
    const p = await configPage();
    await p.input('salesStart', '');
    await p.input('salesEnd', '');
    await p.elements.get('review-config-btn').click();
    assert.equal(p.focused(), 'salesStart');
    assert.equal(p.elements.get('salesEnd-error').hidden, true);
    await p.input('salesStart', event.salesStartDate);
    await p.elements.get('review-config-btn').click();
    assert.equal(p.focused(), 'salesEnd');
});

test('category errors appear on the relevant input and invalid stored categories open in Edit automatically', async () => {
    const name = await configPage();
    await name.input('catName', 'X');
    await name.elements.get('add-cat-btn').click();
    assert.equal(name.focused(), 'catName');
    assert.match(name.elements.get('catName-error').textContent, /2 to 80/);
    const stored = await configPage({ categories: { A: { name: 'VIP', price: 0, quantity: 10 } } });
    await stored.elements.get('review-config-btn').click();
    assert.equal(stored.focused(), 'catPrice');
    assert.equal(stored.elements.get('catPrice').value, '0');
    assert.equal(stored.elements.get('add-cat-btn').textContent, 'Update Category');
    assert.match(stored.elements.get('catPrice-error').textContent, /ticket price/);
});

test('turning off resale clears disabled rule errors and Save Draft still accepts incomplete fields', async () => {
    const p = await configPage();
    await p.input('maxResaleMarkup', '101');
    await p.elements.get('review-config-btn').click();
    assert.equal(p.elements.get('maxResaleMarkup-error').hidden, false);
    p.elements.get('resaleEnabled').checked = false;
    await p.elements.get('resaleEnabled').dispatchEvent({ type: 'change' });
    assert.equal(p.elements.get('maxResaleMarkup-error').hidden, true);
    assert.equal(p.elements.get('maxResaleMarkup').getAttribute('aria-invalid'), null);
    await p.input('salesStart', '');
    await p.elements.get('review-config-btn').click();
    await p.elements.get('save-config-draft').click();
    assert.equal(p.calls.drafts[0].rules.salesStartDate, '');
    assert.equal(p.elements.get('salesStart-error').hidden, true);
    assert.equal(p.calls.submits, 0);
});

test('draft configuration is never editable for another organizer or a non-draft event', async () => {
    for (const override of [{ organizerUid: 'another-organizer' }, { status: 'PUBLISHED' }]) {
        const p = await configPage(override);
        assert.match(p.elements.get('config-error').textContent, /own draft/);
        assert.equal(p.calls.drafts.length, 0);
    }
});

function policy(event) {
    const context = vm.createContext({ window: {}, Intl });
    vm.runInContext(source('event-policy.js'), context);
    return context.window.tsEventPolicy.describe(event);
}

test('buyer rules state exact resale caps, account conditions, limits, and dates in Malaysia time', () => {
    const summary = policy(event);
    assert.match(summary[0].text, /1 Oct 2099.*10:00 am.*UTC\+8/);
    assert.match(summary[1].text, /up to 4 tickets.*across all categories/);
    assert.match(summary[2].text, /email-verified.*connected wallet/);
    const resale = summary.find(item => item.title === 'Maximum resale price');
    assert.match(resale.text, /5%/);
    assert.match(resale.examples[0], /RM100\.00.*RM105\.00/);
    assert.match(resale.note, /service charge.*separately/);
    assert.match(policy({ ...event, maxResaleMarkup: 0 }).find(item => item.title === 'Maximum resale price').text, /cannot ask more/);
    assert.match(policy({ ...event, maxResalePrice: 90 }).find(item => item.title === 'Maximum resale price').examples[0], /RM90\.00/);
});

test('disabled resale hides irrelevant windows/caps, and date-only end dates include the end of the day', () => {
    const summary = policy({ ...event, resaleEnabled: false, transferEnabled: false, salesEndDate: '2099-12-19' });
    assert.ok(summary.some(item => item.title === 'Official resale is not allowed'));
    assert.equal(summary.some(item => item.title === 'Maximum resale price'), false);
    assert.match(summary[0].text, /19 Dec 2099.*11:59 pm/);
    assert.ok(summary.some(item => item.title === 'Ticket transfers are not allowed'));
});

async function editorPage(existing = null, options = {}) {
    const php = fs.readFileSync(path.join(root, 'organizer/event-new.php'), 'utf8');
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    let domReady, authReady;
    const calls = [], errors = [];
    const V = { clearFieldErrors() {}, showGlobalError: (_, title, message) => errors.push(message),
        val: (_, id) => elements.get(id)?.value || '', el: (_, id) => elements.get(id),
        runAll: checks => checks.every(item => item.check().valid),
        validateRequired: value => ({ valid: Boolean(value) }), validateMinLength: (value, length) => ({ valid: value.length >= length }),
        validateMaxLength: (value, length) => ({ valid: value.length <= length }), validateSelect: value => ({ valid: Boolean(value) }),
        validateFileType: () => ({ valid: true }), validateFileSize: () => ({ valid: true }) };
    const window = { location: { search: existing ? '?id=event-1' : '', href: 'http://localhost/ticksecure-ui/organizer/event-new.php' }, history: { replaceState() {} },
        addEventListener: (_, callback) => { authReady = callback; }, tsDecision: async () => options.cancelDecision ? null : {}, tsValidation: V, tsShowToast() {},
        tsUsers: { getCurrentProfile: async () => ({ id: 'organizer-1', fullName: 'Test organizer' }) },
        tsVenues: { getActiveVenues: async () => [venue, { ...venue, id: 'venue-2', name: 'Second hall' }] },
        tsEvents: { getEvent: async () => existing,
            createEvent: async data => { calls.push(clone(data)); return 'new-event'; },
            updateEvent: async (id, data) => { calls.push(clone(data)); }, uploadPoster: options.uploadPoster || (async () => {}) }
    };
    vm.runInNewContext(source('organizer-event-editor.js'), { window, document: {
        getElementById: id => elements.get(id), querySelector: () => new Element(), createElement: () => new Element(), addEventListener: (_, callback) => { domReady = callback; }
    }, URL, URLSearchParams, Event: class { constructor(type) { this.type = type; } }, console: { error() {} } });
    domReady();
    await authReady();
    return { elements, calls, errors, window };
}

test('the basic editor saves a name-only draft with missing date/venue instead of forcing every step', async () => {
    const p = await editorPage();
    p.elements.get('eventName').value = 'Work in progress';
    await p.elements.get('save-event-draft').click();
    assert.equal(p.calls[0].name, 'Work in progress');
    assert.equal(p.calls[0].venueId, '');
    assert.equal(p.calls[0].date, '');
    assert.equal(p.calls[0].eventCategory, '');
    assert.equal(p.errors.length, 0);
    assert.match(p.window.location.href, /event-new.php$/);
    assert.match(p.elements.get('event-draft-status').textContent, /not been submitted/);
});

test('the editor reopens name and venue, and changing a venue clears only its mapped categories', async () => {
    const p = await editorPage({ ...event, configurationDraft: { category: { name: 'Pending' }, rules: { salesStartDate: '' } } });
    assert.equal(p.elements.get('eventName').value, event.name);
    assert.equal(p.elements.get('venue-select').value, venue.id);
    p.elements.get('eventName').value = 'Updated show';
    p.elements.get('venue-select').value = 'venue-2';
    await p.elements.get('save-event-draft').click();
    assert.equal(p.calls[0].name, 'Updated show');
    assert.equal(p.calls[0].venueId, 'venue-2');
    assert.deepEqual(p.calls[0].categories, {});
    assert.deepEqual(p.calls[0].configurationDraft.category, {});
    assert.equal(p.calls[0].configurationDraft.rules.salesStartDate, '');
});

test('Continue still validates required event details and does not advance an incomplete draft', async () => {
    const p = await editorPage();
    p.elements.get('eventName').value = 'Incomplete';
    await p.elements.get('create-event-btn').click();
    assert.equal(p.calls.length, 0);
    assert.ok(p.errors.length);
    assert.match(p.window.location.href, /event-new.php$/);
});

test('poster failure leaves saved event details intact and retains the selected file for retry', async () => {
    let attempts = 0;
    const p = await editorPage(event, { uploadPoster: async () => { if (++attempts === 1) throw Error('Image service unavailable'); } });
    const file = { name: 'images.jpg', type: 'image/jpeg', size: 100 };
    p.elements.get('poster-upload').files = [file];
    p.elements.get('eventName').value = 'Updated name';
    await p.elements.get('save-event-draft').click();
    assert.equal(p.calls[0].name, 'Updated name');
    assert.match(p.errors[0], /event details were saved.*poster upload failed/);
    assert.equal(p.elements.get('poster-upload').files[0], file);
    assert.match(p.elements.get('event-draft-status').textContent, /poster has not been saved/);
    assert.equal(p.elements.get('save-event-draft').disabled, false);
    await p.elements.get('save-event-draft').click();
    assert.equal(attempts, 2);
    assert.match(p.elements.get('event-draft-status').textContent, /Draft saved/);
});


test('cancelling event submission leaves the review open and writes no completed configuration', async () => {
    const p = await configPage({}, { cancelDecision: true });
    await p.elements.get('review-config-btn').click();
    await p.elements.get('submit-config-btn').click();
    assert.equal(p.calls.submits, 0);
    assert.equal(p.calls.completed.length, 0);
    assert.equal(p.elements.get('configuration-review').hidden, false);
    assert.equal(p.elements.get('submit-config-btn').disabled, false);
});
