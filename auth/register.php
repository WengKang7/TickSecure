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
        data-modal-open="confirm-modal">Create Account</button>
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


<?php
$content = ob_get_clean();

render_auth_page(
    'Create Account',
    $content,
    '..'
);
?>