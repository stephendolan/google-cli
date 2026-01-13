import * as fs from 'node:fs';
import { Command } from 'commander';
import {
  isAuthenticated,
  logout,
  startAuthFlow,
  deleteProfileCredentials,
  exportProfile,
  importProfile,
  type ExportData,
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

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

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

  cmd
    .command('export')
    .description('Export profile credentials for transfer to another machine')
    .option('-p, --profile <name>', 'Profile to export (default: active profile)')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .action(
      withErrorHandling(async (options) => {
        const profile = options.profile ?? getActiveProfile();
        const data = await exportProfile(profile);
        const json = JSON.stringify(data, null, 2);

        if (options.output) {
          fs.writeFileSync(options.output, json);
          console.error(`Exported profile '${profile}' to ${options.output}`);
        } else {
          process.stdout.write(json);
        }
      })
    );

  cmd
    .command('import')
    .description('Import profile credentials from export file')
    .option('-f, --file <path>', 'Input file (default: stdin)')
    .option('-p, --profile <name>', 'Target profile name (default: use name from export)')
    .option('--force', 'Overwrite existing profile')
    .action(
      withErrorHandling(async (options) => {
        const json = options.file
          ? fs.readFileSync(options.file, 'utf-8')
          : await readStdin();

        let data: ExportData;
        try {
          data = JSON.parse(json) as ExportData;
        } catch {
          throw new GoogleCliError('Invalid JSON in import data');
        }

        if (data.version !== 1) {
          throw new GoogleCliError(`Unsupported export format version: ${data.version}`);
        }

        const targetProfile = options.profile ?? data.profile;

        if (profileExists(targetProfile) && !options.force) {
          throw new GoogleCliError(
            `Profile '${targetProfile}' already exists. Use --force to overwrite.`
          );
        }

        await importProfile(data, targetProfile);

        outputJson({
          status: 'imported',
          profile: targetProfile,
          email: data.email ?? undefined,
        });
      })
    );

  return cmd;
}
