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
        })),
      },
      calendar: vi.fn(() => ({
        events: mockEvents,
        calendarList: mockCalendarList,
      })),
    },
    _mockEvents: mockEvents,
  };
});

// Access the mocks
import { _mockEvents as mockEvents } from 'googleapis';

const provider = new GoogleCalendarProvider();
const creds = { access_token: 'tok', refresh_token: 'ref' };

describe('GoogleCalendarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      );

      expect(result).toEqual({ id: 'evt1', summary: 'Updated' });
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
      );

      expect(result).toEqual({ id: 'evt5', summary: 'Updated' });
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
});
