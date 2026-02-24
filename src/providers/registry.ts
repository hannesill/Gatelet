import type { Provider } from './types.js';
import { GoogleCalendarProvider } from './google-calendar/provider.js';

const providers = new Map<string, Provider>();

function registerProvider(provider: Provider): void {
  providers.set(provider.id, provider);
}

registerProvider(new GoogleCalendarProvider());

export function getProvider(id: string): Provider | undefined {
  return providers.get(id);
}

export function getAllProviders(): Provider[] {
  return Array.from(providers.values());
}
