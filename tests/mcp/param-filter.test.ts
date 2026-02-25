import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { stripUnknownParams, applyFieldPolicy } from '../../src/mcp/param-filter.js';

describe('stripUnknownParams', () => {
  it('removes fields not in schema', () => {
    const params = { calendarId: 'cal', summary: 'Test', sendUpdates: 'all', extraField: true };
    const schema = { calendarId: z.string(), summary: z.string() };
    const result = stripUnknownParams(params, schema);
    expect(result).toEqual({ calendarId: 'cal', summary: 'Test' });
  });

  it('preserves fields in schema', () => {
    const params = { calendarId: 'cal', summary: 'Test' };
    const schema = { calendarId: z.string(), summary: z.string(), description: z.string().optional() };
    const result = stripUnknownParams(params, schema);
    expect(result).toEqual({ calendarId: 'cal', summary: 'Test' });
  });

  it('handles empty params', () => {
    const schema = { calendarId: z.string() };
    const result = stripUnknownParams({}, schema);
    expect(result).toEqual({});
  });

  it('handles empty schema', () => {
    const params = { calendarId: 'cal', summary: 'Test' };
    const result = stripUnknownParams(params, {});
    expect(result).toEqual({});
  });
});

describe('applyFieldPolicy', () => {
  it('with allowed_fields keeps only listed fields', () => {
    const params = { calendarId: 'cal', summary: 'Test', description: 'Desc' };
    const result = applyFieldPolicy(params, { allowed_fields: ['calendarId', 'summary'] });
    expect(result).toEqual({ calendarId: 'cal', summary: 'Test' });
  });

  it('with denied_fields removes listed fields', () => {
    const params = { calendarId: 'cal', summary: 'Test', attendees: [], conferenceData: {} };
    const result = applyFieldPolicy(params, { denied_fields: ['attendees', 'conferenceData'] });
    expect(result).toEqual({ calendarId: 'cal', summary: 'Test' });
  });

  it('with no policy returns params unchanged', () => {
    const params = { calendarId: 'cal', summary: 'Test' };
    const result = applyFieldPolicy(params);
    expect(result).toBe(params);
  });

  it('with undefined policy returns params unchanged', () => {
    const params = { calendarId: 'cal', summary: 'Test' };
    const result = applyFieldPolicy(params, undefined);
    expect(result).toBe(params);
  });

  it('with empty allowed_fields removes all fields', () => {
    const params = { calendarId: 'cal', summary: 'Test' };
    const result = applyFieldPolicy(params, { allowed_fields: [] });
    expect(result).toEqual({});
  });

  it('with empty denied_fields keeps all fields', () => {
    const params = { calendarId: 'cal', summary: 'Test' };
    const result = applyFieldPolicy(params, { denied_fields: [] });
    expect(result).toEqual({ calendarId: 'cal', summary: 'Test' });
  });
});
