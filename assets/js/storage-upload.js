import { uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js';

function uploadError(error) {
    const messages = {
        'storage/unauthorized': 'Storage denied this upload. Check your administrator account and deployed Storage rules.',
        'storage/unauthenticated': 'Your session expired. Sign in again before uploading.',
        'storage/bucket-not-found': 'The configured Firebase Storage bucket does not exist. Configure Storage or use the documented local upload mode.',
        'storage/project-not-found': 'Firebase Storage is not configured for this project.',
        'storage/quota-exceeded': 'Firebase Storage quota is unavailable. Check the project storage and billing settings.',
        'storage/retry-limit-exceeded': 'Storage could not complete the upload. Check the connection and Firebase Storage setup, then retry.'
    };
    return new Error(messages[error?.code] || error?.message || 'The file could not be uploaded.');
}

// Bound both a stalled transfer and the download-URL lookup. Cancel the actual
// task on timeout so a retry cannot leave the previous upload running unseen.
export function uploadToStorage(objectRef, file, onStatus = () => {}) {
    return new Promise((resolve, reject) => {
        const task = uploadBytesResumable(objectRef, file, { contentType: file.type });
        let settled = false;
        let idleTimer;
        let lastBytes = -1;
        const finish = (error, url) => {
            if (settled) return;
            settled = true;
            clearTimeout(idleTimer);
            clearTimeout(totalTimer);
            if (error) reject(uploadError(error));
            else resolve(url);
        };
        const timeout = () => {
            finish(new Error('Upload timed out. Check your connection and that Firebase Storage is enabled for this project. Local XAMPP uploads require the separate setup in api/README.md.'));
            task.cancel();
        };
        const totalTimer = setTimeout(timeout, 120000);
        const resetIdle = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(timeout, 30000);
        };
        resetIdle();
        task.on('state_changed', snapshot => {
            if (settled) return;
            // Repeated retry notifications with zero new bytes are not progress.
            if (snapshot.bytesTransferred > lastBytes) {
                lastBytes = snapshot.bytesTransferred;
                resetIdle();
            }
            const percentage = snapshot.totalBytes ? Math.floor(snapshot.bytesTransferred / snapshot.totalBytes * 100) : 0;
            onStatus(`Uploading file: ${percentage}%`);
        }, error => finish(error), () => {
            if (settled) return;
            onStatus('Upload complete. Getting the file link...');
            resetIdle();
            getDownloadURL(task.snapshot.ref).then(url => finish(null, url), error => finish(error));
        });
    });
}
