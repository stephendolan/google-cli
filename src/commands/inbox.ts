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
    .description('List inbox messages (unread, excludes promotions/social by default)')
    .option('-l, --limit <n>', 'Maximum number of messages', '20')
    .option('-a, --all', 'Include read messages (default: unread only)')
    .option('--promotions', 'Include category:promotions')
    .option('--social', 'Include category:social')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getGmailClient(getProfile(this));
        const queryParts = ['in:inbox'];

        if (!options.all) queryParts.push('is:unread');
        if (!options.promotions) queryParts.push('-category:promotions');
        if (!options.social) queryParts.push('-category:social');

        const query = queryParts.join(' ');
        const messages = await client.searchMessages(query, Number(options.limit));
        outputJson(messages);
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
