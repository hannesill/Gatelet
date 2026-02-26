import { describe, it, expect } from 'vitest';
import { applyMutations } from '../../src/policy/mutations.js';

describe('set mutation', () => {
  it('sets a top-level field', () => {
    const params: Record<string, unknown> = { summary: 'Test' };
    applyMutations([{ field: 'visibility', action: 'set', value: 'private' }], params);
    expect(params.visibility).toBe('private');
  });

  it('overwrites an existing field', () => {
    const params: Record<string, unknown> = { visibility: 'public' };
    applyMutations([{ field: 'visibility', action: 'set', value: 'private' }], params);
    expect(params.visibility).toBe('private');
  });

  it('sets a nested field, creating intermediates', () => {
    const params: Record<string, unknown> = {};
    applyMutations([{ field: 'location.displayName', action: 'set', value: 'Office' }], params);
    expect((params.location as Record<string, unknown>).displayName).toBe('Office');
  });

  it('sets array values', () => {
    const params: Record<string, unknown> = { attendees: [{ email: 'a@b.com' }] };
    applyMutations([{ field: 'attendees', action: 'set', value: [] }], params);
    expect(params.attendees).toEqual([]);
  });

  it('sets boolean values', () => {
    const params: Record<string, unknown> = {};
    applyMutations([{ field: 'guestsCanModify', action: 'set', value: false }], params);
    expect(params.guestsCanModify).toBe(false);
  });
});

describe('delete mutation', () => {
  it('deletes an existing field', () => {
    const params: Record<string, unknown> = { summary: 'Test', description: 'Desc' };
    applyMutations([{ field: 'description', action: 'delete' }], params);
    expect(params).not.toHaveProperty('description');
    expect(params.summary).toBe('Test');
  });

  it('does not error when deleting a missing field', () => {
    const params: Record<string, unknown> = { summary: 'Test' };
    applyMutations([{ field: 'nonexistent', action: 'delete' }], params);
    expect(params).toEqual({ summary: 'Test' });
  });
});

describe('applyMutations', () => {
  it('applies multiple mutations in order', () => {
    const params: Record<string, unknown> = {
      attendees: [{ email: 'a@b.com' }],
      visibility: 'public',
      description: 'Remove me',
    };

    applyMutations(
      [
        { field: 'attendees', action: 'set', value: [] },
        { field: 'visibility', action: 'set', value: 'private' },
        { field: 'description', action: 'delete' },
      ],
      params,
    );

    expect(params.attendees).toEqual([]);
    expect(params.visibility).toBe('private');
    expect(params).not.toHaveProperty('description');
  });
});
