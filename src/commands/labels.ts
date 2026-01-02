import { Command } from 'commander';
import { gmailClient } from '../lib/gmail-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createLabelsCommand(): Command {
  const cmd = new Command('labels').description('Label operations');

  cmd
    .command('list')
    .description('List all labels')
    .action(
      withErrorHandling(async () => {
        const labels = await gmailClient.listLabels();
        outputJson(labels);
      })
    );

  return cmd;
}
