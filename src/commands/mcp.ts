import { Command } from 'commander';
import { runMcpServer } from '../mcp/server.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createMcpCommand(): Command {
  const cmd = new Command('mcp').description('Run MCP server for AI agent integration');

  cmd.action(
    withErrorHandling(async () => {
      await runMcpServer();
    })
  );

  return cmd;
}
