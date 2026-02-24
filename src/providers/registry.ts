import type { Provider } from './types.js';
import { GoogleCalendarProvider } from './google-calendar/provider.js';
import { OutlookCalendarProvider } from './outlook-calendar/provider.js';

const providers = new Map<string, Provider>();

function registerProvider(provider: Provider): void {
  providers.set(provider.id, provider);
}

registerProvider(new GoogleCalendarProvider());
registerProvider(new OutlookCalendarProvider());

export function getProvider(id: string): Provider | undefined {
  return providers.get(id);
}

export function getAllProviders(): Provider[] {
  return Array.from(providers.values());
}
