#!/usr/bin/env bun

import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { createAuthCommand } from './commands/auth.js';
import { createMessagesCommand } from './commands/messages.js';
import { createDraftsCommand } from './commands/drafts.js';
import { createLabelsCommand } from './commands/labels.js';
import { createMcpCommand } from './commands/mcp.js';

declare const __VERSION__: string | undefined;
const version = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev';

const program = new Command();

program
  .name('gmail')
  .description('CLI for Gmail - read, search, and draft emails')
  .version(version)
  .option('-c, --compact', 'Minified JSON output')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    setOutputOptions({ compact: options.compact });
  });

program.addCommand(createAuthCommand());
program.addCommand(createMessagesCommand());
program.addCommand(createDraftsCommand());
program.addCommand(createLabelsCommand());
program.addCommand(createMcpCommand());

program.parseAsync().catch(() => process.exit(1));
