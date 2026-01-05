import { Command } from 'commander';
import { getGmailClient } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

function getProfile(cmd: Command): string | undefined {
  return cmd.parent?.parent?.opts()?.profile;
}

export function createInboxCommand(): Command {
  const cmd = new Command('inbox').description('Inbox operations');

  cmd
    .command('list')
    .description('List messages in inbox')
    .option('-l, --limit <n>', 'Maximum number of messages', '20')
    .option('-u, --unread', 'Only show unread messages')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getGmailClient(getProfile(this));
        const queryParts = ['in:inbox'];
        if (options.unread) {
          queryParts.push('is:unread');
        }
        const query = queryParts.join(' ');

        const result = await client.listMessages({
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
      withErrorHandling(async function (this: Command, query, options) {
        const client = getGmailClient(getProfile(this));
        const inboxQuery = `in:inbox ${query}`;
        const messages = await client.searchMessages(inboxQuery, Number(options.limit));
        outputJson(messages);
      })
    );

  return cmd;
}
