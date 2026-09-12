<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="../index.php" class="small secondary">← Back to TickSecure</a>
<h1 class="ts-auth-title mt-24">Create your account</h1>
<p class="ts-auth-sub">Choose how you will use TickSecure.</p>
<input type="hidden" id="selected-role" name="role" value="buyer">
<div class="ts-role-choice mb-24">
    <div class="ts-role-card active" data-role="buyer">
        <?=ts_icon('ticket', 'ts-icon-lg')?><strong>Ticket Buyer</strong><span>Discover events, purchase secure tickets and manage resale.</span></div>
    <div class="ts-role-card" data-role="organizer">
        <?=ts_icon('building', 'ts-icon-lg')?><strong>Event Organizer</strong><span>Create events and manage ticket configuration after approval.</span></div>
</div>
<div class="ts-auth-fields" id="registration-form" novalidate>
    <div class="ts-field"><label class="ts-label" for="registration-name">Full Name</label><input class="ts-input" id="registration-name" name="fullName" autocomplete="name" maxlength="100" placeholder="Your full name" required>
    </div>
    <div class="ts-field"><label class="ts-label" for="registration-email">Email</label><input class="ts-input" id="registration-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254"
            placeholder="you@example.com" required></div>
    <div class="ts-form-grid">
        <div class="ts-field"><label class="ts-label" for="registration-password">Password</label><input class="ts-input" id="registration-password" name="password" type="password" autocomplete="new-password" maxlength="4096"
                placeholder="Create password" required></div>
        <div class="ts-field"><label class="ts-label" for="registration-password-confirmation">Confirm Password</label><input class="ts-input" id="registration-password-confirmation" name="confirmPassword" type="password" autocomplete="new-password" maxlength="4096"
                placeholder="Repeat password" required></div>
    </div>
<div
    id="organizer-fields"
    class="ts-card ts-card-pad"
    style="display: none;"
>
    <div class="ts-card-title">
        Organizer Profile
    </div>

    <p class="small muted">
        Provide information about your organization.
    </p>

    <div class="ts-auth-fields mt-16">

        <div class="ts-field">
            <label class="ts-label">
                Organization Name
            </label>

            <input
                class="ts-input"
                name="organizationName"
                maxlength="120"
                placeholder="Organization name"
                required
            >
        </div>


        <div class="ts-field">
            <label class="ts-label">
                Organization Description
            </label>

            <textarea
                class="ts-textarea"
                name="organizationDescription"
                maxlength="1000"
                placeholder="Tell us about your organization"
                required
            ></textarea>
        </div>


        <div class="ts-form-grid">

            <div class="ts-field">
                <label class="ts-label">
                    Organization Phone
                </label>

                <input
                    class="ts-input"
                    name="organizationPhone"
                    type="tel"
                    inputmode="tel"
                    maxlength="16"
                    placeholder="+60"
                    required
                >
            </div>


            <div class="ts-field">
                <label class="ts-label">
                    Organization Address
                </label>

                <input
                    class="ts-input"
                    name="organizationAddress"
                    maxlength="240"
                    placeholder="Business address"
                    required
                >
            </div>

        </div>

    </div>
</div>
    <div class="ts-check-row"><input type="checkbox" id="terms" name="terms"><label for="terms" class="small secondary">I agree to
            the Terms of Service and Privacy Notice.</label></div><button class="ts-btn ts-btn-primary w-full"
        id="reg-submit" type="button">Create Account</button>
</div>
<div class="ts-auth-footer">
    Already have an account?
    <a href="login.php">
        <strong>Sign in</strong>
    </a>
</div>


<script>
document.addEventListener('DOMContentLoaded', function () {

    const roleCards = document.querySelectorAll('.ts-role-card');
    const organizerFields = document.getElementById('organizer-fields');
    const selectedRole = document.getElementById('selected-role');


    roleCards.forEach(function (card) {

        card.addEventListener('click', function () {

            const role = card.dataset.role;


            // Remove active style from both cards
            roleCards.forEach(function (item) {
                item.classList.remove('active');
            });


            // Highlight selected card
            card.classList.add('active');


            // Update hidden role value
            selectedRole.value = role;


            // Show organizer fields only for organizer
            if (role === 'organizer') {
                organizerFields.style.display = 'block';
            } else {
                organizerFields.style.display = 'none';
            }

        });

    });

});
</script>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('reg-submit');
    const form = document.getElementById('registration-form');
    if(!submitBtn || !form) return;

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const V = window.tsValidation;
        if (!V) return;
        V.clearFieldErrors(form);

        const nameInput = V.el(form, 'fullName');
        const emailInput = V.el(form, 'email');
        const passInput = V.el(form, 'password');
        const confirmPassInput = V.el(form, 'confirmPassword');
        const role = document.getElementById('selected-role').value;
        const terms = document.getElementById('terms');

        const fullName = V.val(form, 'fullName');
        const email = V.val(form, 'email');
        const password = passInput?.value || '';
        const confirmPassword = confirmPassInput?.value || '';
        let valid = V.runAll([
            { check: () => V.validateFullName(fullName), el: nameInput },
            { check: () => V.validateMaxLength(fullName, 100, 'Full Name'), el: nameInput },
            { check: () => V.validateRequired(email, 'Email'), el: emailInput },
            { check: () => V.validateEmail(email), el: emailInput },
            { check: () => V.validatePassword(password), el: passInput },
            { check: () => V.validateRequired(confirmPassword, 'Confirm Password'), el: confirmPassInput }
        ]);
        if (password && confirmPassword && password !== confirmPassword) {
            V.showFieldError(confirmPassInput, 'Passwords do not match.');
            valid = false;
        }

        if (!['buyer', 'organizer'].includes(role)) {
            V.showGlobalError(form, 'Invalid account type', 'Choose either a buyer or organizer account and try again.');
            return;
        }

        const profileData = { fullName };
        if (role === 'organizer') {
            const orgNameInput = V.el(form, 'organizationName');
            const orgDescInput = V.el(form, 'organizationDescription');
            const orgPhoneInput = V.el(form, 'organizationPhone');
            const orgAddressInput = V.el(form, 'organizationAddress');
            const organizationName = V.val(form, 'organizationName');
            const organizationDescription = V.val(form, 'organizationDescription');
            const organizationPhone = V.val(form, 'organizationPhone');
            const organizationAddress = V.val(form, 'organizationAddress');

            valid = V.runAll([
                { check: () => V.validateMinLength(organizationName, 3, 'Organization Name'), el: orgNameInput },
                { check: () => V.validateMaxLength(organizationName, 120, 'Organization Name'), el: orgNameInput },
                { check: () => V.validateMinLength(organizationDescription, 10, 'Organization Description'), el: orgDescInput },
                { check: () => V.validateMaxLength(organizationDescription, 1000, 'Organization Description'), el: orgDescInput },
                { check: () => V.validatePhone(organizationPhone), el: orgPhoneInput },
                { check: () => V.validateMinLength(organizationAddress, 5, 'Organization Address'), el: orgAddressInput },
                { check: () => V.validateMaxLength(organizationAddress, 240, 'Organization Address'), el: orgAddressInput }
            ]) && valid;

            profileData.organizationName = organizationName;
            profileData.organizationDescription = organizationDescription;
            profileData.organizationPhone = organizationPhone;
            profileData.organizationAddress = organizationAddress;
        }

        if(!terms.checked) {
            V.showGlobalError(form, 'Terms required', 'You must agree to the Terms of Service and Privacy Notice.');
            valid = false;
        }

        if(!valid) return;
        
        submitBtn.textContent = "Creating Account...";
        submitBtn.disabled = true;
        
        try {
            await window.tsAuth.registerUser(email, password, role, profileData);
            window.location.href = `verify-email.php?email=${encodeURIComponent(email)}`;
        } catch (err) {
            V.showGlobalError(form, 'Registration Failed', err.message || 'Your account could not be created.');
            submitBtn.textContent = "Create Account";
            submitBtn.disabled = false;
        }
    });
});
</script>

<?php
$content = ob_get_clean();

render_auth_page(
    'Create Account',
    $content,
    '..'
);
?>
