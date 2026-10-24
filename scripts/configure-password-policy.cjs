// Trusted CLI maintenance only; this file is never invoked by the PHP API.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const firebaseRequire = require('node:module').createRequire(path.join(root, 'functions/package.json'));
const { initializeApp, cert } = firebaseRequire('firebase-admin/app');
const { getAuth } = firebaseRequire('firebase-admin/auth');

async function main() {
    const apply = process.argv.includes('--apply');
    if (process.argv.slice(2).some(argument => argument !== '--apply')) throw new Error('Usage: node scripts/configure-password-policy.cjs [--apply]');
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const config = JSON.parse(execFileSync(php, ['-r', '$config = require $argv[1]; echo json_encode($config, JSON_THROW_ON_ERROR);', path.join(root, 'api/firebase-config.local.php')], { encoding: 'utf8' }));
    const credential = JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'));
    if (credential.project_id !== config.projectId) throw new Error('Service account and configured Firebase project do not match.');
    const app = initializeApp({ credential: cert(credential), projectId: config.projectId });
    const manager = getAuth(app).projectConfigManager();
    const before = (await manager.getProjectConfig()).passwordPolicyConfig || null;
    const desired = {
        ...JSON.parse(fs.readFileSync(path.join(root, 'config/password-policy.json'), 'utf8').replace(/^\uFEFF/, '')),
        forceUpgradeOnSignin: before?.forceUpgradeOnSignin ?? false
    };
    // Never reduce an existing stricter length policy during routine alignment.
    if ((before?.constraints?.minLength || 0) > desired.constraints.minLength
        || (before?.constraints?.maxLength || 4096) < desired.constraints.maxLength) {
        throw new Error('The current Firebase length policy is stricter. Review config/password-policy.json before applying.');
    }
    if (apply) {
        const backupDirectory = path.join(root, 'tmp');
        fs.mkdirSync(backupDirectory, { recursive: true });
        fs.writeFileSync(path.join(backupDirectory, 'firebase-password-policy-before.json'), JSON.stringify({ projectId: config.projectId, passwordPolicy: before }, null, 2));
        await manager.updateProjectConfig({ passwordPolicyConfig: desired });
    }
    const current = (await manager.getProjectConfig()).passwordPolicyConfig || null;
    const init = fs.readFileSync(path.join(root, 'assets/js/firebase-init.js'), 'utf8');
    const apiKey = init.match(/apiKey:\s*"([^"]+)"/)[1];
    const response = await fetch('https://identitytoolkit.googleapis.com/v2/passwordPolicy?key=' + encodeURIComponent(apiKey));
    if (!response.ok) throw new Error('Unable to verify the public Firebase password policy (HTTP ' + response.status + ').');
    const publicPolicy = await response.json();
    console.log(JSON.stringify({ projectId: config.projectId, applied: apply, desired, current, publicPolicy }, null, 2));
}
main().catch(error => {
    // Never print the credential object or OAuth token, including on errors.
    console.error(error.code ? error.code + ': ' + error.message : error.message);
    process.exitCode = 1;
});
