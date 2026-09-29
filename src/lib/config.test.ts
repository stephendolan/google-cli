import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keyringAccounts: string[] = [];

vi.mock('@napi-rs/keyring', () => ({
  Entry: class {},
  findCredentials: (service: string) =>
    service === 'google-cli'
      ? keyringAccounts.map((account) => ({ account, password: 'secret' }))
      : [],
}));

const { discoverProfiles, getActiveProfile, profileExists } = await import('./config.js');

describe('profile discovery with keyring storage', () => {
  const originalHome = process.env.HOME;
  let home: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'google-cli-test-'));
    process.env.HOME = home;
    keyringAccounts.length = 0;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('discovers keyring profiles when config.json is missing', async () => {
    keyringAccounts.push(
      'profile:stephen-personal:client_id',
      'profile:stephen-personal:tokens',
      'profile:stephen-work:tokens',
      'client_id'
    );

    expect((await discoverProfiles()).sort()).toEqual(['stephen-personal', 'stephen-work']);
    expect(await profileExists('stephen-work')).toBe(true);
    expect(await profileExists('missing')).toBe(false);
    expect(getActiveProfile()).toBe('default');
  });

  it('returns no profiles when the keyring has none', async () => {
    expect(await discoverProfiles()).toEqual([]);
  });
});
