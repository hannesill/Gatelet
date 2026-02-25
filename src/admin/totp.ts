import { TOTP, Secret } from 'otpauth';
import { createHash, randomBytes } from 'node:crypto';

export function generateTotpSecret(): { secret: string; uri: string } {
  const totp = new TOTP({
    issuer: 'Gatelet',
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    issuer: 'Gatelet',
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

  // Allow 1 window in each direction (±30s) for clock drift
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export function generateBackupCodes(count = 8): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
    codes.push(code);
    hashes.push(hashBackupCode(code));
  }

  return { codes, hashes };
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

export function verifyBackupCode(
  code: string,
  hashes: string[],
): { valid: boolean; remainingHashes: string[] } {
  const hash = hashBackupCode(code);
  const index = hashes.indexOf(hash);
  if (index === -1) return { valid: false, remainingHashes: hashes };
  // Remove used code
  const remaining = [...hashes];
  remaining.splice(index, 1);
  return { valid: true, remainingHashes: remaining };
}
