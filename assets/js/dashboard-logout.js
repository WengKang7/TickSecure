(() => {
    const button = document.querySelector('.ts-logout-btn');
    if (!button) return;
    button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
            const profile = window.tsCurrentUser;
            if (!await window.tsDecision('logout', profile?.fullName || profile?.email || 'Your TickSecure session')) return;
            await window.tsAuth.logout();
        } catch (error) {
            window.tsShowToast?.(error.message || 'Unable to sign out. Please try again.');
        } finally { button.disabled = false; }
    });
})();
