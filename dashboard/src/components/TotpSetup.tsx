import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, Copy, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { cn } from '../utils';
import QRCode from 'qrcode';

type SetupStep = 'idle' | 'qr' | 'backup' | 'done';

export function TotpSetup() {
  const [status, setStatus] = useState<{ enabled: boolean; backupCodesRemaining: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<SetupStep>('idle');
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const data = await api.totpStatus();
      setStatus(data);
    } catch {
      // Settings may not be accessible
    } finally {
      setLoading(false);
    }
  }

  async function startSetup() {
    setError('');
    setActionLoading(true);
    try {
      const data = await api.totpSetup();
      setSecret(data.secret);
      setUri(data.uri);
      const dataUrl = await QRCode.toDataURL(data.uri, { width: 256, margin: 2 });
      setQrDataUrl(dataUrl);
      setStep('qr');
      setTimeout(() => verifyInputRef.current?.focus(), 300);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function verifySetup() {
    setError('');
    setActionLoading(true);
    try {
      const data = await api.totpVerifySetup(verifyCode);
      setBackupCodes(data.backupCodes);
      setStep('backup');
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function disable2FA() {
    setError('');
    setActionLoading(true);
    try {
      await api.totpDisable(disableCode);
      setDisableCode('');
      setStep('idle');
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const text = `Gatelet 2FA Backup Codes\n${'='.repeat(30)}\n\n${backupCodes.join('\n')}\n\nEach code can only be used once.\nStore these codes in a safe place.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gatelet-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          status?.enabled
            ? "bg-emerald-100 dark:bg-emerald-500/10"
            : "bg-zinc-100 dark:bg-white/5"
        )}>
          {status?.enabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Shield className="h-5 w-5 text-zinc-400" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Two-Factor Authentication
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {status?.enabled
              ? `Enabled — ${status.backupCodesRemaining} backup codes remaining`
              : 'Add an extra layer of security to your admin panel'}
          </p>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-500/20"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not enabled — show enable button */}
      {!status?.enabled && step === 'idle' && (
        <button
          onClick={startSetup}
          disabled={actionLoading}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Enable 2FA
        </button>
      )}

      {/* QR Code step */}
      <AnimatePresence>
        {step === 'qr' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 rounded-2xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10"
          >
            <div className="text-center">
              <p className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Scan this QR code with your authenticator app
              </p>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="TOTP QR Code" className="mx-auto rounded-xl" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Manual Entry
              </p>
              <code className="block rounded-xl bg-zinc-100 px-4 py-3 text-xs font-mono break-all text-zinc-700 dark:bg-black/20 dark:text-zinc-300">
                {secret}
              </code>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Verify Code
              </label>
              <div className="flex gap-3">
                <input
                  ref={verifyInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="flex-1 rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-mono tracking-widest ring-1 ring-zinc-200 focus:ring-2 focus:ring-indigo-500 dark:bg-black/20 dark:ring-white/10 dark:text-white"
                />
                <button
                  onClick={verifySetup}
                  disabled={actionLoading || verifyCode.length !== 6}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
            </div>

            <button
              onClick={() => { setStep('idle'); setError(''); }}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup codes step */}
      <AnimatePresence>
        {step === 'backup' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 rounded-2xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10"
          >
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-500/20">
              <CheckCircle className="h-4 w-4 shrink-0" />
              2FA has been enabled successfully!
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Save these backup codes in a safe place. Each code can only be used once.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-4 dark:bg-black/20">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyBackupCodes}
                className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={downloadBackupCodes}
                className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>

            <button
              onClick={() => { setStep('idle'); setBackupCodes([]); }}
              className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enabled — show disable option */}
      {status?.enabled && step === 'idle' && (
        <div className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            To disable 2FA, enter a code from your authenticator app or a backup code.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\s/g, ''))}
              placeholder="Code"
              className="flex-1 rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-mono tracking-widest ring-1 ring-zinc-200 focus:ring-2 focus:ring-red-500 dark:bg-black/20 dark:ring-white/10 dark:text-white"
            />
            <button
              onClick={disable2FA}
              disabled={actionLoading || !disableCode}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Disable 2FA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
