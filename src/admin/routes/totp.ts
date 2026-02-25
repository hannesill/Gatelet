import { Hono } from 'hono';
import { generateTotpSecret, verifyTotpCode, generateBackupCodes, verifyBackupCode } from '../totp.js';
import { getSetting, setSetting, deleteSetting } from '../../db/settings.js';

const app = new Hono();

// Temporary store for pending TOTP setup (not yet verified)
let pendingSecret: string | null = null;

app.post('/totp/setup', (c) => {
  const { secret, uri } = generateTotpSecret();
  pendingSecret = secret;
  return c.json({ secret, uri });
});

app.post('/totp/verify-setup', async (c) => {
  const { code } = await c.req.json();

  if (!pendingSecret) {
    return c.json({ error: 'No pending TOTP setup. Call /totp/setup first.' }, 400);
  }

  if (!code || typeof code !== 'string') {
    return c.json({ error: 'Missing TOTP code' }, 400);
  }

  if (!verifyTotpCode(pendingSecret, code)) {
    return c.json({ error: 'Invalid TOTP code. Check your authenticator app and try again.' }, 400);
  }

  // Store the secret and enable TOTP
  setSetting('totp_secret', pendingSecret);
  setSetting('totp_enabled', 'true');

  // Generate backup codes
  const { codes, hashes } = generateBackupCodes();
  setSetting('totp_backup_codes', JSON.stringify(hashes));

  pendingSecret = null;

  return c.json({ enabled: true, backupCodes: codes });
});

app.post('/totp/disable', async (c) => {
  const { code } = await c.req.json();

  if (!code || typeof code !== 'string') {
    return c.json({ error: 'Missing TOTP code' }, 400);
  }

  const totpEnabled = getSetting('totp_enabled') === 'true';
  if (!totpEnabled) {
    return c.json({ error: '2FA is not enabled' }, 400);
  }

  const secret = getSetting('totp_secret');
  if (!secret) {
    return c.json({ error: 'TOTP configuration error' }, 500);
  }

  // Verify with TOTP code or backup code
  let valid = verifyTotpCode(secret, code);
  if (!valid) {
    const hashes = JSON.parse(getSetting('totp_backup_codes') || '[]');
    const result = verifyBackupCode(code, hashes);
    valid = result.valid;
    if (result.valid) {
      setSetting('totp_backup_codes', JSON.stringify(result.remainingHashes));
    }
  }

  if (!valid) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  // Disable TOTP
  deleteSetting('totp_secret');
  deleteSetting('totp_enabled');
  deleteSetting('totp_backup_codes');

  return c.json({ disabled: true });
});

app.get('/totp/status', (c) => {
  const enabled = getSetting('totp_enabled') === 'true';
  let backupCodesRemaining = 0;

  if (enabled) {
    try {
      const hashes = JSON.parse(getSetting('totp_backup_codes') || '[]');
      backupCodesRemaining = hashes.length;
    } catch {
      backupCodesRemaining = 0;
    }
  }

  return c.json({ enabled, backupCodesRemaining });
});

// Reset pending secret (for testing)
export function resetPendingSecret(): void {
  pendingSecret = null;
}

export default app;
