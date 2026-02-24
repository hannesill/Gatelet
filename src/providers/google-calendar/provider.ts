import { google } from 'googleapis';
import type { Provider } from '../types.js';
import { googleCalendarTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';

export class GoogleCalendarProvider implements Provider {
  id = 'google_calendar';
  displayName = 'Google Calendar';
  tools = googleCalendarTools;
  defaultPolicyYaml = defaultPolicyYaml;

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
          requestBody: rest as Record<string, unknown>,
        });
        return res.data;
      }

      case 'calendar_update_event': {
        const { calendarId, eventId, ...rest } = params;
        const res = await calendar.events.patch({
          calendarId: calendarId as string,
          eventId: eventId as string,
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
  ): Promise<Record<string, unknown>> {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
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
