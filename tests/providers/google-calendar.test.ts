import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleCalendarProvider } from '../../src/providers/google-calendar/provider.js';

// Mock googleapis
vi.mock('googleapis', () => {
  const mockEvents = {
    get: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    list: vi.fn(),
  };
  const mockCalendarList = {
    list: vi.fn(),
  };

  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
          refreshAccessToken: vi.fn(),
        })),
      },
      calendar: vi.fn(() => ({
        events: mockEvents,
        calendarList: mockCalendarList,
      })),
    },
    _mockEvents: mockEvents,
    _mockCalendarList: mockCalendarList,
  };
});

// Access the mocks
import { _mockEvents as mockEvents, _mockCalendarList as mockCalendarList } from 'googleapis';

const provider = new GoogleCalendarProvider();
const creds = { access_token: 'tok', refresh_token: 'ref' };

describe('GoogleCalendarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list_calendars', () => {
    it('returns shaped calendars with only useful fields', async () => {
      (mockCalendarList.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          items: [
            {
              id: 'primary@gmail.com',
              summary: 'Primary Calendar',
              summaryOverride: 'My Cal',
              description: 'Main calendar',
              timeZone: 'Europe/Berlin',
              accessRole: 'owner',
              primary: true,
              etag: '"abc123"',
              kind: 'calendar#calendarListEntry',
              conferenceProperties: {},
            },
            {
              id: 'holidays@group.v.calendar.google.com',
              summary: 'Holidays',
              timeZone: 'Europe/Berlin',
              accessRole: 'reader',
              etag: '"def456"',
              kind: 'calendar#calendarListEntry',
            },
          ],
        },
      });

      const result = await provider.execute('calendar_list_calendars', {}, creds) as any;

      expect(result.calendars).toHaveLength(2);
      // Primary calendar: prefers summaryOverride, includes primary flag
      expect(result.calendars[0]).toEqual({
        id: 'primary@gmail.com',
        name: 'My Cal',
        description: 'Main calendar',
        timeZone: 'Europe/Berlin',
        accessRole: 'owner',
        primary: true,
      });
      // Non-primary: no summaryOverride falls back to summary, no primary flag
      expect(result.calendars[1]).toEqual({
        id: 'holidays@group.v.calendar.google.com',
        name: 'Holidays',
        description: undefined,
        timeZone: 'Europe/Berlin',
        accessRole: 'reader',
      });
      // Verify noisy fields are stripped
      expect(result.calendars[0]).not.toHaveProperty('etag');
      expect(result.calendars[0]).not.toHaveProperty('kind');
      expect(result.calendars[0]).not.toHaveProperty('conferenceProperties');
    });

    it('handles empty calendar list', async () => {
      (mockCalendarList.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { items: undefined },
      });

      const result = await provider.execute('calendar_list_calendars', {}, creds) as any;
      expect(result.calendars).toEqual([]);
    });
  });

  describe('list_events', () => {
    it('returns shaped events with calendar context', async () => {
      (mockEvents.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          summary: 'My Calendar',
          timeZone: 'Europe/Berlin',
          items: [
            {
              id: 'evt1',
              status: 'confirmed',
              htmlLink: 'https://calendar.google.com/event?eid=evt1',
              summary: 'Team Standup',
              description: 'Daily sync',
              location: 'Room 42',
              start: { dateTime: '2026-03-01T09:00:00+01:00' },
              end: { dateTime: '2026-03-01T09:30:00+01:00' },
              organizer: { email: 'me@example.com', self: true },
              attendees: [{ email: 'bob@example.com' }],
              etag: '"abc"',
              kind: 'calendar#event',
              iCalUID: 'uid@google.com',
              reminders: { useDefault: true },
              conferenceData: {},
            },
          ],
        },
      });

      const result = await provider.execute('calendar_list_events', {
        calendarId: 'primary',
      }, creds) as any;

      expect(result.calendar).toBe('My Calendar');
      expect(result.timeZone).toBe('Europe/Berlin');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        id: 'evt1',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=evt1',
        summary: 'Team Standup',
        description: 'Daily sync',
        location: 'Room 42',
        start: { dateTime: '2026-03-01T09:00:00+01:00' },
        end: { dateTime: '2026-03-01T09:30:00+01:00' },
        organizer: { email: 'me@example.com', self: true },
        attendees: [{ email: 'bob@example.com' }],
      });
      // Noisy fields stripped
      expect(result.events[0]).not.toHaveProperty('etag');
      expect(result.events[0]).not.toHaveProperty('kind');
      expect(result.events[0]).not.toHaveProperty('iCalUID');
      expect(result.events[0]).not.toHaveProperty('reminders');
      expect(result.events[0]).not.toHaveProperty('conferenceData');
      // No nextPageToken when absent
      expect(result).not.toHaveProperty('nextPageToken');
    });

    it('includes nextPageToken when present', async () => {
      (mockEvents.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          summary: 'Cal',
          timeZone: 'UTC',
          items: [],
          nextPageToken: 'token123',
        },
      });

      const result = await provider.execute('calendar_list_events', {
        calendarId: 'primary',
      }, creds) as any;

      expect(result.nextPageToken).toBe('token123');
    });

    it('includes recurrence when present on event', async () => {
      (mockEvents.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          summary: 'Cal',
          timeZone: 'UTC',
          items: [
            {
              id: 'rec1',
              summary: 'Weekly',
              start: { dateTime: '2026-03-01T10:00:00Z' },
              end: { dateTime: '2026-03-01T11:00:00Z' },
              recurrence: ['RRULE:FREQ=WEEKLY'],
            },
          ],
        },
      });

      const result = await provider.execute('calendar_list_events', {
        calendarId: 'primary',
      }, creds) as any;

      expect(result.events[0].recurrence).toEqual(['RRULE:FREQ=WEEKLY']);
    });

    it('handles empty event list', async () => {
      (mockEvents.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          summary: 'Cal',
          timeZone: 'UTC',
          items: undefined,
        },
      });

      const result = await provider.execute('calendar_list_events', {
        calendarId: 'primary',
      }, creds) as any;

      expect(result.events).toEqual([]);
    });
  });

  describe('update_event organizer check', () => {
    it('allows updating events organized by self', async () => {
      (mockEvents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { organizer: { self: true, email: 'me@example.com' } },
      });
      (mockEvents.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'evt1', summary: 'Updated' },
      });

      const result = await provider.execute(
        'calendar_update_event',
        { calendarId: 'primary', eventId: 'evt1', summary: 'Updated' },
        creds,
        { require_organizer_self: true },
      ) as Record<string, unknown>;

      expect(result.id).toBe('evt1');
      expect(result.summary).toBe('Updated');
      expect(mockEvents.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
          eventId: 'evt1',
          sendUpdates: 'none',
        }),
      );
    });

    it('rejects updating events organized by others', async () => {
      (mockEvents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { organizer: { self: false, email: 'other@example.com' } },
      });

      await expect(
        provider.execute(
          'calendar_update_event',
          { calendarId: 'primary', eventId: 'evt2', summary: 'Hack' },
          creds,
          { require_organizer_self: true },
        ),
      ).rejects.toThrow('Cannot modify events organized by others');

      expect(mockEvents.patch).not.toHaveBeenCalled();
    });

    it('rejects when organizer field is missing', async () => {
      (mockEvents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {},
      });

      await expect(
        provider.execute(
          'calendar_update_event',
          { calendarId: 'primary', eventId: 'evt3', summary: 'Test' },
          creds,
          { require_organizer_self: true },
        ),
      ).rejects.toThrow('Cannot modify events organized by others');
    });

    it('includes organizer email in error message', async () => {
      (mockEvents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { organizer: { self: false, email: 'boss@corp.com' } },
      });

      await expect(
        provider.execute(
          'calendar_update_event',
          { calendarId: 'primary', eventId: 'evt4', summary: 'Test' },
          creds,
          { require_organizer_self: true },
        ),
      ).rejects.toThrow('boss@corp.com');
    });

    it('skips organizer check when guard is absent', async () => {
      (mockEvents.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'evt5', summary: 'Updated' },
      });

      const result = await provider.execute(
        'calendar_update_event',
        { calendarId: 'primary', eventId: 'evt5', summary: 'Updated' },
        creds,
      ) as Record<string, unknown>;

      expect(result.id).toBe('evt5');
      expect(result.summary).toBe('Updated');
      expect(mockEvents.get).not.toHaveBeenCalled();
      expect(mockEvents.patch).toHaveBeenCalled();
    });
  });

  describe('sendUpdates: none', () => {
    it('passes sendUpdates: none to events.insert', async () => {
      (mockEvents.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'new1' },
      });

      await provider.execute(
        'calendar_create_event',
        { calendarId: 'primary', summary: 'Meeting' },
        creds,
      );

      expect(mockEvents.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sendUpdates: 'none' }),
      );
    });

    it('passes sendUpdates: none to events.patch', async () => {
      (mockEvents.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'evt1' },
      });

      await provider.execute(
        'calendar_update_event',
        { calendarId: 'primary', eventId: 'evt1', summary: 'Updated' },
        creds,
      );

      expect(mockEvents.patch).toHaveBeenCalledWith(
        expect.objectContaining({ sendUpdates: 'none' }),
      );
    });
  });

  describe('oauth config', () => {
    it('has oauth config with Google-specific settings', () => {
      expect(provider.oauth).toBeDefined();
      expect(provider.oauth.authorizeUrl).toContain('accounts.google.com');
      expect(provider.oauth.tokenUrl).toContain('googleapis.com');
      expect(provider.oauth.scopes).toContain('https://www.googleapis.com/auth/calendar.readonly');
      expect(provider.oauth.builtinClientId).toBeDefined();
      expect(provider.oauth.builtinClientSecret).toBeDefined();
      expect(provider.oauth.settingsKeyPrefix).toBe('google');
      expect(provider.oauth.extraAuthorizeParams).toEqual({ access_type: 'offline', prompt: 'consent' });
    });
  });
});
