---
title: Creating a Provider
description: Step-by-step guide to adding a new provider to Gatelet
---

Gatelet is designed to be extended with new providers. Each provider is a self-contained module that teaches Gatelet how to talk to an upstream API and what policy controls to expose. This guide walks through the full process.

We welcome community contributions — if you build a provider, please open a PR!

## Overview

A provider consists of four files in `src/providers/<your-provider>/`:

```
src/providers/your-provider/
  provider.ts         Implements the Provider interface
  tools.ts            Tool definitions (name, schema, policy operation)
  default-policy.ts   Default policy YAML template
  presets.ts           Named policy variants (read-only, standard, full-access)
```

Once written, you register it in `src/providers/registry.ts` with a single line and wire up a logo in the dashboard. That's it — the policy engine, MCP tool registration, OAuth flow, token refresh, audit logging, and dashboard all work generically off the `Provider` interface.

## Step 1: Define your tools

Create `src/providers/your-provider/tools.ts`. Each tool definition maps an MCP tool (what the agent sees) to a policy operation (what the admin controls).

```ts
import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const myTools: ToolDefinition[] = [
  {
    name: 'myprovider_list_items',
    description: 'List all items accessible to the connected account',
    policyOperation: 'list_items',
    inputSchema: {},
  },
  {
    name: 'myprovider_get_item',
    description: 'Get details of a specific item',
    policyOperation: 'get_item',
    inputSchema: {
      itemId: z.string().describe('Item ID'),
    },
  },
  {
    name: 'myprovider_create_item',
    description: 'Create a new item',
    policyOperation: 'create_item',
    inputSchema: {
      title: z.string().describe('Item title'),
      body: z.string().optional().describe('Item body'),
    },
  },
];
```

**Key points:**

- **`name`** — The MCP tool name exposed to the agent. Convention: `<provider>_<action>` (e.g. `outlook_list_events`, `gmail_search`).
- **`policyOperation`** — The key in the policy YAML `operations` map. Decoupled from the tool name so policies read naturally (e.g. `list_events` instead of `outlook_list_events`).
- **`inputSchema`** — A `Record<string, z.ZodTypeAny>`. Used by the MCP SDK for agent-facing schema and by `stripUnknownParams()` to whitelist parameters before they reach `execute()`. Supports nested objects and arrays via standard Zod types.
- Tools with no parameters use an empty object: `inputSchema: {}`.

## Step 2: Write the default policy

Create `src/providers/your-provider/default-policy.ts`. This is a YAML template string. Use `{account}` as a placeholder — it gets replaced with the actual account name when a connection is created.

```ts
export const defaultPolicyYaml = `provider: my_provider
account: "{account}"

operations:
  list_items:
    allow: true

  get_item:
    allow: true

  create_item:
    allow: false
`;
```

**Design principle:** The default policy should be conservative. Enable read operations, disable write operations. Admins can loosen the policy after reviewing what each operation does.

Operations omitted from the policy are denied by default — the agent won't even see the corresponding tools.

You can use constraints, mutations, guards, and field policies in the default. See the [Policies](/concepts/policies/), [Constraints](/concepts/constraints/), and [Mutations](/concepts/mutations/) docs for the full syntax.

## Step 3: Create presets

Create `src/providers/your-provider/presets.ts`. Presets are named policy variants the admin can switch between in the dashboard with one click.

```ts
import { defaultPolicyYaml } from './default-policy.js';

export const presets: Record<string, string> = {
  'read-only': `provider: my_provider
account: "{account}"

operations:
  list_items:
    allow: true

  get_item:
    allow: true
`,

  'standard': defaultPolicyYaml,

  'full-access': `provider: my_provider
account: "{account}"

operations:
  list_items:
    allow: true

  get_item:
    allow: true

  create_item:
    allow: true
`,
};
```

Convention:
- **`read-only`** — Only read operations, all `allow: true`. Write operations are omitted entirely.
- **`standard`** — Equals `defaultPolicyYaml`. The conservative default.
- **`full-access`** — All operations present and `allow: true`. Safety guards (if any) should still be retained.

## Step 4: Implement the provider

Create `src/providers/your-provider/provider.ts`. This is the core — it implements the `Provider` interface and contains the logic for calling your upstream API.

```ts
import type { Provider, OAuthConfig } from '../types.js';
import { myTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { presets as myPresets } from './presets.js';

const API_BASE = 'https://api.example.com/v1';

export class MyProvider implements Provider {
  id = 'my_provider';
  displayName = 'My Provider';
  tools = myTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = myPresets;

  // OAuth config — see "Adding OAuth" below.
  // Omit this property entirely if your provider doesn't use OAuth.
  oauth: OAuthConfig = { /* ... */ };

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'myprovider_list_items':
        return this.apiFetch('/items', credentials);

      case 'myprovider_get_item':
        return this.apiFetch(`/items/${params.itemId}`, credentials);

      case 'myprovider_create_item':
        return this.apiFetch('/items', credentials, {
          method: 'POST',
          body: { title: params.title, body: params.body },
        });

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Helper — customize for your API
  private async apiFetch(
    path: string,
    credentials: Record<string, unknown>,
    options?: { method?: string; body?: unknown },
  ): Promise<unknown> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${credentials.access_token as string}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error (${res.status}): ${errText}`);
    }

    return res.json();
  }
}
```

### The `execute()` method

This is the only method that's called at runtime. By the time it's invoked:

1. The policy engine has already evaluated constraints and applied mutations.
2. `stripUnknownParams()` has removed any parameters not in your `inputSchema`.
3. `applyFieldPolicy()` has applied `allowed_fields`/`denied_fields` if configured.

So `params` is already validated and safe. Your job is to map it to an API call.

**Parameters explained:**

| Parameter | Description |
|---|---|
| `toolName` | The tool's `name` from your `ToolDefinition` |
| `params` | Already-mutated, schema-filtered parameters from the agent |
| `credentials` | The stored OAuth credentials (e.g. `access_token`, `refresh_token`) |
| `guards` | The `guards` dict from the policy operation — provider-specific, you decide what keys mean |
| `connectionSettings` | Per-connection settings from the database (e.g. `emailAliasSuffix` for Gmail) |

### Input validation

Validate any values used in URL path segments or query parameters to prevent injection. See the Outlook Calendar provider for examples of `validatePathSegment()` and `validateODataFilter()`.

### Guards

Guards are an escape hatch for provider-specific safety logic that doesn't fit the generic constraint/mutation model. The policy engine passes the `guards` object through to your `execute()` unchanged — you interpret the keys however you want.

Examples from built-in providers:
- `protected_labels: ['TRASH', 'SPAM']` — Gmail checks this before applying labels
- `require_organizer_self: true` — Calendar providers fetch the event and verify you're the organizer before allowing updates
- `block_subjects: [...]` — Gmail content filter blocks messages with matching subjects

If your provider doesn't need guards, just ignore the parameter.

## Step 5: Add token refresh (optional)

If your API uses OAuth tokens that expire, implement `refreshCredentials()`. Gatelet automatically calls this when an API request returns a 401, then retries the original request with fresh credentials.

```ts
async refreshCredentials(
  credentials: Record<string, unknown>,
  oauthClientInfo: { clientId: string; clientSecret?: string },
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    client_id: oauthClientInfo.clientId,
    refresh_token: credentials.refresh_token as string,
    grant_type: 'refresh_token',
  };
  if (oauthClientInfo.clientSecret) {
    params.client_secret = oauthClientInfo.clientSecret;
  }

  const res = await fetch('https://auth.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`);
  }

  const tokens = await res.json() as Record<string, unknown>;
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? credentials.refresh_token,
    expiry_date: typeof tokens.expires_in === 'number'
      ? Date.now() + (tokens.expires_in as number) * 1000
      : credentials.expiry_date,
    token_type: tokens.token_type,
  };
}
```

If you don't implement this, a 401 error will propagate directly to the agent.

## Step 6: Add OAuth config

Set the `oauth` property on your provider class. There are two patterns:

### Confidential client (client secret)

Used by Google APIs. The client secret is shipped with the app (it's not truly confidential for desktop/CLI apps — Google relies on redirect URI and consent instead).

```ts
oauth: OAuthConfig = {
  authorizeUrl: 'https://auth.example.com/authorize',
  tokenUrl: 'https://auth.example.com/token',
  scopes: ['read', 'write'],
  builtinClientId: 'your-app-client-id',
  builtinClientSecret: 'your-app-client-secret',
  envClientId: 'MY_PROVIDER_CLIENT_ID',
  envClientSecret: 'MY_PROVIDER_CLIENT_SECRET',
  settingsKeyPrefix: 'myprovider',
  extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
  async discoverAccount(accessToken: string): Promise<string> {
    const res = await fetch('https://api.example.com/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as { email?: string };
    return data.email ?? 'unknown';
  },
};
```

### Public client (PKCE)

Used by Microsoft APIs. No client secret — uses PKCE S256 challenge/verifier instead.

```ts
oauth: OAuthConfig = {
  authorizeUrl: 'https://login.example.com/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.example.com/oauth2/v2.0/token',
  scopes: ['offline_access', 'User.Read', 'Mail.ReadWrite'],
  builtinClientId: 'your-app-client-id',
  // No builtinClientSecret — PKCE is used instead
  envClientId: 'MY_PROVIDER_CLIENT_ID',
  envClientSecret: 'MY_PROVIDER_CLIENT_SECRET',
  settingsKeyPrefix: 'myprovider',
  pkce: true,
  async discoverAccount(accessToken: string): Promise<string> {
    const res = await fetch('https://api.example.com/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as { email?: string };
    return data.email ?? 'unknown';
  },
};
```

**Credential source priority:** Gatelet resolves OAuth credentials in this order: dashboard settings (user-configured) > environment variables > built-in values. This lets users bring their own OAuth app if they prefer.

**`discoverAccount()`** is called once during the OAuth callback to determine the account name (typically an email address). This is stored as `account_name` on the connection and substituted into the `{account}` placeholder in policy YAML.

## Step 7: Register the provider

Add one line to `src/providers/registry.ts`:

```ts
import { MyProvider } from './your-provider/provider.js';

registerProvider(new MyProvider());
```

At this point your provider is fully functional — the MCP server will expose its tools, the policy engine will enforce its policies, and the admin API will list it as an available OAuth provider.

## Step 8: Wire up the dashboard

A few lookup maps in the dashboard need entries for your provider.

### Add a logo

Export a new SVG component from `dashboard/src/components/ProviderLogos.tsx`:

```tsx
export function MyProviderLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      {/* Your SVG paths */}
    </svg>
  );
}
```

### Add icon map entries

Three files have provider icon maps. Add your provider to each:

**`dashboard/src/components/ConnectionCard.tsx`:**
```ts
const PROVIDER_ICONS: Record<string, any> = {
  // ... existing entries
  my_provider: MyProviderLogo,
};

const PROVIDER_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  // ... existing entries
  my_provider: { bg: 'bg-zinc-50 dark:bg-white/5', text: 'text-zinc-900 dark:text-white', icon: '' },
};
```

**`dashboard/src/components/OAuthSettings.tsx`:**
```ts
const PROVIDER_ICONS: Record<string, any> = {
  // ... existing entries
  my_provider: MyProviderLogo,
};
```

**`dashboard/src/pages/Setup.tsx`:**
```ts
const SETUP_PROVIDER_ICONS: Record<string, any> = {
  // ... existing entries
  my_provider: MyProviderLogo,
};
```

### Add a test operation

In `src/admin/routes/connections.ts`, add an entry to `TEST_OPERATIONS` so the "Test Connection" button works:

```ts
const TEST_OPERATIONS: Record<string, { tool: string; params: Record<string, unknown> }> = {
  // ... existing entries
  my_provider: { tool: 'myprovider_list_items', params: {} },
};
```

And add a branch to `testPreview()` for a human-readable result summary:

```ts
if (providerId === 'my_provider') {
  const items = (result as any)?.items;
  if (Array.isArray(items)) {
    return `Found ${items.length} item${items.length === 1 ? '' : 's'}`;
  }
  return 'Connected successfully';
}
```

### Per-connection settings (optional)

If your provider needs per-connection settings (like Gmail's `emailAliasSuffix`), add its ID to `PROVIDERS_WITH_SETTINGS` in `ConnectionCard.tsx` and handle the settings UI in the connection card's settings panel.

## Step 9: Write tests

Create `tests/providers/your-provider.test.ts`. Follow the existing pattern:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyProvider } from '../../src/providers/your-provider/provider.js';

// Mock fetch for your API
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const provider = new MyProvider();
const creds = { access_token: 'test-token', refresh_token: 'test-refresh' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provider metadata', () => {
  it('has correct id and display name', () => {
    expect(provider.id).toBe('my_provider');
    expect(provider.displayName).toBe('My Provider');
  });

  it('defines expected tools', () => {
    const names = provider.tools.map(t => t.name);
    expect(names).toContain('myprovider_list_items');
    expect(names).toContain('myprovider_get_item');
    expect(names).toContain('myprovider_create_item');
  });
});

describe('myprovider_list_items', () => {
  it('lists items', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: '1', title: 'Test' }] }),
    });

    const result = await provider.execute('myprovider_list_items', {}, creds);
    expect(result).toEqual({ items: [{ id: '1', title: 'Test' }] });
  });
});

describe('error handling', () => {
  it('throws on unknown tool', async () => {
    await expect(
      provider.execute('myprovider_unknown', {}, creds),
    ).rejects.toThrow('Unknown tool: myprovider_unknown');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      provider.execute('myprovider_list_items', {}, creds),
    ).rejects.toThrow('API error (500)');
  });
});
```

The existing `tests/providers/presets.test.ts` automatically covers all registered providers — it verifies that your three presets exist, parse as valid YAML, and follow the expected conventions. No changes needed there.

## Step 10: Add documentation

Create a provider doc page at `website/src/content/docs/providers/your-provider.md` documenting each tool, its parameters, and the default policy. See the existing provider pages for the format.

Add it to the sidebar in `website/astro.config.mjs`:

```js
{
  label: 'Providers',
  items: [
    // ... existing entries
    { label: 'My Provider', slug: 'providers/your-provider' },
  ],
},
```

## Checklist

Here's a quick checklist for adding a provider:

- [ ] `src/providers/<name>/tools.ts` — tool definitions with Zod schemas
- [ ] `src/providers/<name>/default-policy.ts` — conservative default policy
- [ ] `src/providers/<name>/presets.ts` — read-only, standard, and full-access presets
- [ ] `src/providers/<name>/provider.ts` — Provider implementation with `execute()` and optional `refreshCredentials()`
- [ ] `src/providers/registry.ts` — register with `registerProvider()`
- [ ] `dashboard/src/components/ProviderLogos.tsx` — SVG logo component
- [ ] `dashboard/src/components/ConnectionCard.tsx` — add to `PROVIDER_ICONS` and `PROVIDER_COLORS`
- [ ] `dashboard/src/components/OAuthSettings.tsx` — add to `PROVIDER_ICONS`
- [ ] `dashboard/src/pages/Setup.tsx` — add to `SETUP_PROVIDER_ICONS`
- [ ] `src/admin/routes/connections.ts` — add to `TEST_OPERATIONS` and `testPreview()`
- [ ] `tests/providers/<name>.test.ts` — test suite
- [ ] `website/src/content/docs/providers/<name>.md` — documentation page
- [ ] `website/astro.config.mjs` — add to sidebar

## Contributing

We'd love to see more providers! Some ideas:

- Google Contacts
- Google Drive
- Slack
- Notion
- Todoist
- Linear

If you're building a provider, feel free to open a draft PR early — we're happy to help with design questions and review.
