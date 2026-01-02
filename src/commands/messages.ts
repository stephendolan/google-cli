import { Command } from 'commander';
import { client } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createMessagesCommand(): Command {
  const cmd = new Command('messages').description('Email message operations');

  cmd
    .command('list')
    .description('List messages from inbox')
    .option('-l, --limit <n>', 'Maximum number of messages', '20')
    .option('-q, --query <query>', 'Gmail search query')
    .option('--label <label>', 'Filter by label ID')
    .action(
      withErrorHandling(async (options) => {
        const result = await client.listMessages({
          maxResults: Number(options.limit),
          query: options.query,
          labelIds: options.label ? [options.label] : undefined,
        });
        outputJson(result);
      })
    );

  cmd
    .command('read')
    .description('Read a specific message')
    .argument('<id>', 'Message ID')
    .option('-f, --format <format>', 'Response format: full, metadata, minimal', 'full')
    .action(
      withErrorHandling(async (id, options) => {
        const message = await client.getMessage(id, options.format);
        outputJson(message);
      })
    );

  cmd
    .command('search')
    .description('Search messages')
    .argument('<query>', 'Gmail search query (e.g., "from:boss@example.com subject:report")')
    .option('-l, --limit <n>', 'Maximum number of results', '20')
    .action(
      withErrorHandling(async (query, options) => {
        const messages = await client.searchMessages(query, Number(options.limit));
        outputJson(messages);
      })
    );

  return cmd;
}
