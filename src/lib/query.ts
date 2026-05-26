/** Checks whether a Gmail operator (e.g. "in:trash") appears as a standalone token, negated or not. */
function hasOperator(query: string, operator: string): boolean {
  const escaped = operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)-?${escaped}(?:\\s|$)`, 'i').test(query);
}

export interface InboxQueryOptions {
  unread?: boolean;
  read?: boolean;
  includePromotions?: boolean;
  includeSocial?: boolean;
}

/**
 * Builds the Gmail search query used to list inbox messages. Defaults to
 * read + unread so callers match `search_messages` with `in:inbox`.
 * `unread` and `read` narrow to a single status and are mutually exclusive.
 */
export function buildInboxQuery(options: InboxQueryOptions = {}): string {
  if (options.unread && options.read) {
    throw new Error('Cannot combine unread and read filters');
  }
  const parts = ['in:inbox'];
  if (options.unread) parts.push('is:unread');
  if (options.read) parts.push('is:read');
  if (!options.includePromotions) parts.push('-category:promotions');
  if (!options.includeSocial) parts.push('-category:social');
  return parts.join(' ');
}

/**
 * Appends `-in:trash -in:spam` to inbox queries so trashed/spam messages
 * don't leak into results. Skips exclusions the user already specified.
 *
 * Set `forceExclude` when labelIds already scopes to INBOX (no `in:inbox` in the query string).
 */
export function sanitizeInboxQuery(
  query: string | undefined,
  forceExclude = false
): string | undefined {
  if (!query && !forceExclude) return query;

  const q = query ?? '';
  if (!forceExclude && !hasOperator(q, 'in:inbox')) return query;

  const exclusions: string[] = [];
  if (!hasOperator(q, 'in:trash')) exclusions.push('-in:trash');
  if (!hasOperator(q, 'in:spam')) exclusions.push('-in:spam');

  if (exclusions.length === 0) return query;
  return q ? `${q} ${exclusions.join(' ')}` : exclusions.join(' ');
}
