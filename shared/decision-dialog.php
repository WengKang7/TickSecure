<?php
/** A standalone confirmation component, separate from page forms and modals. */
function ts_decision_head(string $base): string
{
    return '<link rel="stylesheet" href="'.ts_asset_url('assets/css/decision-dialog.css', $base).'">';
}

function ts_decision_dialog(string $base): string
{
    return '<dialog id="ts-decision-dialog" class="ts-decision" aria-labelledby="ts-decision-title" aria-describedby="ts-decision-message">
        <form id="ts-decision-form" novalidate>
            <div class="ts-decision-top"><span class="ts-decision-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="M12 8v5m0 3v.1"/></svg></span><button id="ts-decision-close" class="ts-decision-close" type="button" aria-label="Cancel and close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
            <p class="ts-decision-eyebrow">A moment to review</p>
            <h2 id="ts-decision-title">Confirm your decision</h2>
            <p id="ts-decision-message" class="ts-decision-message"></p>
            <section class="ts-decision-review" id="ts-decision-review" aria-label="Action details"><div id="ts-decision-subject" class="ts-decision-subject"></div><dl id="ts-decision-details" class="ts-decision-details" hidden></dl></section>
            <div id="ts-decision-fields" class="ts-decision-fields"></div>
            <footer class="ts-decision-footer"><button id="ts-decision-cancel" type="button" class="ts-decision-button ts-decision-cancel">Cancel</button><button id="ts-decision-submit" type="submit" class="ts-decision-button ts-decision-submit">Confirm</button></footer>
            <p class="ts-decision-hint">You can cancel or press Esc to go back.</p>
        </form>
    </dialog><script src="'.ts_asset_url('assets/js/decision-dialog.js', $base).'"></script>';
}
