import { Command } from 'commander';
import { getGmailClient } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

function getProfile(cmd: Command): string | undefined {
  return cmd.parent?.parent?.opts()?.profile;
}

export function createDraftsCommand(): Command {
  const cmd = new Command('drafts').description('Draft email operations');

  cmd
    .command('list')
    .description('List all drafts')
    .option('-l, --limit <n>', 'Maximum number of drafts', '20')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getGmailClient(getProfile(this));
        const result = await client.listDrafts(Number(options.limit));
        outputJson(result);
      })
    );

  cmd
    .command('read')
    .description('Read a specific draft')
    .argument('<id>', 'Draft ID')
    .action(
      withErrorHandling(async function (this: Command, id) {
        const client = getGmailClient(getProfile(this));
        const draft = await client.getDraft(id);
        outputJson(draft);
      })
    );

  cmd
    .command('create')
    .description('Create a new draft')
    .requiredOption('--to <email>', 'Recipient email address')
    .requiredOption('--subject <subject>', 'Email subject')
    .requiredOption('--body <body>', 'Email body text')
    .option('--cc <emails>', 'CC recipients (comma-separated)')
    .option('--bcc <emails>', 'BCC recipients (comma-separated)')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getGmailClient(getProfile(this));
        const draft = await client.createDraft({
          to: options.to,
          subject: options.subject,
          body: options.body,
          cc: options.cc,
          bcc: options.bcc,
        });
        outputJson({ created: true, id: draft.id });
      })
    );

  return cmd;
}
