import { google } from 'googleapis';
import type { Provider, OAuthConfig } from '../types.js';
import { googleCalendarTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { presets as calendarPresets } from './presets.js';
import { buildGoogleAuth, refreshGoogleTokens, buildGoogleOAuthConfig } from '../google/google.js';

export class GoogleCalendarProvider implements Provider {
  id = 'google_calendar';
  displayName = 'Google Calendar';
  tools = googleCalendarTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = calendarPresets;

  oauth: OAuthConfig = buildGoogleOAuthConfig(
    [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    async (accessToken: string): Promise<string> => {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return 'unknown';
      const data = await res.json() as { items?: Array<{ primary?: boolean; id?: string }> };
      const primary = data.items?.find((cal) => cal.primary);
      return primary?.id ?? 'unknown';
    },
  );

  private buildClient(credentials: Record<string, unknown>) {
    const auth = buildGoogleAuth(credentials);
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
          maxResults: Math.min((params.maxResults as number) ?? 50, 250),
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
    return refreshGoogleTokens(credentials, oauthClientInfo);
  }
}
