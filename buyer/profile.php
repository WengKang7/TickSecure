<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1050px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Account</div>
                <h1 class="ts-section-title">Profile & Security</h1>
                <p class="ts-section-copy">Manage personal information, password security and connected wallet status.
                </p>
            </div><button class="ts-btn ts-btn-primary" data-toast="Profile UI changes saved">Save Changes</button>
        </div>
        <div class="ts-grid-2">
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Personal Information</div>
                <div class="ts-auth-fields mt-20">
                    <div class="ts-field"><label class="ts-label">Full Name</label><input class="ts-input"
                            value="Ong Weng Kang"></div>
                    <div class="ts-field"><label class="ts-label">Email</label><input class="ts-input"
                            value="guan.hong@example.com"></div>
                    <div class="ts-alert ts-alert-success">
                        <?=ts_icon('check')?>
                        Email verified</div>
                </div>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Connected Wallet</div>
                <div class="ts-wallet-card mt-20">
                    <div><strong>MetaMask</strong>
                        <div class="ts-wallet-id mt-8">0x12A4…8F92</div>
                    </div>
                    <?=ts_status('Connected', 'success')?>
                </div><button class="ts-btn ts-btn-secondary w-full mt-16">Disconnect Wallet</button>
                <div class="small muted mt-12">Wallet ownership is shown separately from personal identity information.
                </div>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Password & Security</div>
                <p class="secondary">Update your account password and review account security status.</p><a
                    class="ts-btn ts-btn-secondary" href="../auth/reset-password.php">Change Password</a>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Account Status</div>
                <div class="flex justify-between items-center mt-20"><span>Buyer
                        Account</span><?=ts_status('Active', 'success')?>
                </div>
                <div class="flex justify-between items-center mt-16"><span>Email
                        Verification</span><?=ts_status('Verified', 'success')?>
                </div>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Buyer Profile', 'tickets', $content, '..', true);
?>