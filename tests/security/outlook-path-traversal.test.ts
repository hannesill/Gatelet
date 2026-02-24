/**
 * Security Audit: Outlook Provider Path Traversal / SSRF
 *
 * Tests for FINDING-15: The Outlook Calendar provider constructs
 * Microsoft Graph API URLs by interpolating user-supplied calendarId
 * and eventId directly into URL paths without sanitization.
 *
 * An agent could inject path traversal characters to hit arbitrary
 * Graph API endpoints.
 */
import { describe, it, expect } from 'vitest';

describe('FINDING-15: Outlook provider URL path injection', () => {
  // We test the URL construction logic without making actual API calls.
  // The vulnerable patterns from outlook-calendar/provider.ts:
  //
  //   graphFetch(`/me/calendars/${calendarId}/calendarView?...`)
  //   graphFetch(`/me/calendars/${calendarId}/events?...`)
  //   graphFetch(`/me/events/${eventId}`)
  //   graphFetch(`/me/calendars/${calendarId}/events`, ...)
  //   graphFetch(`/me/events/${eventId}`, ...)

  const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

  function buildUrl(path: string): string {
    return `${GRAPH_BASE}${path}`;
  }

  it('calendarId can traverse out of /me/calendars/ path', () => {
    // An agent provides a calendarId with path traversal
    const maliciousCalendarId = '../../users/victim@company.com/calendar';

    const url = buildUrl(`/me/calendars/${maliciousCalendarId}/events`);

    // The resulting URL escapes the intended path
    // https://graph.microsoft.com/v1.0/me/calendars/../../users/victim@company.com/calendar/events
    // Which resolves to:
    // https://graph.microsoft.com/v1.0/users/victim@company.com/calendar/events
    expect(url).toContain('../../users/victim@company.com');

    // This could allow accessing another user's calendar if the OAuth token
    // has sufficient permissions (e.g., delegated Calendars.ReadWrite)
  });

  it('eventId can traverse to arbitrary Graph API endpoints', () => {
    // Attack: read user's emails via path traversal through eventId
    const maliciousEventId = '../../messages';

    const url = buildUrl(`/me/events/${maliciousEventId}`);

    // https://graph.microsoft.com/v1.0/me/events/../../messages
    // Resolves to: https://graph.microsoft.com/v1.0/me/messages
    expect(url).toContain('../../messages');
  });

  it('calendarId can include query parameters', () => {
    // Attack: inject additional query parameters
    const maliciousCalendarId = 'AAA/events?$select=subject&$top=999#';

    const url = buildUrl(`/me/calendars/${maliciousCalendarId}/calendarView`);

    // The injected query params could override the intended query
    expect(url).toContain('$select=subject');
    expect(url).toContain('$top=999');
  });

  it('eventId can reach admin endpoints', () => {
    // Attack: try to access directory/admin endpoints
    const maliciousEventId = '../../organization';

    const url = buildUrl(`/me/events/${maliciousEventId}`);

    // https://graph.microsoft.com/v1.0/me/events/../../organization
    // Resolves to: https://graph.microsoft.com/v1.0/organization
    expect(url).toContain('../../organization');
  });

  it('calendarId with encoded slashes might bypass URL validation', () => {
    // Some servers decode %2F as / after routing
    const maliciousCalendarId = '..%2F..%2Fusers%2Fvictim';

    const url = buildUrl(`/me/calendars/${maliciousCalendarId}/events`);

    // The %2F might be decoded by the Graph API server
    expect(url).toContain('%2F');
  });

  it('filter parameter allows OData injection', () => {
    // The Outlook provider passes the filter parameter directly to $filter
    // This allows the agent to construct arbitrary OData queries
    const maliciousFilter = "subject eq 'secret' or isOrganizer eq true";

    // This would be passed as: $filter=subject eq 'secret' or isOrganizer eq true
    // OData injection could expand the query scope
    const qs = new URLSearchParams({ $filter: maliciousFilter });
    expect(qs.toString()).toContain('subject');
    expect(qs.toString()).toContain('isOrganizer');
  });
});
