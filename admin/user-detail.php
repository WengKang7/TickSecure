<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Ong Weng Kang', 'Buyer account · guan.hong@example.com', '<button class="ts-btn ts-btn-danger" data-modal-open="confirm-modal">Suspend Account</button>')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="flex justify-between">
            <div class="ts-card-title">Account Information</div>
            <?=ts_status('Active', 'success')?>
        </div>
        <div class="ts-detail-grid mt-12">
            <div class="ts-detail-item">
                <div class="ts-detail-label">Full Name</div>
                <div class="ts-detail-value">Ong Weng Kang</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Role</div>
                <div class="ts-detail-value">Buyer</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Email</div>
                <div class="ts-detail-value">guan.hong@example.com</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Email Verified</div>
                <div class="ts-detail-value">Yes</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Created</div>
                <div class="ts-detail-value">10 Jun 2026</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Failed Login Attempts</div>
                <div class="ts-detail-value">0</div>
            </div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Wallet & Ticket Summary</div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Connected Wallet</div>
            <div class="ts-detail-value ts-wallet-id">0x12A4…8F92</div>
        </div>
        <div class="ts-summary-row"><span>Current NFT Tickets</span><strong>3</strong></div>
        <div class="ts-summary-row"><span>Bookings</span><strong>5</strong></div>
        <div class="ts-summary-row"><span>Resale Transactions</span><strong>1</strong></div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Recent Activity</div>
            <div class="ts-card-sub">User-specific audited activity</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>Related Entity</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>17 Aug</td>
                    <td>Booking Confirmed</td>
                    <td>TS20260001</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td>17 Aug</td>
                    <td>NFT Mint</td>
                    <td>TS-TK-100184</td>
                    <td><?=ts_status('Confirmed', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td>16 Aug</td>
                    <td>Login</td>
                    <td>Account</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'User Details', 'users', $content, '..', '');
?>