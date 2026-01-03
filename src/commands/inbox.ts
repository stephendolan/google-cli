import { Command } from 'commander';
import { gmailClient } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createInboxCommand(): Command {
  const cmd = new Command('inbox').description('Inbox operations');

  cmd
    .command('list')
    .description('List messages in inbox')
    .option('-l, --limit <n>', 'Maximum number of messages', '20')
    .option('-u, --unread', 'Only show unread messages')
    .action(
      withErrorHandling(async (options) => {
        const queryParts = ['in:inbox'];
        if (options.unread) {
          queryParts.push('is:unread');
        }
        const query = queryParts.join(' ');

        const result = await gmailClient.listMessages({
          maxResults: Number(options.limit),
          query,
        });
        outputJson(result);
      })
    );

  cmd
    .command('search')
    .description('Search messages in inbox')
    .argument('<query>', 'Search query (auto-scoped to inbox)')
    .option('-l, --limit <n>', 'Maximum number of results', '20')
    .action(
      withErrorHandling(async (query, options) => {
        const inboxQuery = `in:inbox ${query}`;
        const messages = await gmailClient.searchMessages(inboxQuery, Number(options.limit));
        outputJson(messages);
      })
    );

  return cmd;
}
