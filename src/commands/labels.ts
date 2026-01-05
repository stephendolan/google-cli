import { Command } from 'commander';
import { getGmailClient } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

function getProfile(cmd: Command): string | undefined {
  return cmd.parent?.parent?.opts()?.profile;
}

export function createLabelsCommand(): Command {
  const cmd = new Command('labels').description('Label operations');

  cmd
    .command('list')
    .description('List all labels')
    .action(
      withErrorHandling(async function (this: Command) {
        const client = getGmailClient(getProfile(this));
        const labels = await client.listLabels();
        outputJson(labels);
      })
    );

  return cmd;
}
