import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutlookCalendarProvider } from '../../src/providers/outlook-calendar/provider.js';

const provider = new OutlookCalendarProvider();
const creds = { access_token: 'tok', refresh_token: 'ref' };

describe('OutlookCalendarProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: unknown, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    });
  }

  describe('list_calendars', () => {
    it('fetches calendars from Graph API', async () => {
      const data = { value: [{ id: 'cal1', name: 'Calendar' }] };
      mockFetch(data);

      const result = await provider.execute('outlook_list_calendars', {}, creds);
      expect(result).toEqual(data);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://graph.microsoft.com/v1.0/me/calendars');
      expect(fetchCall[1].headers.Authorization).toBe('Bearer tok');
    });
  });

  describe('list_events', () => {
    it('uses calendarView when date range provided', async () => {
      const data = { value: [{ id: 'evt1', subject: 'Meeting' }] };
      mockFetch(data);

      await provider.execute('outlook_list_events', {
        calendarId: 'cal1',
        startDateTime: '2024-01-01T00:00:00Z',
        endDateTime: '2024-01-31T23:59:59Z',
      }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/calendarView');
      expect(url).toContain('startDateTime=');
      expect(url).toContain('endDateTime=');
    });

    it('uses events endpoint without date range', async () => {
      const data = { value: [] };
      mockFetch(data);

      await provider.execute('outlook_list_events', {
        calendarId: 'cal1',
      }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/events');
      expect(url).not.toContain('/calendarView');
    });
  });

  describe('get_event', () => {
    it('fetches a single event', async () => {
      const data = { id: 'evt1', subject: 'Meeting' };
      mockFetch(data);

      const result = await provider.execute('outlook_get_event', { eventId: 'evt1' }, creds);
      expect(result).toEqual(data);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/events/evt1');
    });
  });

  describe('create_event', () => {
    it('creates an event via POST', async () => {
      const data = { id: 'new1', subject: 'New Meeting' };
      mockFetch(data);

      const result = await provider.execute('outlook_create_event', {
        calendarId: 'cal1',
        subject: 'New Meeting',
        start: { dateTime: '2024-01-15T10:00:00', timeZone: 'UTC' },
        end: { dateTime: '2024-01-15T11:00:00', timeZone: 'UTC' },
      }, creds);

      expect(result).toEqual(data);
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('/me/calendars/cal1/events');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.subject).toBe('New Meeting');
      expect(body.calendarId).toBeUndefined(); // calendarId should not be in the body
    });
  });

  describe('update_event', () => {
    it('updates an event via PATCH', async () => {
      const data = { id: 'evt1', subject: 'Updated' };
      mockFetch(data);

      const result = await provider.execute('outlook_update_event', {
        eventId: 'evt1',
        subject: 'Updated',
      }, creds);

      expect(result).toEqual(data);
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('/me/events/evt1');
      expect(fetchCall[1].method).toBe('PATCH');
    });

    it('rejects updating events organized by others when guard is set', async () => {
      // First call: GET event to check organizer (returns non-organizer)
      // Second call: should not happen
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'evt1',
            isOrganizer: false,
            organizer: { emailAddress: { address: 'boss@corp.com' } },
          }),
          text: async () => '{}',
        };
      });

      await expect(
        provider.execute(
          'outlook_update_event',
          { eventId: 'evt1', subject: 'Hack' },
          creds,
          { require_organizer_self: true },
        ),
      ).rejects.toThrow('Cannot modify events organized by others');
    });

    it('includes organizer email in error message', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'evt1',
          isOrganizer: false,
          organizer: { emailAddress: { address: 'boss@corp.com' } },
        }),
        text: async () => '{}',
      });

      await expect(
        provider.execute(
          'outlook_update_event',
          { eventId: 'evt1', subject: 'Test' },
          creds,
          { require_organizer_self: true },
        ),
      ).rejects.toThrow('boss@corp.com');
    });

    it('allows updating when organizer check passes', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // GET event (organizer check)
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'evt1', isOrganizer: true }),
            text: async () => '{}',
          };
        }
        // PATCH event
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'evt1', subject: 'Updated' }),
          text: async () => '{}',
        };
      });

      const result = await provider.execute(
        'outlook_update_event',
        { eventId: 'evt1', subject: 'Updated' },
        creds,
        { require_organizer_self: true },
      );

      expect(result).toEqual({ id: 'evt1', subject: 'Updated' });
      expect(callCount).toBe(2);
    });

    it('skips organizer check when guard is absent', async () => {
      const data = { id: 'evt1', subject: 'Updated' };
      mockFetch(data);

      await provider.execute(
        'outlook_update_event',
        { eventId: 'evt1', subject: 'Updated' },
        creds,
      );

      // Should only be one fetch call (the PATCH), no organizer check
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshCredentials', () => {
    it('refreshes tokens via Microsoft token endpoint', async () => {
      mockFetch({
        access_token: 'new_tok',
        refresh_token: 'new_ref',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const result = await provider.refreshCredentials(creds, {
        clientId: 'cid',
        clientSecret: 'csec',
      });

      expect(result.access_token).toBe('new_tok');
      expect(result.refresh_token).toBe('new_ref');
      expect(typeof result.expiry_date).toBe('number');
      expect(result.token_type).toBe('Bearer');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('login.microsoftonline.com');
      expect(fetchCall[1].method).toBe('POST');
    });

    it('preserves old refresh_token if new one not provided', async () => {
      mockFetch({
        access_token: 'new_tok',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const result = await provider.refreshCredentials(creds, {
        clientId: 'cid',
        clientSecret: 'csec',
      });

      expect(result.refresh_token).toBe('ref'); // from original creds
    });
  });

  describe('oauth config', () => {
    it('has oauth config with Microsoft-specific settings', () => {
      expect(provider.oauth).toBeDefined();
      expect(provider.oauth.authorizeUrl).toContain('login.microsoftonline.com');
      expect(provider.oauth.tokenUrl).toContain('login.microsoftonline.com');
      expect(provider.oauth.scopes).toContain('offline_access');
      expect(provider.oauth.scopes).toContain('Calendars.ReadWrite');
      expect(provider.oauth.builtinClientId).toBeDefined();
      expect(provider.oauth.builtinClientSecret).toBeDefined();
      expect(provider.oauth.settingsKeyPrefix).toBe('microsoft');
    });
  });

  describe('error handling', () => {
    it('throws on unknown tool', async () => {
      await expect(
        provider.execute('outlook_delete_event', {}, creds),
      ).rejects.toThrow('Unknown tool: outlook_delete_event');
    });

    it('throws on Graph API error', async () => {
      mockFetch({ error: { message: 'Forbidden' } }, 403);

      await expect(
        provider.execute('outlook_list_calendars', {}, creds),
      ).rejects.toThrow('Microsoft Graph API error (403)');
    });
  });
});
