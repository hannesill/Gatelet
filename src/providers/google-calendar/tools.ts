import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const googleCalendarTools: ToolDefinition[] = [
  {
    name: 'calendar_list_calendars',
    description: 'List all calendars accessible to the connected Google account',
    policyOperation: 'list_calendars',
    inputSchema: {},
  },
  {
    name: 'calendar_list_events',
    description: 'List events from a specific calendar',
    policyOperation: 'list_events',
    inputSchema: {
      calendarId: z.string().describe('Calendar ID'),
      timeMin: z.string().optional().describe('ISO 8601 datetime lower bound'),
      timeMax: z.string().optional().describe('ISO 8601 datetime upper bound'),
      q: z.string().optional().describe('Free text search query'),
      maxResults: z.number().optional().describe('Max events to return (default 50)'),
    },
  },
  {
    name: 'calendar_get_event',
    description: 'Get details of a specific calendar event',
    policyOperation: 'get_event',
    inputSchema: {
      calendarId: z.string().describe('Calendar ID'),
      eventId: z.string().describe('Event ID'),
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new calendar event',
    policyOperation: 'create_event',
    inputSchema: {
      calendarId: z.string().describe('Calendar ID'),
      summary: z.string().describe('Event title'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Event location'),
      start: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().optional().describe('Time zone'),
      }).describe('Event start time'),
      end: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().optional().describe('Time zone'),
      }).describe('Event end time'),
      attendees: z.array(z.object({ email: z.string() }).passthrough()).optional().describe('Event attendees'),
      visibility: z.enum(['default', 'public', 'private']).optional().describe('Event visibility'),
      guestsCanModify: z.boolean().optional().describe('Whether guests can modify the event'),
      guestsCanInviteOthers: z.boolean().optional().describe('Whether guests can invite others'),
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing calendar event',
    policyOperation: 'update_event',
    inputSchema: {
      calendarId: z.string().describe('Calendar ID'),
      eventId: z.string().describe('Event ID'),
      summary: z.string().optional().describe('Event title'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Event location'),
      start: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().optional().describe('Time zone'),
      }).optional().describe('Event start time'),
      end: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().optional().describe('Time zone'),
      }).optional().describe('Event end time'),
      attendees: z.array(z.object({ email: z.string() }).passthrough()).optional().describe('Event attendees'),
      visibility: z.enum(['default', 'public', 'private']).optional().describe('Event visibility'),
      guestsCanModify: z.boolean().optional().describe('Whether guests can modify the event'),
      guestsCanInviteOthers: z.boolean().optional().describe('Whether guests can invite others'),
    },
  },
];
