/** Strip CR/LF to prevent email header injection */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, '');
}
