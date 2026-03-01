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
import { GateletError } from '../gatelet-error.js';

function shapeCalendar(cal: Record<string, unknown>) {
  return {
    id: cal.id,
    name: cal.name,
    ...(cal.isDefaultCalendar ? { isDefault: true } : {}),
  };
}

function shapeEvent(evt: Record<string, unknown>) {
  return {
    id: evt.id,
    subject: evt.subject,
    body: evt.body,
    webLink: evt.webLink,
    start: evt.start,
    end: evt.end,
    location: evt.location,
    organizer: evt.organizer,
    isOrganizer: evt.isOrganizer,
    attendees: evt.attendees,
    isAllDay: evt.isAllDay,
    ...(evt.recurrence ? { recurrence: evt.recurrence } : {}),
  };
}

export class OutlookCalendarProvider implements Provider {
  id = 'outlook_calendar';
  displayName = 'Outlook Calendar';
  tools = outlookCalendarTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = outlookPresets;

  oauth: OAuthConfig = buildMicrosoftOAuthConfig(
    ['offline_access', 'User.Read', 'Calendars.ReadWrite'],
    {
      'read-only': ['offline_access', 'User.Read', 'Calendars.Read'],
      'full-access': ['offline_access', 'User.Read', 'Calendars.ReadWrite'],
    },
  );

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'outlook_list_calendars': {
        const data = await graphFetch(
          '/me/calendars?$select=id,name,isDefaultCalendar',
          credentials,
        ) as { value?: Array<Record<string, unknown>> };
        return { calendars: (data.value ?? []).map(shapeCalendar) };
      }

      case 'outlook_list_events': {
        const calendarId = params.calendarId as string;
        validatePathSegment(calendarId, 'calendarId');
        const startDateTime = params.startDateTime as string | undefined;
        const endDateTime = params.endDateTime as string | undefined;
        const top = Math.min((params.top as number) ?? 50, 250);
        const selectFields = 'id,subject,webLink,start,end,location,organizer,isOrganizer,attendees,isAllDay,recurrence';

        // Use calendarView when date range is provided, otherwise use events
        if (startDateTime && endDateTime) {
          const qs = new URLSearchParams({
            startDateTime,
            endDateTime,
            $top: String(top),
            $orderby: 'start/dateTime',
            $select: selectFields,
          });
          if (params.filter) {
            validateODataFilter(params.filter as string);
            qs.set('$filter', params.filter as string);
          }
          const data = await graphFetch(`/me/calendars/${calendarId}/calendarView?${qs.toString()}`, credentials) as { value?: Array<Record<string, unknown>> };
          return { events: (data.value ?? []).map(shapeEvent) };
        }

        const qs = new URLSearchParams({
          $top: String(top),
          $orderby: 'start/dateTime',
          $select: selectFields,
        });
        if (params.filter) {
          validateODataFilter(params.filter as string);
          qs.set('$filter', params.filter as string);
        }
        const data = await graphFetch(`/me/calendars/${calendarId}/events?${qs.toString()}`, credentials) as { value?: Array<Record<string, unknown>> };
        return { events: (data.value ?? []).map(shapeEvent) };
      }

      case 'outlook_get_event': {
        validatePathSegment(params.eventId as string, 'eventId');
        const data = await graphFetch(
          `/me/events/${params.eventId as string}?$select=id,subject,body,webLink,start,end,location,organizer,isOrganizer,attendees,isAllDay,recurrence`,
          credentials,
        ) as Record<string, unknown>;
        return shapeEvent(data);
      }

      case 'outlook_create_event': {
        const { calendarId, ...body } = params;
        validatePathSegment(calendarId as string, 'calendarId');
        const data = await graphFetch(`/me/calendars/${calendarId as string}/events`, credentials, {
          method: 'POST',
          body,
        }) as Record<string, unknown>;
        return shapeEvent(data);
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
            throw new GateletError(
              'Cannot modify events organized by others. This event is organized by ' +
              `${existing.organizer?.emailAddress?.address ?? 'an external user'}.`,
            );
          }
        }

        const data = await graphFetch(`/me/events/${eventId as string}`, credentials, {
          method: 'PATCH',
          body,
        }) as Record<string, unknown>;
        return shapeEvent(data);
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
