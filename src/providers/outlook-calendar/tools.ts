import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const outlookCalendarTools: ToolDefinition[] = [
  {
    name: 'outlook_list_calendars',
    description: 'List all calendars accessible to the connected Microsoft account',
    policyOperation: 'list_calendars',
    inputSchema: {},
  },
  {
    name: 'outlook_list_events',
    description: 'List events from a specific Outlook calendar',
    policyOperation: 'list_events',
    inputSchema: {
      calendarId: z.string().describe('Calendar ID'),
      startDateTime: z.string().optional().describe('ISO 8601 datetime lower bound for calendarView'),
      endDateTime: z.string().optional().describe('ISO 8601 datetime upper bound for calendarView'),
      filter: z.string().optional().describe('OData $filter expression'),
      top: z.number().optional().describe('Max events to return (default 50)'),
    },
  },
  {
    name: 'outlook_get_event',
    description: 'Get details of a specific Outlook calendar event',
    policyOperation: 'get_event',
    inputSchema: {
      eventId: z.string().describe('Event ID'),
    },
  },
  {
    name: 'outlook_create_event',
    description: 'Create a new Outlook calendar event',
    policyOperation: 'create_event',
    inputSchema: {
      calendarId: z.string().describe('Calendar ID'),
      subject: z.string().describe('Event subject/title'),
      body: z.object({
        contentType: z.enum(['text', 'html']).optional().describe('Content type'),
        content: z.string().describe('Event body content'),
      }).optional().describe('Event body'),
      start: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().describe('IANA time zone'),
      }).describe('Event start time'),
      end: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().describe('IANA time zone'),
      }).describe('Event end time'),
      location: z.object({
        displayName: z.string().describe('Location name'),
      }).optional().describe('Event location'),
      attendees: z.array(z.object({
        emailAddress: z.object({
          address: z.string().describe('Email address'),
          name: z.string().optional().describe('Display name'),
        }),
        type: z.enum(['required', 'optional', 'resource']).optional().describe('Attendee type'),
      })).optional().describe('Event attendees'),
      isAllDay: z.boolean().optional().describe('Whether the event is all day'),
    },
  },
  {
    name: 'outlook_update_event',
    description: 'Update an existing Outlook calendar event',
    policyOperation: 'update_event',
    inputSchema: {
      eventId: z.string().describe('Event ID'),
      subject: z.string().optional().describe('Event subject/title'),
      body: z.object({
        contentType: z.enum(['text', 'html']).optional().describe('Content type'),
        content: z.string().describe('Event body content'),
      }).optional().describe('Event body'),
      start: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().describe('IANA time zone'),
      }).optional().describe('Event start time'),
      end: z.object({
        dateTime: z.string().describe('ISO 8601 datetime'),
        timeZone: z.string().describe('IANA time zone'),
      }).optional().describe('Event end time'),
      location: z.object({
        displayName: z.string().describe('Location name'),
      }).optional().describe('Event location'),
      attendees: z.array(z.object({
        emailAddress: z.object({
          address: z.string().describe('Email address'),
          name: z.string().optional().describe('Display name'),
        }),
        type: z.enum(['required', 'optional', 'resource']).optional().describe('Attendee type'),
      })).optional().describe('Event attendees'),
      isAllDay: z.boolean().optional().describe('Whether the event is all day'),
    },
  },
];
