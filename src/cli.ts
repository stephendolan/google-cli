#!/usr/bin/env bun

import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { createAuthCommand } from './commands/auth.js';
import { createMessagesCommand } from './commands/messages.js';
import { createInboxCommand } from './commands/inbox.js';
import { createDraftsCommand } from './commands/drafts.js';
import { createLabelsCommand } from './commands/labels.js';
import { createCalendarCommand } from './commands/calendar.js';
import { createMcpCommand } from './commands/mcp.js';

declare const __VERSION__: string | undefined;
const version = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev';

export interface GlobalOptions {
  compact?: boolean;
  profile?: string;
}

const program = new Command();

program
  .name('google')
  .description('CLI for Google services - Gmail and Calendar')
  .version(version)
  .option('-c, --compact', 'Minified JSON output')
  .option('-p, --profile <name>', 'Use a specific profile')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    setOutputOptions({ compact: options.compact });
  });

program.addCommand(createAuthCommand());
program.addCommand(createMessagesCommand());
program.addCommand(createInboxCommand());
program.addCommand(createDraftsCommand());
program.addCommand(createLabelsCommand());
program.addCommand(createCalendarCommand());
program.addCommand(createMcpCommand());

program.parseAsync().catch(() => process.exit(1));

export { program };
