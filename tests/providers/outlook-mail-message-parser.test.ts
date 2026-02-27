import { describe, it, expect } from 'vitest';
import { parseGraphMessage } from '../../src/providers/outlook-mail/message-parser.js';

describe('parseGraphMessage', () => {
  it('parses a complete message', () => {
    const result = parseGraphMessage({
      id: 'msg1',
      conversationId: 'conv1',
      categories: ['Blue Category'],
      from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
      toRecipients: [{ emailAddress: { name: 'Bob', address: 'bob@example.com' } }],
      ccRecipients: [{ emailAddress: { address: 'charlie@example.com' } }],
      subject: 'Test Subject',
      receivedDateTime: '2026-02-24T10:00:00Z',
      body: { contentType: 'text', content: 'Hello world' },
      bodyPreview: 'Hello world',
      hasAttachments: true,
    });

    expect(result.id).toBe('msg1');
    expect(result.threadId).toBe('conv1');
    expect(result.labelIds).toEqual(['Blue Category']);
    expect(result.from).toBe('Alice <alice@example.com>');
    expect(result.to).toBe('Bob <bob@example.com>');
    expect(result.cc).toBe('charlie@example.com');
    expect(result.subject).toBe('Test Subject');
    expect(result.date).toBe('2026-02-24T10:00:00Z');
    expect(result.body).toBe('Hello world');
    expect(result.snippet).toBe('Hello world');
    expect(result.hasAttachments).toBe(true);
  });

  it('strips HTML from body when contentType is html', () => {
    const result = parseGraphMessage({
      id: 'msg2',
      body: { contentType: 'html', content: '<div>Hello <b>world</b></div>' },
      bodyPreview: 'Hello world',
    });

    expect(result.body).toBe('Hello world');
  });

  it('preserves plaintext body as-is', () => {
    const result = parseGraphMessage({
      id: 'msg3',
      body: { contentType: 'text', content: 'Plain text content' },
    });

    expect(result.body).toBe('Plain text content');
  });

  it('falls back to bodyPreview when body content is empty', () => {
    const result = parseGraphMessage({
      id: 'msg4',
      body: { contentType: 'text', content: '' },
      bodyPreview: 'Preview text here',
    });

    expect(result.body).toBe('Preview text here');
  });

  it('handles missing fields gracefully', () => {
    const result = parseGraphMessage({});

    expect(result.id).toBe('');
    expect(result.threadId).toBe('');
    expect(result.labelIds).toEqual([]);
    expect(result.from).toBe('');
    expect(result.to).toBe('');
    expect(result.cc).toBe('');
    expect(result.subject).toBe('');
    expect(result.date).toBe('');
    expect(result.body).toBe('');
    expect(result.snippet).toBe('');
    expect(result.hasAttachments).toBe(false);
  });

  it('formats multiple To recipients as comma-separated', () => {
    const result = parseGraphMessage({
      id: 'msg5',
      toRecipients: [
        { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
        { emailAddress: { address: 'bob@example.com' } },
      ],
    });

    expect(result.to).toBe('Alice <alice@example.com>, bob@example.com');
  });

  it('formats recipient with only name', () => {
    const result = parseGraphMessage({
      id: 'msg6',
      from: { emailAddress: { name: 'Alice' } },
    });

    expect(result.from).toBe('Alice');
  });

  it('formats recipient with only address', () => {
    const result = parseGraphMessage({
      id: 'msg7',
      from: { emailAddress: { address: 'alice@example.com' } },
    });

    expect(result.from).toBe('alice@example.com');
  });

  it('handles empty recipients list', () => {
    const result = parseGraphMessage({
      id: 'msg8',
      toRecipients: [],
      ccRecipients: [],
    });

    expect(result.to).toBe('');
    expect(result.cc).toBe('');
  });

  it('treats html contentType case-insensitively', () => {
    const result = parseGraphMessage({
      id: 'msg9',
      body: { contentType: 'HTML', content: '<p>Hello</p>' },
    });

    expect(result.body).toBe('Hello');
  });
});
