import { google } from 'googleapis';
import type { Provider, OAuthConfig } from '../types.js';
import { googleCalendarTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { presets as calendarPresets } from './presets.js';

export class GoogleCalendarProvider implements Provider {
  id = 'google_calendar';
  displayName = 'Google Calendar';
  tools = googleCalendarTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = calendarPresets;

  oauth: OAuthConfig = {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    // Google "installed app" (Desktop) OAuth — the client secret is not confidential by design.
    // Google's security model relies on redirect URI and user consent, not the secret.
    // See: https://developers.google.com/identity/protocols/oauth2/native-app
    builtinClientId: '1096469986430-ap9lls3vhlu25v87ae3c8i8s3dhgaaiu.apps.googleusercontent.com',
    builtinClientSecret: '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',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
    settingsKeyPrefix: 'google',
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
    async discoverAccount(accessToken: string): Promise<string> {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return 'unknown';
      const data = await res.json() as { items?: Array<{ primary?: boolean; id?: string }> };
      const primary = data.items?.find((cal) => cal.primary);
      return primary?.id ?? 'unknown';
    },
  };

  private buildClient(credentials: Record<string, unknown>) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: credentials.access_token as string,
      refresh_token: credentials.refresh_token as string,
      expiry_date: credentials.expiry_date as number | undefined,
      token_type: credentials.token_type as string | undefined,
    });
    return google.calendar({ version: 'v3', auth });
  }

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown> {
    const calendar = this.buildClient(credentials);

    switch (toolName) {
      case 'calendar_list_calendars': {
        const res = await calendar.calendarList.list();
        return res.data;
      }

      case 'calendar_list_events': {
        const res = await calendar.events.list({
          calendarId: params.calendarId as string,
          timeMin: params.timeMin as string | undefined,
          timeMax: params.timeMax as string | undefined,
          q: params.q as string | undefined,
          maxResults: (params.maxResults as number) ?? 50,
          singleEvents: true,
          orderBy: 'startTime',
        });
        return res.data;
      }

      case 'calendar_get_event': {
        const res = await calendar.events.get({
          calendarId: params.calendarId as string,
          eventId: params.eventId as string,
        });
        return res.data;
      }

      case 'calendar_create_event': {
        const { calendarId, ...rest } = params;
        const res = await calendar.events.insert({
          calendarId: calendarId as string,
          sendUpdates: 'none',
          requestBody: rest as Record<string, unknown>,
        });
        return res.data;
      }

      case 'calendar_update_event': {
        const { calendarId, eventId, ...rest } = params;

        if (guards?.require_organizer_self) {
          const existing = await calendar.events.get({
            calendarId: calendarId as string,
            eventId: eventId as string,
          });
          if (!existing.data.organizer?.self) {
            throw new Error(
              'Cannot modify events organized by others. This event is organized by ' +
              `${existing.data.organizer?.email ?? 'an external user'}.`,
            );
          }
        }

        const res = await calendar.events.patch({
          calendarId: calendarId as string,
          eventId: eventId as string,
          sendUpdates: 'none',
          requestBody: rest as Record<string, unknown>,
        });
        return res.data;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async refreshCredentials(
    credentials: Record<string, unknown>,
    oauthClientInfo: { clientId: string; clientSecret: string },
  ): Promise<Record<string, unknown>> {
    const auth = new google.auth.OAuth2(
      oauthClientInfo.clientId,
      oauthClientInfo.clientSecret,
    );
    auth.setCredentials({
      refresh_token: credentials.refresh_token as string,
    });
    const { credentials: newCreds } = await auth.refreshAccessToken();
    return {
      access_token: newCreds.access_token,
      refresh_token: newCreds.refresh_token ?? credentials.refresh_token,
      expiry_date: newCreds.expiry_date,
      token_type: newCreds.token_type,
    };
  }
}
