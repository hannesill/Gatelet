import { describe, it, expect } from 'vitest';
import { stripHtml } from '../../src/providers/email/html.js';

describe('stripHtml', () => {
  it('removes all HTML tags', () => {
    expect(stripHtml('<div>Hello</div>')).toBe('Hello');
    expect(stripHtml('<p><strong>Bold</strong> text</p>')).toBe('Bold text');
  });

  it('converts <br> to newline', () => {
    expect(stripHtml('Line 1<br>Line 2')).toBe('Line 1\nLine 2');
    expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1\nLine 2');
    expect(stripHtml('Line 1<br />Line 2')).toBe('Line 1\nLine 2');
    expect(stripHtml('Line 1<BR>Line 2')).toBe('Line 1\nLine 2');
  });

  it('converts </p> to double newline', () => {
    const result = stripHtml('<p>Para 1</p><p>Para 2</p>');
    expect(result).toContain('Para 1');
    expect(result).toContain('Para 2');
    expect(result).toContain('\n\n');
  });

  it('decodes HTML entities', () => {
    // &nbsp; becomes a space, but .trim() strips trailing whitespace
    expect(stripHtml('&amp; &lt; &gt; &quot;')).toBe('& < > "');
    expect(stripHtml('hello&nbsp;world')).toBe('hello world');
    expect(stripHtml('&amp;amp;')).toBe('&amp;');
  });

  it('collapses excessive newlines', () => {
    const result = stripHtml('<p>A</p>\n\n\n<p>B</p>');
    // Should not have more than 2 consecutive newlines
    expect(result).not.toContain('\n\n\n');
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  <div> hello </div>  ')).toBe('hello');
  });

  it('handles empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles input with no HTML tags', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('handles nested tags', () => {
    const html = '<div><table><tr><td>Cell</td></tr></table></div>';
    expect(stripHtml(html)).toBe('Cell');
  });

  it('does not execute script tags (strips them)', () => {
    const html = '<script>alert("xss")</script>Safe text';
    const result = stripHtml(html);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Safe text');
  });

  it('strips style tag elements but not their text content', () => {
    // NOTE: stripHtml only removes tags, not content between <style> tags.
    // This is a known limitation -- for email display this is acceptable
    // because the CSS text is harmless once tags are removed.
    const html = '<style>body{color:red}</style><p>Text</p>';
    const result = stripHtml(html);
    expect(result).not.toContain('<style>');
    expect(result).toContain('Text');
  });
});
