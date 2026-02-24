import type { Provider, OAuthConfig } from '../types.js';
import { outlookCalendarTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class OutlookCalendarProvider implements Provider {
  id = 'outlook_calendar';
  displayName = 'Outlook Calendar';
  tools = outlookCalendarTools;
  defaultPolicyYaml = defaultPolicyYaml;

  oauth: OAuthConfig = {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['offline_access', 'User.Read', 'Calendars.ReadWrite'],
    builtinClientId: '1e200574-2d1a-4103-919d-2cbade780983',
    builtinClientSecret: 'p8O8Q~h9Rah3nGUil6.6aQJAaDyDSG07XcvYPb97',
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
    settingsKeyPrefix: 'microsoft',
    async discoverAccount(accessToken: string): Promise<string> {
      const res = await fetch(`${GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return 'unknown';
      const data = await res.json() as { mail?: string; userPrincipalName?: string };
      return data.mail ?? data.userPrincipalName ?? 'unknown';
    },
  };

  private async graphFetch(
    path: string,
    credentials: Record<string, unknown>,
    options?: { method?: string; body?: unknown },
  ): Promise<unknown> {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${credentials.access_token as string}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Microsoft Graph API error (${res.status}): ${errText}`);
    }

    return res.json();
  }

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'outlook_list_calendars': {
        return this.graphFetch('/me/calendars', credentials);
      }

      case 'outlook_list_events': {
        const calendarId = params.calendarId as string;
        const startDateTime = params.startDateTime as string | undefined;
        const endDateTime = params.endDateTime as string | undefined;
        const top = (params.top as number) ?? 50;

        // Use calendarView when date range is provided, otherwise use events
        if (startDateTime && endDateTime) {
          const qs = new URLSearchParams({
            startDateTime,
            endDateTime,
            $top: String(top),
            $orderby: 'start/dateTime',
          });
          if (params.filter) qs.set('$filter', params.filter as string);
          return this.graphFetch(`/me/calendars/${calendarId}/calendarView?${qs.toString()}`, credentials);
        }

        const qs = new URLSearchParams({
          $top: String(top),
          $orderby: 'start/dateTime',
        });
        if (params.filter) qs.set('$filter', params.filter as string);
        return this.graphFetch(`/me/calendars/${calendarId}/events?${qs.toString()}`, credentials);
      }

      case 'outlook_get_event': {
        return this.graphFetch(`/me/events/${params.eventId as string}`, credentials);
      }

      case 'outlook_create_event': {
        const { calendarId, ...body } = params;
        return this.graphFetch(`/me/calendars/${calendarId as string}/events`, credentials, {
          method: 'POST',
          body,
        });
      }

      case 'outlook_update_event': {
        const { eventId, ...body } = params;

        if (guards?.require_organizer_self) {
          const existing = await this.graphFetch(`/me/events/${eventId as string}`, credentials) as {
            organizer?: { emailAddress?: { address?: string } };
            isOrganizer?: boolean;
          };
          if (!existing.isOrganizer) {
            throw new Error(
              'Cannot modify events organized by others. This event is organized by ' +
              `${existing.organizer?.emailAddress?.address ?? 'an external user'}.`,
            );
          }
        }

        return this.graphFetch(`/me/events/${eventId as string}`, credentials, {
          method: 'PATCH',
          body,
        });
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async refreshCredentials(
    credentials: Record<string, unknown>,
    oauthClientInfo: { clientId: string; clientSecret: string },
  ): Promise<Record<string, unknown>> {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: oauthClientInfo.clientId,
        client_secret: oauthClientInfo.clientSecret,
        refresh_token: credentials.refresh_token as string,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token refresh failed: ${errText}`);
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
}
