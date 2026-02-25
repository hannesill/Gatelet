import { TotpSetup } from '../components/TotpSetup';

export function Settings() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-white">Security</h2>
        <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-zinc-200 backdrop-blur-sm dark:bg-zinc-900/60 dark:ring-white/10">
          <TotpSetup />
        </div>
      </section>
    </div>
  );
}
