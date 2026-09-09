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
<div class="ts-auth-fields">
    <div class="ts-field"><label class="ts-label">Full Name</label><input class="ts-input" placeholder="Your full name">
    </div>
    <div class="ts-field"><label class="ts-label">Email</label><input class="ts-input" type="email"
            placeholder="you@example.com"></div>
    <div class="ts-form-grid">
        <div class="ts-field"><label class="ts-label">Password</label><input class="ts-input" type="password"
                placeholder="Create password"></div>
        <div class="ts-field"><label class="ts-label">Confirm Password</label><input class="ts-input" type="password"
                placeholder="Repeat password"></div>
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
                placeholder="Organization name"
            >
        </div>


        <div class="ts-field">
            <label class="ts-label">
                Organization Description
            </label>

            <textarea
                class="ts-textarea"
                name="organizationDescription"
                placeholder="Tell us about your organization"
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
                    placeholder="+60"
                >
            </div>


            <div class="ts-field">
                <label class="ts-label">
                    Organization Address
                </label>

                <input
                    class="ts-input"
                    name="organizationAddress"
                    placeholder="Business address"
                >
            </div>

        </div>

    </div>
</div>
    <div class="ts-check-row"><input type="checkbox" id="terms"><label for="terms" class="small secondary">I agree to
            the Terms of Service and Privacy Notice.</label></div><button class="ts-btn ts-btn-primary w-full"
        id="reg-submit">Create Account</button>
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
    if(!submitBtn) return;

    const showError = (input, msg) => {
        input.style.borderColor = 'var(--error)';
        input.style.boxShadow = '0 0 0 3px var(--error-bg)';
        let errNode = input.parentElement.querySelector('.ts-error-msg');
        if (!errNode) {
            errNode = document.createElement('div');
            errNode.className = 'ts-error-msg small mt-8';
            errNode.style.color = 'var(--error)';
            errNode.style.fontWeight = '500';
            input.parentElement.appendChild(errNode);
        }
        errNode.textContent = msg;
        errNode.style.display = 'block';
    };

    const clearErrors = () => {
        document.querySelectorAll('.ts-input, .ts-textarea').forEach(el => {
            el.style.borderColor = '';
            el.style.boxShadow = '';
        });
        document.querySelectorAll('.ts-error-msg').forEach(el => el.style.display = 'none');
        const globalErr = document.getElementById('global-err');
        if(globalErr) globalErr.style.display = 'none';
    };

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearErrors();
        
        let hasError = false;

        const nameInput = document.querySelector('input[placeholder="Your full name"]');
        const emailInput = document.querySelector('input[type="email"]');
        const passInputs = document.querySelectorAll('input[type="password"]');
        const passInput = passInputs[0];
        const confirmPassInput = passInputs[1];
        const role = document.getElementById('selected-role').value;
        const terms = document.getElementById('terms');

        const fullName = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passInput.value;
        const confirmPassword = confirmPassInput.value;

        if(fullName.length === 0) {
            showError(nameInput, "Full name cannot be blank.");
            hasError = true;
        } else if(fullName.length < 3) {
            showError(nameInput, "Full name must be at least 3 characters.");
            hasError = true;
        } else if(!/^[a-zA-Z\s]+$/.test(fullName)) {
            showError(nameInput, "Full name must contain only letters and spaces (no numbers).");
            hasError = true;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)) {
            showError(emailInput, "Please enter a valid email address.");
            hasError = true;
        }

        const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if(!passRegex.test(password)) {
            showError(passInput, "Password must be 8+ chars and include uppercase, lowercase, number, and special character.");
            hasError = true;
        }

        if(password !== confirmPassword || confirmPassword === '') {
            showError(confirmPassInput, "Passwords do not match.");
            hasError = true;
        }

        const profileData = { fullName };
        if (role === 'organizer') {
            const orgNameInput = document.querySelector('[name="organizationName"]');
            const orgDescInput = document.querySelector('[name="organizationDescription"]');
            const orgPhoneInput = document.querySelector('[name="organizationPhone"]');
            const orgAddressInput = document.querySelector('[name="organizationAddress"]');

            if(orgNameInput.value.trim().length < 3) { showError(orgNameInput, "Organization name is required."); hasError = true; }
            if(orgDescInput.value.trim().length < 10) { showError(orgDescInput, "Please provide a more detailed description (min 10 chars)."); hasError = true; }
            if(!/^\+?[0-9]{8,15}$/.test(orgPhoneInput.value.trim())) { showError(orgPhoneInput, "Valid phone required (8-15 digits, optional +)."); hasError = true; }
            if(orgAddressInput.value.trim().length < 5) { showError(orgAddressInput, "Organization address is required."); hasError = true; }

            profileData.organizationName = orgNameInput.value.trim();
            profileData.organizationDescription = orgDescInput.value.trim();
            profileData.organizationPhone = orgPhoneInput.value.trim();
            profileData.organizationAddress = orgAddressInput.value.trim();
        }

        if(!terms.checked) {
            showError(terms.parentElement, "You must agree to the Terms of Service.");
            hasError = true;
        }

        if(hasError) return;
        
        submitBtn.textContent = "Creating Account...";
        submitBtn.disabled = true;
        
        try {
            await window.tsAuth.registerUser(email, password, role, profileData);
            await window.tsAuth.logout(); // Ensure they are signed out before redirecting
            if (role === 'organizer') {
                alert('Organizer account created successfully! Please wait for administrator approval before logging in.');
            } else {
                alert('Account created successfully! You can now log in.');
            }
            window.location.href = 'login.php'; // Redirect to Sign In page
        } catch (err) {
            let topErr = document.getElementById('global-err');
            if(!topErr) {
                topErr = document.createElement('div');
                topErr.id = 'global-err';
                topErr.className = 'ts-alert mb-24';
                topErr.style.backgroundColor = 'var(--error-bg)';
                topErr.style.color = 'var(--error)';
                topErr.style.border = '1px solid #F0B4AF';
                document.querySelector('.ts-auth-fields').prepend(topErr);
            }
            topErr.innerHTML = `<strong>Registration Failed</strong><div class="small mt-8">${err.message}</div>`;
            topErr.style.display = 'block';
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