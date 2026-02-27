import type { Provider, OAuthConfig } from '../types.js';
import { outlookCalendarTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { presets as outlookPresets } from './presets.js';
import {
  graphFetch,
  validatePathSegment,
  validateODataFilter,
  refreshMicrosoftTokens,
  buildMicrosoftOAuthConfig,
} from '../microsoft/graph.js';

export class OutlookCalendarProvider implements Provider {
  id = 'outlook_calendar';
  displayName = 'Outlook Calendar';
  tools = outlookCalendarTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = outlookPresets;

  oauth: OAuthConfig = buildMicrosoftOAuthConfig(['offline_access', 'User.Read', 'Calendars.ReadWrite']);

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'outlook_list_calendars': {
        return graphFetch('/me/calendars', credentials);
      }

      case 'outlook_list_events': {
        const calendarId = params.calendarId as string;
        validatePathSegment(calendarId, 'calendarId');
        const startDateTime = params.startDateTime as string | undefined;
        const endDateTime = params.endDateTime as string | undefined;
        const top = Math.min((params.top as number) ?? 50, 250);

        // Use calendarView when date range is provided, otherwise use events
        if (startDateTime && endDateTime) {
          const qs = new URLSearchParams({
            startDateTime,
            endDateTime,
            $top: String(top),
            $orderby: 'start/dateTime',
          });
          if (params.filter) {
            validateODataFilter(params.filter as string);
            qs.set('$filter', params.filter as string);
          }
          return graphFetch(`/me/calendars/${calendarId}/calendarView?${qs.toString()}`, credentials);
        }

        const qs = new URLSearchParams({
          $top: String(top),
          $orderby: 'start/dateTime',
        });
        if (params.filter) {
          validateODataFilter(params.filter as string);
          qs.set('$filter', params.filter as string);
        }
        return graphFetch(`/me/calendars/${calendarId}/events?${qs.toString()}`, credentials);
      }

      case 'outlook_get_event': {
        validatePathSegment(params.eventId as string, 'eventId');
        return graphFetch(`/me/events/${params.eventId as string}`, credentials);
      }

      case 'outlook_create_event': {
        const { calendarId, ...body } = params;
        validatePathSegment(calendarId as string, 'calendarId');
        return graphFetch(`/me/calendars/${calendarId as string}/events`, credentials, {
          method: 'POST',
          body,
        });
      }

      case 'outlook_update_event': {
        const { eventId, ...body } = params;
        validatePathSegment(eventId as string, 'eventId');

        if (guards?.require_organizer_self) {
          const existing = await graphFetch(`/me/events/${eventId as string}`, credentials) as {
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

        return graphFetch(`/me/events/${eventId as string}`, credentials, {
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
    oauthClientInfo: { clientId: string; clientSecret?: string },
  ): Promise<Record<string, unknown>> {
    return refreshMicrosoftTokens(credentials, oauthClientInfo);
  }
}
