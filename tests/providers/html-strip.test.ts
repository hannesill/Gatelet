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

  it('removes script blocks entirely', () => {
    const html = '<script>alert("xss")</script>Safe text';
    const result = stripHtml(html);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toBe('Safe text');
  });

  it('removes style blocks and their content entirely', () => {
    const html = '<style>body{color:red} .cls{font-size:14px}</style><p>Text</p>';
    const result = stripHtml(html);
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('body{color:red}');
    expect(result).not.toContain('font-size');
    expect(result).toContain('Text');
  });

  it('removes &zwnj; entities', () => {
    expect(stripHtml('Hello&zwnj;World')).toBe('HelloWorld');
    expect(stripHtml('&zwnj;&zwnj;&zwnj;text')).toBe('text');
  });

  it('removes numeric HTML entities', () => {
    expect(stripHtml('Copyright &#169; 2026')).toBe('Copyright 2026');
    expect(stripHtml('&#8203;invisible&#8203;')).toBe('invisible');
  });

  it('collapses runs of horizontal whitespace', () => {
    expect(stripHtml('hello    world')).toBe('hello world');
    expect(stripHtml('hello\t\t  world')).toBe('hello world');
  });

  it('handles real-world HTML email with style blocks and &zwnj;', () => {
    const html = `
      <html><head><style type="text/css">
        @media only screen and (max-width:600px) { .content { width: 100% !important; } }
        body { margin: 0; padding: 0; }
      </style></head><body>
        &zwnj;&zwnj;&zwnj;
        <div class="content">
          <p>Your receipt:</p>
          <p>Total: $5.00</p>
        </div>
      </body></html>
    `;
    const result = stripHtml(html);
    expect(result).not.toContain('@media');
    expect(result).not.toContain('!important');
    expect(result).not.toContain('&zwnj;');
    expect(result).toContain('Your receipt:');
    expect(result).toContain('Total: $5.00');
  });
});
