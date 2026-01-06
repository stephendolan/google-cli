import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage } from './errors.js';

describe('sanitizeErrorMessage', () => {
  it.each([
    {
      pattern: 'Bearer tokens',
      input: 'Authorization: Bearer ya29.abc123token456',
      shouldNotContain: 'ya29.abc123token456',
    },
    {
      pattern: 'access_token key-value pairs',
      input: 'Error: access_token=my-secret-access-token',
      shouldNotContain: 'my-secret-access-token',
    },
    {
      pattern: 'refresh_token key-value pairs',
      input: 'Error: refresh_token=1//my-refresh-token',
      shouldNotContain: '1//my-refresh-token',
    },
    {
      pattern: 'client_secret key-value pairs',
      input: 'Failed: client_secret=GOCSPX-super-secret',
      shouldNotContain: 'GOCSPX-super-secret',
    },
  ])('should redact $pattern', ({ input, shouldNotContain }) => {
    const result = sanitizeErrorMessage(input);
    expect(result).not.toContain(shouldNotContain);
    expect(result).toContain('[REDACTED]');
  });

  it('should handle multiple sensitive patterns in one message', () => {
    const message = 'Auth failed: Bearer ya29.xyz789 with client_secret=GOCSPX-abc123';
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain('ya29.xyz789');
    expect(result).not.toContain('GOCSPX-abc123');
  });

  it('should not modify safe messages', () => {
    const message = 'Message not found';
    const result = sanitizeErrorMessage(message);
    expect(result).toBe(message);
  });
});
