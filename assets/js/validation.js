/**
 * TickSecure — Shared Validation Library
 * Client-side validation helpers used by all forms and CRUD services.
 * Exposed globally as window.tsValidation.
 */

// ============================================================
// FIELD VALIDATORS — each returns { valid: boolean, error: string|null }
// ============================================================

export function validateRequired(value, fieldName) {
    const v = typeof value === 'string' ? value.trim() : value;
    if (!v && v !== 0 && v !== false) return { valid: false, error: `${fieldName} is required.` };
    return { valid: true, error: null };
}

export function validateMinLength(value, min, fieldName) {
    if (typeof value !== 'string' || value.trim().length < min)
        return { valid: false, error: `${fieldName} must be at least ${min} characters.` };
    return { valid: true, error: null };
}

export function validateMaxLength(value, max, fieldName) {
    if (typeof value === 'string' && value.trim().length > max)
        return { valid: false, error: `${fieldName} must not exceed ${max} characters.` };
    return { valid: true, error: null };
}

export function validateEmail(email) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return { valid: false, error: 'Please enter a valid email address.' };
    return { valid: true, error: null };
}

export function validatePassword(password) {
    if (!password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password))
        return { valid: false, error: 'Password must be 8+ characters with uppercase, lowercase, number, and special character.' };
    return { valid: true, error: null };
}

export function validateFullName(name) {
    const t = (name || '').trim();
    if (!t) return { valid: false, error: 'Full name is required.' };
    if (t.length < 3) return { valid: false, error: 'Full name must be at least 3 characters.' };
    if (t.length > 100) return { valid: false, error: 'Full name must not exceed 100 characters.' };
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(t)) {
        return { valid: false, error: 'Full name may contain letters, spaces, apostrophes, periods and hyphens only.' };
    }
    return { valid: true, error: null };
}

export function validatePhone(phone) {
    if (!phone || !/^\+?[0-9]{8,15}$/.test(phone.trim()))
        return { valid: false, error: 'Enter a valid phone number (8–15 digits, optional +).' };
    return { valid: true, error: null };
}

export function validatePrice(price, min = 1, max = 99999) {
    const text = String(price ?? '').trim();
    const minimum = Number.isFinite(Number(min)) ? Number(min) : 1;
    const maximum = Number.isFinite(Number(max)) ? Number(max) : 99999;
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        return { valid: false, error: 'Price must be a valid amount with no more than 2 decimal places.' };
    }
    const num = Number(text);
    if (!Number.isFinite(num) || num < minimum || num > maximum) {
        return { valid: false, error: `Price must be between RM ${minimum} and RM ${maximum}.` };
    }
    return { valid: true, error: null };
}

export function validateQuantity(qty, min = 1, max = 100000) {
    const text = String(qty ?? '').trim();
    const minimum = Number.isFinite(Number(min)) ? Number(min) : 1;
    const maximum = Number.isFinite(Number(max)) ? Number(max) : 100000;
    if (!/^\d+$/.test(text)) {
        return { valid: false, error: 'Quantity must be a whole number.' };
    }
    const num = Number(text);
    if (!Number.isSafeInteger(num) || num < minimum || num > maximum) {
        return { valid: false, error: `Quantity must be between ${minimum} and ${maximum}.` };
    }
    return { valid: true, error: null };
}

export function validateFutureDate(dateStr, fieldName = 'Date') {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { valid: false, error: `${fieldName} is invalid.` };
    if (d <= new Date()) return { valid: false, error: `${fieldName} must be in the future.` };
    return { valid: true, error: null };
}

export function validateDateRange(startStr, endStr) {
    const s = new Date(startStr), e = new Date(endStr);
    if (isNaN(s.getTime())) return { valid: false, error: 'Start date is invalid.' };
    if (isNaN(e.getTime())) return { valid: false, error: 'End date is invalid.' };
    if (e <= s) return { valid: false, error: 'End date must be after start date.' };
    return { valid: true, error: null };
}

export function validateWalletAddress(address) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address.trim()))
        return { valid: false, error: 'Enter a valid Ethereum wallet address (0x followed by 40 hex characters).' };
    return { valid: true, error: null };
}

export function validateFileType(file, allowedTypes = ['image/png', 'image/jpeg']) {
    if (!file) return { valid: false, error: 'No file selected.' };
    if (!allowedTypes.includes(file.type)) {
        const names = allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
        return { valid: false, error: `File must be: ${names}.` };
    }
    return { valid: true, error: null };
}

export function validateFileSize(file, maxBytes = 5 * 1024 * 1024) {
    if (!file) return { valid: false, error: 'No file selected.' };
    if (file.size > maxBytes) {
        const mb = (maxBytes / (1024 * 1024)).toFixed(0);
        return { valid: false, error: `File size must not exceed ${mb} MB.` };
    }
    return { valid: true, error: null };
}

export function validateSelect(value, fieldName) {
    if (!value || value === '' || value === '-- Select --')
        return { valid: false, error: `Please select a ${fieldName}.` };
    return { valid: true, error: null };
}

/**
 * Validate normal user-entered text without silently accepting control
 * characters or whitespace-only values. This is used for names,
 * descriptions, and administrator reasons.
 */
export function validateText(value, fieldName, min = 1, max = 5000, options = {}) {
    const text = String(value ?? '').trim();
    if (!text && options.allowBlank) return { valid: true, error: null };
    if (!text) return { valid: false, error: `${fieldName} is required.` };
    if (text.length < min) return { valid: false, error: `${fieldName} must be at least ${min} characters.` };
    if (text.length > max) return { valid: false, error: `${fieldName} must not exceed ${max} characters.` };
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
        return { valid: false, error: `${fieldName} contains unsupported control characters.` };
    }
    return { valid: true, error: null };
}

export function validatePercentage(value, fieldName = 'Percentage', min = 0, max = 100) {
    const text = String(value ?? '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        return { valid: false, error: `${fieldName} must be a number with no more than 2 decimal places.` };
    }
    const number = Number(text);
    if (!Number.isFinite(number) || number < min || number > max) {
        return { valid: false, error: `${fieldName} must be between ${min} and ${max}.` };
    }
    return { valid: true, error: null };
}

export function validateDateTimeAfter(startStr, endStr, startName = 'Start date', endName = 'End date') {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (Number.isNaN(start.getTime())) return { valid: false, error: `${startName} is invalid.` };
    if (Number.isNaN(end.getTime())) return { valid: false, error: `${endName} is invalid.` };
    if (end <= start) return { valid: false, error: `${endName} must be after ${startName.toLowerCase()}.` };
    return { valid: true, error: null };
}

export function validateCardholderName(value) {
    const text = String(value ?? '').trim();
    if (text.length < 3 || text.length > 100) {
        return { valid: false, error: 'Cardholder name must be between 3 and 100 characters.' };
    }
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(text)) {
        return { valid: false, error: 'Cardholder name may contain letters, spaces, apostrophes, periods and hyphens only.' };
    }
    return { valid: true, error: null };
}

export function validateCardNumber(value) {
    const digits = String(value ?? '').replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(digits)) return { valid: false, error: 'Enter a valid card number.' };
    let sum = 0;
    let doubleDigit = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
        let digit = Number(digits[index]);
        if (doubleDigit) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0
        ? { valid: true, error: null }
        : { valid: false, error: 'Enter a valid card number.' };
}

export function validateCardExpiry(value) {
    const match = String(value ?? '').trim().match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/);
    if (!match) return { valid: false, error: 'Enter expiry as MM/YY.' };
    const month = Number(match[1]);
    const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
    const expiry = new Date(year, month, 1);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
        return { valid: false, error: 'The card expiry date must be in the future.' };
    }
    return { valid: true, error: null };
}

export function validateCvv(value) {
    return /^\d{3,4}$/.test(String(value ?? '').trim())
        ? { valid: true, error: null }
        : { valid: false, error: 'Security code must contain 3 or 4 digits.' };
}

// ============================================================
// DOM ERROR DISPLAY — matches TickSecure design system
// ============================================================

export function showFieldError(inputEl, message) {
    if (!inputEl || !inputEl.parentElement) return;
    inputEl.style.borderColor = 'var(--error)';
    inputEl.style.boxShadow = '0 0 0 3px var(--error-bg)';
    let node = inputEl.parentElement.querySelector('.ts-error-msg');
    if (!node) {
        node = document.createElement('div');
        node.className = 'ts-error-msg small mt-8';
        node.style.color = 'var(--error)';
        node.style.fontWeight = '500';
        inputEl.parentElement.appendChild(node);
    }
    node.textContent = message;
    node.style.display = 'block';
}

export function clearFieldErrors(container) {
    if (!container) container = document;
    container.querySelectorAll('.ts-input, .ts-textarea, .ts-select').forEach(el => {
        el.style.borderColor = '';
        el.style.boxShadow = '';
    });
    container.querySelectorAll('.ts-error-msg').forEach(el => el.style.display = 'none');
    const g = container.querySelector('.ts-global-error');
    if (g) g.style.display = 'none';
}

export function showGlobalError(container, title, message) {
    if (!container) return;
    let el = container.querySelector('.ts-global-error');
    if (!el) {
        el = document.createElement('div');
        el.className = 'ts-global-error ts-alert mb-24';
        el.style.cssText = 'background:var(--error-bg);color:var(--error);border:1px solid #F0B4AF';
        container.prepend(el);
    }
    el.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = String(title || 'Error');
    const detail = document.createElement('div');
    detail.className = 'small mt-8';
    detail.textContent = String(message || 'Please review the highlighted fields and try again.');
    el.append(heading, detail);
    el.style.display = 'block';
}

export function showGlobalSuccess(container, title, message) {
    if (!container) return;
    let el = container.querySelector('.ts-global-success');
    if (!el) {
        el = document.createElement('div');
        el.className = 'ts-global-success ts-alert ts-alert-success mb-24';
        container.prepend(el);
    }
    el.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = String(title || 'Success');
    const detail = document.createElement('div');
    detail.className = 'small mt-8';
    detail.textContent = String(message || 'Your changes have been saved.');
    el.append(heading, detail);
    el.style.display = 'block';
}

/**
 * Run an array of validations and display errors.
 * @param {Array<{check: Function, el: Element|null}>} rules
 * @returns {boolean} true if ALL passed
 */
export function runAll(rules) {
    let ok = true;
    for (const { check, el } of rules) {
        const r = check();
        if (!r.valid) {
            ok = false;
            if (el) showFieldError(el, r.error);
        }
    }
    return ok;
}

/**
 * Helper: read a value from a form element by name within a container.
 */
export function val(container, name) {
    const el = container.querySelector(`[name="${name}"]`);
    return el ? (el.value || '').trim() : '';
}

export function el(container, name) {
    return container.querySelector(`[name="${name}"]`);
}

// ============================================================
// Expose globally
// ============================================================
window.tsValidation = {
    validateRequired, validateMinLength, validateMaxLength,
    validateEmail, validatePassword, validateFullName, validatePhone,
    validatePrice, validateQuantity, validateFutureDate, validateDateRange,
    validateWalletAddress, validateFileType, validateFileSize, validateSelect,
    validateText, validatePercentage, validateDateTimeAfter,
    validateCardholderName, validateCardNumber, validateCardExpiry, validateCvv,
    showFieldError, clearFieldErrors, showGlobalError, showGlobalSuccess,
    runAll, val, el
};
