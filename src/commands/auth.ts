import { Command } from 'commander';
import { isAuthenticated, logout, startAuthFlow } from '../lib/auth.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createAuthCommand(): Command {
  const cmd = new Command('auth').description('Authentication management');

  cmd
    .command('login')
    .description('Authenticate with Gmail using OAuth2')
    .requiredOption('--client-id <id>', 'Google OAuth2 Client ID')
    .requiredOption('--client-secret <secret>', 'Google OAuth2 Client Secret')
    .action(
      withErrorHandling(async (options) => {
        await startAuthFlow(options.clientId, options.clientSecret);
        outputJson({ status: 'authenticated', message: 'Successfully authenticated with Gmail' });
      })
    );

  cmd
    .command('status')
    .description('Check authentication status')
    .action(
      withErrorHandling(async () => {
        const authenticated = await isAuthenticated();
        outputJson({ authenticated });
      })
    );

  cmd
    .command('logout')
    .description('Remove stored credentials')
    .action(
      withErrorHandling(async () => {
        await logout();
        outputJson({ status: 'logged_out' });
      })
    );

  return cmd;
}
