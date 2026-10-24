const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const validationContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/validation.js'), 'utf8').replace(/\bexport /g, ''), validationContext);
const validators = validationContext.window.tsValidation;
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config/password-policy.json'), 'utf8'));
const supportedSymbols = '^$*.[]{}()?"!@#%&/\\,><\':;|_~`-';

test('shared registration/reset validation requires every configured password characteristic', () => {
    assert.equal(policy.enforcementState, 'ENFORCE');
    for (const password of ['', 'Ab1!', 'abcdef1!', 'ABCDEF1!', 'Abcdefgh!', 'Abcdef12', 'Abcdef1 ', 'Abcdef1+']) {
        assert.equal(validators.validatePassword(password).valid, false);
    }
    for (const password of ['Abcdef1!', 'Register1#', 'Password1-', ' Abcdef1! ']) {
        assert.equal(validators.validatePassword(password).valid, true);
    }
    const { minLength, maxLength } = policy.constraints;
    assert.equal(validators.validatePassword('Ab1!' + 'x'.repeat(minLength - 4)).valid, true);
    assert.equal(validators.validatePassword('Ab1!' + 'x'.repeat(maxLength - 4)).valid, true);
    assert.equal(validators.validatePassword('Ab1!' + 'x'.repeat(maxLength - 3)).valid, false);
    for (const key of ['requireUppercase', 'requireLowercase', 'requireNumeric', 'requireNonAlphanumeric']) {
        assert.equal(policy.constraints[key], true);
    }
});

test('registration and local reset recognize all symbols exposed by Firebase password policy', () => {
    for (const symbol of supportedSymbols) {
        assert.equal(validators.validatePassword('Abcdef1' + symbol).valid, true, 'Supported symbol ' + symbol);
    }
});

function resetForm(password, confirmation = password, search = '?oobCode=test-reset-code') {
    const source = fs.readFileSync(path.join(root, 'auth/reset-password.php'), 'utf8')
        .match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, '');
    const input = { newPassword: { value: password }, confirmPassword: { value: confirmation } };
    const errors = [];
    const updates = [];
    let submit;
    const button = { disabled: false, addEventListener: (_, callback) => { submit = callback; } };
    const V = {
        ...validators,
        el: (_, name) => input[name],
        clearFieldErrors() {},
        showFieldError: (_, message) => errors.push(message),
        showGlobalError: (_, title, message) => errors.push(message),
        showGlobalSuccess() {},
        runAll: rules => {
            let valid = true;
            for (const rule of rules) {
                const result = rule.check();
                if (!result.valid) { errors.push(result.error); valid = false; }
            }
            return valid;
        }
    };
    const context = {
        URLSearchParams,
        setTimeout() {},
        confirmPasswordReset: async (_, code, value) => updates.push({ code, value }),
        document: {
            addEventListener: (_, callback) => callback(),
            getElementById: id => id === 'update-btn' ? button : {}
        },
        window: { location: { search }, tsValidation: V, tsFirebase: { auth: {} } }
    };
    vm.runInNewContext(source, context);
    return { button, errors, updates, submit: () => submit({ preventDefault() {} }) };
}

test('the reset form blocks weak passwords and mismatched confirmation before calling Firebase', async () => {
    for (const password of ['short', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoNumbersHere!', 'NoSymbols123']) {
        const form = resetForm(password);
        await form.submit();
        assert.equal(form.updates.length, 0);
        assert.ok(form.errors.length > 0);
    }
    const mismatch = resetForm('Abcdef1!', 'Different1!');
    await mismatch.submit();
    assert.equal(mismatch.updates.length, 0);
    assert.match(mismatch.errors[0], /do not match/);
});

test('the reset form submits the exact accepted password without trimming it', async () => {
    for (const password of ['Abcdef1!', 'Password1#', ' Abcdef1! ']) {
        const form = resetForm(password);
        await form.submit();
        assert.deepEqual(form.updates, [{ code: 'test-reset-code', value: password }]);
        assert.deepEqual(form.errors, []);
    }
});

test('a missing reset token cannot submit a password change', () => {
    const form = resetForm('Abcdef1!', 'Abcdef1!', '');
    assert.equal(form.button.disabled, true);
    assert.match(form.errors[0], /missing reset token/);
    assert.equal(form.updates.length, 0);
});
