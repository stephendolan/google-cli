import { Command } from 'commander';
import {
  isAuthenticated,
  logout,
  startAuthFlow,
  deleteProfileCredentials,
} from '../lib/auth.js';
import {
  getActiveProfile,
  setActiveProfile,
  listProfiles,
  removeProfile,
  getProfileEmail,
  profileExists,
} from '../lib/config.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { GoogleCliError } from '../lib/errors.js';

export function createAuthCommand(): Command {
  const cmd = new Command('auth').description('Authentication management');

  cmd
    .command('login')
    .description('Authenticate with Google using OAuth2')
    .requiredOption('--client-id <id>', 'Google OAuth2 Client ID')
    .requiredOption('--client-secret <secret>', 'Google OAuth2 Client Secret')
    .option('-p, --profile <name>', 'Profile name (default: "default")', 'default')
    .action(
      withErrorHandling(async (options) => {
        await startAuthFlow(options.clientId, options.clientSecret, options.profile);
        const email = getProfileEmail(options.profile);
        outputJson({
          status: 'authenticated',
          profile: options.profile,
          email: email ?? undefined,
          message: `Successfully authenticated profile '${options.profile}'`,
        });
      })
    );

  cmd
    .command('status')
    .description('Check authentication status')
    .option('-p, --profile <name>', 'Profile name (default: active profile)')
    .action(
      withErrorHandling(async (options) => {
        const profile = options.profile ?? getActiveProfile();
        const authenticated = await isAuthenticated(profile);
        const email = getProfileEmail(profile);
        const active = getActiveProfile();
        outputJson({
          profile,
          authenticated,
          email: email ?? undefined,
          active: profile === active,
        });
      })
    );

  cmd
    .command('logout')
    .description('Clear tokens for a profile (keeps credentials for re-login)')
    .option('-p, --profile <name>', 'Profile name (default: active profile)')
    .action(
      withErrorHandling(async (options) => {
        const profile = options.profile ?? getActiveProfile();
        await logout(profile);
        outputJson({ status: 'logged_out', profile });
      })
    );

  cmd
    .command('current')
    .description('Show the currently active profile')
    .action(
      withErrorHandling(async () => {
        const profile = getActiveProfile();
        const email = getProfileEmail(profile);
        const authenticated = await isAuthenticated(profile);
        outputJson({ profile, email: email ?? undefined, authenticated });
      })
    );

  cmd
    .command('list')
    .description('List all configured profiles')
    .action(
      withErrorHandling(async () => {
        const profiles = listProfiles();
        const active = getActiveProfile();
        const result = await Promise.all(
          profiles.map(async (name) => ({
            name,
            email: getProfileEmail(name) ?? undefined,
            authenticated: await isAuthenticated(name),
            active: name === active,
          }))
        );
        outputJson({ profiles: result, active });
      })
    );

  cmd
    .command('switch')
    .description('Switch to a different profile')
    .argument('<name>', 'Profile name to switch to')
    .action(
      withErrorHandling(async (name) => {
        if (!profileExists(name)) {
          throw new GoogleCliError(`Profile '${name}' not found.`);
        }
        setActiveProfile(name);
        const email = getProfileEmail(name);
        outputJson({
          status: 'switched',
          profile: name,
          email: email ?? undefined,
        });
      })
    );

  cmd
    .command('delete')
    .description('Delete a profile and its credentials')
    .argument('<name>', 'Profile name to delete')
    .action(
      withErrorHandling(async (name) => {
        if (!profileExists(name)) {
          throw new GoogleCliError(`Profile '${name}' not found.`);
        }
        const active = getActiveProfile();
        if (name === active) {
          throw new GoogleCliError(
            `Cannot delete active profile '${name}'. Switch to another profile first.`
          );
        }
        await deleteProfileCredentials(name);
        removeProfile(name);
        outputJson({ status: 'deleted', profile: name });
      })
    );

  return cmd;
}
