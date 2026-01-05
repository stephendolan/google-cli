import * as fs from 'node:fs';
import { Command } from 'commander';
import { getGmailClient, decodeBase64Url } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

function getProfile(cmd: Command): string | undefined {
  return cmd.parent?.parent?.opts()?.profile;
}

export function createMessagesCommand(): Command {
  const cmd = new Command('messages').description('Email message operations');

  cmd
    .command('list')
    .description('List messages from inbox')
    .option('-l, --limit <n>', 'Maximum number of messages', '20')
    .option('-q, --query <query>', 'Gmail search query')
    .option('--label <label>', 'Filter by label ID')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getGmailClient(getProfile(this));
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
      withErrorHandling(async function (this: Command, id, options) {
        const client = getGmailClient(getProfile(this));
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
      withErrorHandling(async function (this: Command, query, options) {
        const client = getGmailClient(getProfile(this));
        const messages = await client.searchMessages(query, Number(options.limit));
        outputJson(messages);
      })
    );

  cmd
    .command('attachment')
    .description('Download an attachment from a message')
    .argument('<message-id>', 'Message ID')
    .argument('<attachment-id>', 'Attachment ID (from message attachments list)')
    .option('-o, --output <path>', 'Save attachment to file')
    .action(
      withErrorHandling(async function (this: Command, messageId, attachmentId, options) {
        const client = getGmailClient(getProfile(this));
        const attachment = await client.getAttachment(messageId, attachmentId);
        if (options.output) {
          const buffer = decodeBase64Url(attachment.data);
          fs.writeFileSync(options.output, buffer);
          outputJson({ saved: options.output, size: buffer.length });
        } else {
          outputJson(attachment);
        }
      })
    );

  return cmd;
}
