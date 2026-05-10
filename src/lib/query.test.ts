import { describe, it, expect } from 'vitest';
import { buildInboxQuery, sanitizeInboxQuery } from './query.js';

describe('sanitizeInboxQuery', () => {
  it.each([
    { input: undefined, expected: undefined },
    { input: '', expected: '' },
    { input: 'from:boss@example.com', expected: 'from:boss@example.com' },
    { input: 'in:inbox', expected: 'in:inbox -in:trash -in:spam' },
    { input: 'in:inbox is:unread', expected: 'in:inbox is:unread -in:trash -in:spam' },
    { input: 'IN:INBOX', expected: 'IN:INBOX -in:trash -in:spam' },
    { input: 'in:inbox in:trash', expected: 'in:inbox in:trash -in:spam' },
    { input: 'in:inbox -in:trash', expected: 'in:inbox -in:trash -in:spam' },
    { input: 'in:inbox -in:trash -in:spam', expected: 'in:inbox -in:trash -in:spam' },
    { input: 'in:inbox in:spam', expected: 'in:inbox in:spam -in:trash' },
  ])(
    'should sanitize "$input" to "$expected"',
    ({ input, expected }) => {
      expect(sanitizeInboxQuery(input)).toBe(expected);
    }
  );

  it.each([
    {
      name: 'domain containing inbox substring',
      input: 'in:inbox domain:intrash.example.com',
      expected: 'in:inbox domain:intrash.example.com -in:trash -in:spam',
    },
    {
      name: 'category containing trash substring',
      input: 'in:inbox category:trash-talk',
      expected: 'in:inbox category:trash-talk -in:trash -in:spam',
    },
    {
      name: 'value containing "in:spam" as substring (subject:b[in:spam]mer)',
      input: 'in:inbox subject:bin:spammer',
      expected: 'in:inbox subject:bin:spammer -in:trash -in:spam',
    },
  ])(
    'should not false-positive on $name',
    ({ input, expected }) => {
      expect(sanitizeInboxQuery(input)).toBe(expected);
    }
  );

  describe('with forceExclude', () => {
    it('should add exclusions even without in:inbox', () => {
      expect(sanitizeInboxQuery(undefined, true)).toBe('-in:trash -in:spam');
    });

    it('should append to existing query', () => {
      expect(sanitizeInboxQuery('is:unread', true)).toBe(
        'is:unread -in:trash -in:spam'
      );
    });

    it('should not duplicate existing exclusions', () => {
      expect(sanitizeInboxQuery('-in:trash', true)).toBe('-in:trash -in:spam');
    });
  });
});

describe('buildInboxQuery', () => {
  it('defaults to all inbox messages, excluding promotions and social', () => {
    expect(buildInboxQuery()).toBe(
      'in:inbox -category:promotions -category:social'
    );
  });

  it('does not add is:unread by default', () => {
    expect(buildInboxQuery()).not.toContain('is:unread');
  });

  it('adds is:unread when unread is true', () => {
    expect(buildInboxQuery({ unread: true })).toBe(
      'in:inbox is:unread -category:promotions -category:social'
    );
  });

  it('drops the promotions exclusion when includePromotions is true', () => {
    expect(buildInboxQuery({ includePromotions: true })).toBe(
      'in:inbox -category:social'
    );
  });

  it('drops the social exclusion when includeSocial is true', () => {
    expect(buildInboxQuery({ includeSocial: true })).toBe(
      'in:inbox -category:promotions'
    );
  });

  it('keeps a read inbox message in scope (regression: list_inbox returned [])', () => {
    // A real Gmail inbox message can carry labels like
    // ["Label_91", "CATEGORY_UPDATES", "INBOX"] without UNREAD. The previous
    // implementation appended "is:unread" by default, so messages like that
    // were filtered out and list_inbox returned []. The default query must
    // not contain is:unread so these messages still surface.
    const query = buildInboxQuery();
    expect(query).toContain('in:inbox');
    expect(query).not.toContain('is:unread');
    // CATEGORY_UPDATES is neither promotions nor social, so default exclusions
    // do not affect it.
    expect(query).not.toContain('-category:updates');
  });
});
